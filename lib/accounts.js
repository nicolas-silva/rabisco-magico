/**
 * Rabisco Mágico — parent accounts (in-memory stub).
 *
 * Model: parents only. A parent account is an email address. There are
 * NO child accounts and NO child personal data is stored anywhere.
 *
 * Sign-in is magic-link style: the parent enters an email, we create a
 * one-time token, and (in production) email them a link. This build does
 * NOT send email — the link is only logged server-side and marked as a
 * stub, so nothing leaves the server. The token is never returned in an
 * API response. Tests read it through the _testGetMagicToken() helper.
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
 * Production: replace the Maps with a database, send the magic link with
 * a real email provider, and hash the session tokens at rest.
 */
"use strict";

const crypto = require("crypto");
const logger = require("./logger");

const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const FAMILY_MONTHLY_CAP = 300;
const PACK_TRANSFORMS = 30;

const accounts = new Map(); // id -> account
const byEmail = new Map(); // normalised email -> id
const magicTokens = new Map(); // token -> { accountId, expiresAt }
const sessions = new Map(); // token -> { accountId, expiresAt }

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
 * Start a magic-link sign-in. Returns { ok, accountId }. No email is
 * sent in this build (stub) and the link is NEVER logged: the token is
 * a credential and the email is parent personal data. Tests read the
 * token via _testGetMagicToken(), or via the RABISCO_TEST_LOG_MAGIC_TOKEN
 * hatch below when the server runs as a separate process.
 */
function requestMagicLink(emailRaw) {
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
  // STUB — no email provider is wired. In production, send this link by
  // email instead of logging it. The token and the email are NEVER logged:
  // the token is a credential and the email is parent personal data.
  // (Tests read the token via _testGetMagicToken(); the parent gets it
  // from the emailed link once a provider is wired.)
  //
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
  logger.info("magic_link_created", { stub: true });
  return { ok: true, accountId: acc.id, emailSent: false, stub: true };
}

/** Consume a magic-link token and return a session token (or null). */
function verifyMagicLink(token) {
  const rec = magicTokens.get(String(token || ""));
  if (!rec) return null;
  magicTokens.delete(String(token || ""));
  if (rec.expiresAt < Date.now()) return null;
  const acc = accounts.get(rec.accountId);
  if (!acc) return null;
  const sessionToken = crypto.randomBytes(32).toString("hex");
  sessions.set(sessionToken, { accountId: acc.id, expiresAt: Date.now() + SESSION_TTL_MS });
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
  return true;
}

/** Consume one transform for a paid plan. Call only after a success. */
function consumeTransform(accountId) {
  const acc = accounts.get(accountId);
  if (!acc) return;
  if (acc.plan === "family") acc.familyUsedThisMonth += 1;
  else if (acc.packTransforms > 0) acc.packTransforms -= 1;
  else if (acc.bonusTransforms > 0) acc.bonusTransforms -= 1;
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
  return true;
}

module.exports = {
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
  // Test-only helpers.
  _testReset() {
    accounts.clear();
    byEmail.clear();
    magicTokens.clear();
    sessions.clear();
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
