/**
 * Rabisco Mágico — parent accounts (in-memory stub).
 *
 * Model: parents only. A parent account is an email address. There are
 * NO child accounts and NO child personal data is stored anywhere.
 *
 * Sign-in is magic-link style: the parent enters an email, we create a
 * one-time token, and email them a link (lib/email.js, Resend). When no
 * email provider is configured the send is a stub and the parent pastes
 * the token from the code field instead. The token is never returned in
 * an API response. Tests read it through the _testGetMagicToken() helper.
 *
 * Persistence: accounts, magic tokens and sessions are kept in the Maps
 * below as the working copy and persisted through lib/account-store.js
 * (memory by default, JSON file for local dev, KV REST for production).
 * Until a KV store is connected, a Vercel deployment runs on memory and
 * a magic link can land on an instance that never saw the token.
 *
 * Plans:
 *   free   — 5 free transforms total (enforced by the server quota map).
 *   family — subscription, fair-use cap 300 transforms / month.
 *   pack   — one-off Magic Pack: 30 transforms, counted down.
 *   bonus  — referral bonus transforms (see grantBonusTransform):
 *            a plain counter, spent like pack transforms, never
 *            touching Stripe. A free-plan parent with bonus
 *            transforms left may transform past the 5-free quota.
 *
 * Production: connect a KV store (see lib/account-store.js), send the
 * magic link with a real email provider, and hash the session tokens at rest.
 */
"use strict";

const crypto = require("crypto");
const logger = require("./logger");
const emailSender = require("./email");
const accountStore = require("./account-store");

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FAMILY_MONTHLY_CAP = 300;
const PACK_TRANSFORMS = 30;

const accounts = new Map(); // id -> account
const byEmail = new Map(); // normalised email -> id
const magicTokens = new Map(); // token -> { accountId, expiresAt }
const sessions = new Map(); // token -> { accountId, expiresAt }

// ---------------------------------------------------------------------------
// Persistence (lib/account-store.js). The Maps above are the working copy;
// the store is the durable copy. init() hydrates the Maps once (lazily,
// so the first request on a cold serverless instance loads them); every
// mutation persists afterwards. With the default memory backend the
// store is process-local and nothing survives a restart — see the
// store module for the file (local dev) and kv (production) backends.
// ---------------------------------------------------------------------------
let store = null;
let initPromise = null;

function getStore() {
  if (!store) {
    try {
      store = accountStore.createStore();
    } catch (err) {
      // Misconfigured backend (e.g. kv without credentials): log once and
      // fall back to the in-process store so sign-in keeps working in
      // this process instead of crashing every request.
      logger.warn("account_store_unavailable", { backend: process.env.ACCOUNTS_BACKEND || "memory" });
      let state = null;
      store = {
        backend: "memory",
        async load() { return state ? JSON.parse(JSON.stringify(state)) : accountStore.emptyState(); },
        async save(next) { state = JSON.parse(JSON.stringify(next)); },
      };
    }
  }
  return store;
}

function snapshot() {
  return {
    accounts: [...accounts.values()],
    magicTokens: [...magicTokens.entries()].map(([token, rec]) => ({ token, ...rec })),
    sessions: [...sessions.entries()].map(([token, rec]) => ({ token, ...rec })),
  };
}

function hydrate(state) {
  accounts.clear();
  byEmail.clear();
  magicTokens.clear();
  sessions.clear();
  for (const acc of state.accounts || []) {
    accounts.set(acc.id, acc);
    byEmail.set(acc.email, acc.id);
  }
  for (const rec of state.magicTokens || []) {
    magicTokens.set(rec.token, { accountId: rec.accountId, expiresAt: rec.expiresAt });
  }
  for (const rec of state.sessions || []) {
    sessions.set(rec.token, { accountId: rec.accountId, expiresAt: rec.expiresAt });
  }
}

async function init() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const state = await getStore().load();
        hydrate(state);
      } catch (err) {
        // A broken store must not take sign-in down: log and continue
        // with empty in-process state.
        logger.warn("account_store_load_failed", {});
      }
    })();
  }
  return initPromise;
}

async function persist() {
  await init();
  await getStore().save(snapshot());
}

// Fire-and-forget persist for mutations made from sync callers
// (consumeTransform, grantPurchase, ...). Failures are logged, never
// thrown — a transform must not fail because the store hiccuped.
function persistSoon() {
  persist().catch(() => logger.warn("account_store_save_failed", {}));
}

function newId(prefix) {
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}

function normaliseEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function publicAccount(acc) {
  return {
    id: acc.id,
    email: acc.email,
    plan: acc.plan,
    packTransforms: acc.packTransforms,
    bonusTransforms: acc.bonusTransforms,
    familyUsedThisMonth: acc.familyUsedThisMonth,
    familyMonthlyCap: FAMILY_MONTHLY_CAP,
    subscriptionId: acc.subscriptionId || null,
    createdAt: acc.createdAt,
  };
}

function createAccount(email) {
  const id = newId("par");
  const acc = {
    id,
    email,
    plan: "free",
    packTransforms: 0,
    bonusTransforms: 0,
    familyUsedThisMonth: 0,
    subscriptionId: null,
    createdAt: new Date().toISOString(),
  };
  accounts.set(id, acc);
  byEmail.set(email, id);
  return acc;
}

function getAccount(id) {
  return accounts.get(id) || null;
}

/**
 * Start a magic-link sign-in. Async: creates the token, persists it,
 * then emails the link (lib/email.js). When no email provider is
 * configured the email step reports stub and the parent keeps the
 * paste-the-code path. Returns { ok, accountId, emailSent, stub }.
 * The token is NEVER returned and NEVER logged (except the test-only
 * hatch below). Tests read the token via _testGetMagicToken().
 */
async function requestMagicLink(emailRaw, language) {
  await init();
  const email = normaliseEmail(emailRaw);
  if (!validEmail(email)) {
    const err = new Error("invalid email");
    err.code = "INVALID_EMAIL";
    throw err;
  }
  let acc = byEmail.has(email) ? accounts.get(byEmail.get(email)) : null;
  if (!acc) acc = createAccount(email);
  const token = crypto.randomBytes(32).toString("hex");
  magicTokens.set(token, { accountId: acc.id, expiresAt: Date.now() + MAGIC_LINK_TTL_MS });
  await persist();
  // TEST-ONLY escape hatch: RABISCO_TEST_LOG_MAGIC_TOKEN=1 prints the
  // token to stdout so a test that spawns server.js as a separate
  // process (test/new-features.test.js, "stripe checkout without a
  // key") can read it — an in-process test helper cannot cross the
  // process boundary. NEVER set this outside tests: a magic-link token
  // in a log is a credential leak (anyone with log access could sign
  // in as the parent). It is deliberately not listed in .env.example.
  if (process.env.RABISCO_TEST_LOG_MAGIC_TOKEN === "1") {
    process.stdout.write("[rabisco-test] MAGIC LINK token=" + token + "\n");
  }
  const sent = await emailSender.sendMagicLink(email, token, language);
  logger.info("magic_link_created", { stub: !sent.sent });
  return { ok: true, accountId: acc.id, emailSent: sent.sent, stub: !!sent.stub };
}

/** Consume a magic-link token and return a session token (or null). */
async function verifyMagicLink(token) {
  await init();
  const rec = magicTokens.get(String(token || ""));
  if (!rec) return null;
  magicTokens.delete(String(token || ""));
  if (rec.expiresAt < Date.now()) {
    await persist();
    return null;
  }
  const acc = accounts.get(rec.accountId);
  if (!acc) {
    await persist();
    return null;
  }
  const sessionToken = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionToken, { accountId: acc.id, expiresAt: Date.now() + SESSION_TTL_MS });
  await persist();
  return { sessionToken, account: publicAccount(acc) };
}

/** Resolve a session token to its account (or null). */
function getAccountBySession(sessionToken) {
  const rec = sessions.get(String(sessionToken || ""));
  if (!rec) return null;
  if (rec.expiresAt < Date.now()) {
    sessions.delete(String(sessionToken || ""));
    return null;
  }
  const acc = accounts.get(rec.accountId);
  return acc ? publicAccount(acc) : null;
}

/** Pure check: may this account transform now? Does not consume anything. */
function checkTransform(accountId) {
  const acc = accounts.get(accountId);
  if (!acc) return { allowed: true, remaining: null, anonymous: true };
  if (acc.plan === "family") {
    if (acc.familyUsedThisMonth >= FAMILY_MONTHLY_CAP) {
      return { allowed: false, reason: "family_cap", remaining: 0 };
    }
    return { allowed: true, remaining: FAMILY_MONTHLY_CAP - acc.familyUsedThisMonth };
  }
  if (acc.packTransforms > 0 || acc.bonusTransforms > 0) {
    return { allowed: true, remaining: acc.packTransforms + acc.bonusTransforms };
  }
  if (acc.plan === "pack") {
    return { allowed: false, reason: "pack_empty", remaining: 0 };
  }
  return { allowed: true, remaining: null, free: true }; // free plan: server quota map applies
}

/** Grant bonus transforms (referral stub — no payment involved). */
function grantBonusTransform(accountId, count) {
  const acc = accounts.get(accountId);
  if (!acc) return false;
  const n = Number(count) > 0 ? Math.floor(Number(count)) : 1;
  acc.bonusTransforms += n;
  persistSoon();
  return true;
}

/** Consume one transform for a paid plan. Call only after a success. */
function consumeTransform(accountId) {
  const acc = accounts.get(accountId);
  if (!acc) return;
  if (acc.plan === "family") acc.familyUsedThisMonth += 1;
  else if (acc.packTransforms > 0) acc.packTransforms -= 1;
  else if (acc.bonusTransforms > 0) acc.bonusTransforms -= 1;
  persistSoon();
}

/**
 * Grant a purchase from a Stripe webhook event.
 * product: "family" (subscription) or "pack" (one-off, +30 transforms).
 */
function grantPurchase(accountId, product, subscriptionId) {
  const acc = accounts.get(accountId);
  if (!acc) return false;
  if (product === "family") {
    acc.plan = "family";
    acc.subscriptionId = subscriptionId || acc.subscriptionId;
    acc.familyUsedThisMonth = 0;
  } else if (product === "pack") {
    acc.packTransforms += PACK_TRANSFORMS;
    if (acc.plan !== "family") acc.plan = "pack";
  } else {
    return false;
  }
  persistSoon();
  return true;
}

/** Revoke a Family subscription (e.g. customer.subscription.deleted). */
function revokeSubscription(accountId, subscriptionId) {
  const acc = accounts.get(accountId);
  if (!acc) return false;
  if (subscriptionId && acc.subscriptionId && acc.subscriptionId !== subscriptionId) return false;
  acc.plan = acc.packTransforms > 0 ? "pack" : "free";
  acc.subscriptionId = null;
  acc.familyUsedThisMonth = 0;
  persistSoon();
  return true;
}

module.exports = {
  init,
  requestMagicLink,
  verifyMagicLink,
  getAccountBySession,
  getAccount,
  publicAccount,
  checkTransform,
  consumeTransform,
  grantBonusTransform,
  grantPurchase,
  revokeSubscription,
  validEmail,
  FAMILY_MONTHLY_CAP,
  PACK_TRANSFORMS,
  // Test-only helpers. Sync on purpose: tests call this in beforeEach
  // and immediately sign up again. Clearing the Maps is synchronous;
  // the store wipe is fire-and-forget, and initPromise is marked
  // resolved (empty state) so a later init() does not reload the
  // not-yet-wiped store and resurrect the old accounts.
  _testReset() {
    accounts.clear();
    byEmail.clear();
    magicTokens.clear();
    sessions.clear();
    initPromise = Promise.resolve();
    getStore().save(accountStore.emptyState()).catch(() => {});
  },
  _testGetMagicToken(email) {
    const id = byEmail.get(normaliseEmail(email));
    if (!id) return null;
    for (const [token, rec] of magicTokens) {
      if (rec.accountId === id) return token;
    }
    return null;
  },
  _testGetAccount(id) {
    return accounts.get(id) || null;
  },
};
