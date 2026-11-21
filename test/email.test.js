/* Rabisco Mágico — parent magic-link email tests.
 *
 * Run: npm test
 *
 * Covers lib/email.js (Resend via plain fetch, no new dependencies) and
 * the signup/verify HTTP flow. No real email is ever sent: with no
 * RESEND_API_KEY the module reports stub, and with a key the HTTP call
 * is intercepted by stubbing global fetch. No fal.ai calls, no money.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const email = require("../lib/email");
const logger = require("../lib/logger");

const OLD_KEY = process.env.RESEND_API_KEY;
const OLD_URL = process.env.RESEND_API_URL;
const OLD_FROM = process.env.EMAIL_FROM;
const OLD_BASE = process.env.APP_BASE_URL;
const OLD_FETCH = global.fetch;

function restoreEnv() {
  if (OLD_KEY === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = OLD_KEY;
  if (OLD_URL === undefined) delete process.env.RESEND_API_URL;
  else process.env.RESEND_API_URL = OLD_URL;
  if (OLD_FROM === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = OLD_FROM;
  if (OLD_BASE === undefined) delete process.env.APP_BASE_URL;
  else process.env.APP_BASE_URL = OLD_BASE;
  global.fetch = OLD_FETCH;
}

beforeEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_URL;
  delete process.env.EMAIL_FROM;
  delete process.env.APP_BASE_URL;
  global.fetch = OLD_FETCH;
});

after(() => restoreEnv());

test("email: no RESEND_API_KEY -> stub, nothing sent, no fetch call", async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error("must not fetch"); };
  const result = await email.sendMagicLink("mae@exemplo.com", "tok123", "pt");
  assert.deepEqual(result, { sent: false, stub: true });
  assert.equal(called, false);
});

test("email: with a key -> Resend payload is correct and token/email are never logged", async () => {
  process.env.RESEND_API_KEY = "re_test-key-do-not-use";
  process.env.EMAIL_FROM = "Rabisco Mágico <ola@exemplo.com>";
  process.env.APP_BASE_URL = "https://rabisco-magico.vercel.app";
  const token = "tok-abc-123-secret";
  const parentEmail = "mae@exemplo.com";

  let fetchArgs = null;
  global.fetch = async (url, opts) => {
    fetchArgs = { url, opts };
    return { ok: true, status: 200, json: async () => ({ id: "email-id-1" }) };
  };

  // Record every log call: the token and the email must never appear.
  const logged = [];
  const origInfo = logger.info;
  const origWarn = logger.warn;
  logger.info = (event, fields) => { logged.push({ event, fields }); };
  logger.warn = (event, fields) => { logged.push({ event, fields }); };
  try {
    const result = await email.sendMagicLink(parentEmail, token, "en");
    assert.deepEqual(result, { sent: true });
  } finally {
    logger.info = origInfo;
    logger.warn = origWarn;
  }

  assert.ok(fetchArgs, "fetch was not called");
  assert.equal(fetchArgs.url, "https://api.resend.com/emails");
  assert.equal(fetchArgs.opts.method, "POST");
  assert.equal(fetchArgs.opts.headers.Authorization, "Bearer re_test-key-do-not-use");
  const body = JSON.parse(fetchArgs.opts.body);
  assert.equal(body.from, "Rabisco Mágico <ola@exemplo.com>");
  assert.equal(body.to, parentEmail);
  assert.equal(body.subject, "Your sign-in link — Rabisco Mágico");
  assert.ok(body.html.includes("https://rabisco-magico.vercel.app/?token=" + token));
  assert.ok(body.text.includes("https://rabisco-magico.vercel.app/?token=" + token));
  assert.ok(!JSON.stringify(logged).includes(token), "token was logged");
  assert.ok(!JSON.stringify(logged).includes(parentEmail), "email was logged");
});

test("email: Resend rejects the send -> sent false, no throw", async () => {
  process.env.RESEND_API_KEY = "re_test-key-do-not-use";
  global.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
  const result = await email.sendMagicLink("mae@exemplo.com", "tok123", "pt");
  assert.deepEqual(result, { sent: false, error: "resend_403" });
});

test("email: pt language falls back to the pt-BR body", async () => {
  process.env.RESEND_API_KEY = "re_test-key-do-not-use";
  let body = null;
  global.fetch = async (_url, opts) => {
    body = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => ({ id: "x" }) };
  };
  await email.sendMagicLink("mae@exemplo.com", "tok123", "pt"); // server.js langOf() returns "pt"
  assert.equal(body.subject, "Seu link de acesso — Rabisco Mágico");
});

// ---------------------------------------------------------------------------
// HTTP flow: signup without a key reports emailSent false + stub, the
// token is never in the response, and the token still verifies (the
// paste-the-code path). The ?token= client handling in public/app.js
// calls this same POST /api/parent/verify endpoint.
// ---------------------------------------------------------------------------
let server;
let base;
before(async () => {
  const { app } = require("../server.js");
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test("signup without a key: emailSent false, stub true, token verifies", async () => {
  delete process.env.RESEND_API_KEY;
  require("../server.js")._testReset();
  const signupRes = await fetch(base + "/api/parent/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mae@exemplo.com" }),
  });
  const signup = await signupRes.json();
  assert.equal(signupRes.status, 200);
  assert.equal(signup.ok, true);
  assert.equal(signup.emailSent, false);
  assert.equal(signup.stub, true);
  assert.ok(!JSON.stringify(signup).includes("token"));

  const token = require("../server.js").accounts._testGetMagicToken("mae@exemplo.com");
  assert.ok(token, "no magic token issued");
  const verifyRes = await fetch(base + "/api/parent/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const verify = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verify.ok, true);
  assert.ok(verify.sessionToken);
  assert.equal(verify.account.email, "mae@exemplo.com");
});
