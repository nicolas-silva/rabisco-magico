/* Rabisco Mágico — tests for the overnight batch:
 * Stripe test-mode checkout + webhook, parent accounts + magic link,
 * gallery storage + deletion, cost dashboard, kill switch.
 *
 * Run:  npm test
 *
 * node:test only, no framework. Stripe and fal.ai are both mocked by
 * local HTTP servers — these tests never call a real API, never spend
 * money, and use fake test keys only.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const TEST_KEY = "test-fake-key-do-not-use";
const STRIPE_TEST_KEY = "sk_test_fake-do-not-use";
const WEBHOOK_SECRET = "whsec_test_fake-do-not-use";
const ADMIN_TOKEN = "test-admin-token-do-not-use";

process.env.FAL_KEY = TEST_KEY;
process.env.STRIPE_SECRET_KEY = STRIPE_TEST_KEY;
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.STRIPE_PRICE_FAMILY_MONTHLY = "price_test_family_monthly";
process.env.STRIPE_PRICE_FAMILY_YEARLY = "price_test_family_yearly";
process.env.STRIPE_PRICE_MAGIC_PACK = "price_test_magic_pack";
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

// --- Minimal PNG encoder (same shape as test/server.test.js) ---------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePng(width, height, pixel) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return "data:image/png;base64," + Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
}
const inkDrawing = () => makePng(512, 512, (x, y) => (x === 10 && y === 10 ? [255, 59, 48] : [255, 255, 255]));

let server;
let baseUrl;
let mockServer;
let stripeCalls = [];
let falCalls = 0;

async function req(method, urlPath, { body, headers = {}, rawBody } = {}) {
  const res = await fetch(baseUrl + urlPath, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: rawBody !== undefined ? rawBody : body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_e) { /* non-JSON body */ }
  return { status: res.status, data, text };
}

async function signedInParent(email) {
  const signup = await req("POST", "/api/parent/signup", { body: { email } });
  assert.equal(signup.status, 200, "signup failed: " + JSON.stringify(signup.data));
  assert.equal(signup.data.ok, true);
  assert.ok(!JSON.stringify(signup.data).includes("token"), "magic token must never be returned");
  const token = require("../server.js").accounts._testGetMagicToken(email);
  assert.ok(token, "no magic token issued");
  const verify = await req("POST", "/api/parent/verify", { body: { token } });
  assert.equal(verify.status, 200);
  assert.ok(verify.data.sessionToken);
  return verify.data.sessionToken;
}

function stripeSignature(payload) {
  const t = Math.floor(Date.now() / 1000);
  const v1 = crypto.createHmac("sha256", WEBHOOK_SECRET).update(t + "." + payload).digest("hex");
  return `t=${t},v1=${v1}`;
}

async function grantViaWebhook(sessionToken, product) {
  const me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": sessionToken } });
  const accountId = me.data.account.id;
  const event = {
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_1", subscription: "sub_test_1", metadata: { accountId, product } } },
  };
  const payload = JSON.stringify(event);
  const res = await req("POST", "/api/stripe/webhook", {
    rawBody: payload,
    headers: { "stripe-signature": stripeSignature(payload) },
  });
  assert.equal(res.status, 200, "webhook failed: " + JSON.stringify(res.data));
  return accountId;
}

before(async () => {
  mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.url.startsWith("/v1/checkout/sessions")) {
        stripeCalls.push({ auth: req.headers.authorization || "", body: raw });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: "cs_test_123", url: "https://checkout.stripe.test/pay/cs_test_123" }));
      } else {
        falCalls += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ images: [{ url: "https://example.invalid/generated.png" }] }));
      }
    });
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const port = mockServer.address().port;
  process.env.FAL_ENDPOINT = `http://127.0.0.1:${port}/fal-ai/flux-2-pro/edit`;
  process.env.STRIPE_API_BASE = `http://127.0.0.1:${port}`;

  const { app } = require("../server.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => mockServer.close(resolve));
  // Local-disk gallery writes land in data/gallery during these tests.
  fs.rmSync(path.join(__dirname, "..", "data"), { recursive: true, force: true });
});

beforeEach(() => {
  stripeCalls = [];
  falCalls = 0;
  delete process.env.KILL_SWITCH;
  require("../server.js")._testReset();
});

test("parent signup: bad email rejected, good email gets a magic link (stub, token never returned)", async () => {
  const bad = await req("POST", "/api/parent/signup", { body: { email: "not-an-email" } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, "invalid_email");

  const ok = await req("POST", "/api/parent/signup", { body: { email: "  Mae@Teste.com.br " } });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.ok, true);
  assert.equal(ok.data.stub, true); // no real email is sent in this build
  assert.ok(!JSON.stringify(ok.data).includes("token"));

  const badToken = await req("POST", "/api/parent/verify", { body: { token: "nope" } });
  assert.equal(badToken.status, 401);
});

test("parent session: /api/parent/me needs a session and reports the free quota", async () => {
  const noSession = await req("GET", "/api/parent/me");
  assert.equal(noSession.status, 401);

  const session = await signedInParent("pai@example.com");
  const me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  assert.equal(me.status, 200);
  assert.equal(me.data.account.email, "pai@example.com");
  assert.equal(me.data.account.plan, "free");
  assert.equal(me.data.freeRemaining, 5);
});

test("stripe checkout: family subscription session is created in test mode", async () => {
  const session = await signedInParent("mae@example.com");
  const res = await req("POST", "/api/checkout/family", {
    body: { billing: "monthly" },
    headers: { "x-parent-session": session },
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.url, "https://checkout.stripe.test/pay/cs_test_123");
  assert.equal(stripeCalls.length, 1);
  assert.equal(stripeCalls[0].auth, "Bearer " + STRIPE_TEST_KEY);
  assert.ok(stripeCalls[0].body.includes("price_test_family_monthly"));
  assert.ok(stripeCalls[0].body.includes("mode=subscription"));
  assert.ok(!JSON.stringify(res.data).includes(STRIPE_TEST_KEY));

  const yearly = await req("POST", "/api/checkout/family", {
    body: { billing: "yearly" },
    headers: { "x-parent-session": session },
  });
  assert.equal(yearly.status, 200);
  assert.ok(stripeCalls[1].body.includes("price_test_family_yearly"));
});

test("stripe checkout: magic pack one-off purchase", async () => {
  const session = await signedInParent("pack@example.com");
  const res = await req("POST", "/api/checkout/pack", {
    body: {},
    headers: { "x-parent-session": session },
  });
  assert.equal(res.status, 200);
  assert.ok(stripeCalls[0].body.includes("price_test_magic_pack"));
  assert.ok(stripeCalls[0].body.includes("mode=payment"));
});

test("stripe checkout: unknown product rejected, parent session required", async () => {
  const session = await signedInParent("anon@example.com");
  const noSession = await req("POST", "/api/checkout/family", { body: { billing: "monthly" } });
  assert.equal(noSession.status, 401);
  const bad = await req("POST", "/api/checkout/vip", {
    body: {},
    headers: { "x-parent-session": session },
  });
  assert.equal(bad.status, 400);
});

test("stripe webhook: signed checkout.session.completed grants the Magic Pack, then transforms use it", async () => {
  const session = await signedInParent("comprador@example.com");
  await grantViaWebhook(session, "pack");

  const me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  assert.equal(me.data.account.plan, "pack");
  assert.equal(me.data.account.packTransforms, 30);

  // 6 transforms: more than the 5-free quota, so they must be drawing on the pack.
  for (let i = 0; i < 6; i++) {
    const r = await req("POST", "/api/transform", {
      body: { image: inkDrawing(), language: "pt" },
      headers: { "x-parent-session": session },
    });
    assert.equal(r.status, 200, "transform " + i + " failed: " + JSON.stringify(r.data));
    assert.equal(r.data.remaining, 29 - i);
  }
  assert.equal(falCalls, 6);
});

test("stripe webhook: unsigned or wrongly signed events are rejected, nothing is granted", async () => {
  const session = await signedInParent("vitima@example.com");
  const me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  const accountId = me.data.account.id;
  const payload = JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { metadata: { accountId, product: "family" } } },
  });
  const unsigned = await req("POST", "/api/stripe/webhook", { rawBody: payload });
  assert.equal(unsigned.status, 400);
  const wrongSig = await req("POST", "/api/stripe/webhook", {
    rawBody: payload,
    headers: { "stripe-signature": "t=1,v1=deadbeef" },
  });
  assert.equal(wrongSig.status, 400);

  const after = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  assert.equal(after.data.account.plan, "free");
});

test("stripe webhook: family grant + subscription.deleted revokes it", async () => {
  const session = await signedInParent("familia@example.com");
  await grantViaWebhook(session, "family");
  let me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  assert.equal(me.data.account.plan, "family");
  assert.equal(me.data.account.subscriptionId, "sub_test_1");

  const accountId = me.data.account.id;
  const payload = JSON.stringify({
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_test_1", metadata: { accountId } } },
  });
  const res = await req("POST", "/api/stripe/webhook", {
    rawBody: payload,
    headers: { "stripe-signature": stripeSignature(payload) },
  });
  assert.equal(res.status, 200);
  me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
  assert.equal(me.data.account.plan, "free");
  assert.equal(me.data.account.subscriptionId, null);
});

test("gallery: a transform is stored server-side and DELETE /api/gallery wipes it (parent only)", async () => {
  const session = await signedInParent("galeria@example.com");
  const denied = await req("DELETE", "/api/gallery");
  assert.equal(denied.status, 401);

  const t = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-parent-session": session },
  });
  assert.equal(t.status, 200);
  assert.ok(t.data.workId, "transform should return a stored work id");

  const list = await req("GET", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(list.status, 200);
  assert.equal(list.data.works.length, 1);
  assert.equal(list.data.works[0].imageUrl, "https://example.invalid/generated.png");

  const del = await req("DELETE", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(del.status, 200);
  assert.equal(del.data.deleted, 1);
  const empty = await req("GET", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(empty.data.works.length, 0);
});

test("cost dashboard: admin token required, returns mock-labelled figures", async () => {
  const noToken = await req("GET", "/api/admin/dashboard");
  assert.equal(noToken.status, 401);
  const wrong = await req("GET", "/api/admin/dashboard", { headers: { "x-admin-token": "wrong" } });
  assert.equal(wrong.status, 401);

  // One successful transform so the dashboard has something to show.
  const t = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "dash-account" },
  });
  assert.equal(t.status, 200);

  const dash = await req("GET", "/api/admin/dashboard", { headers: { "x-admin-token": ADMIN_TOKEN } });
  assert.equal(dash.status, 200);
  assert.equal(dash.data.ok, true);
  const d = dash.data.dashboard;
  assert.match(d.dataLabel, /MOCK/);
  assert.equal(d.today.transforms, 1);
  assert.equal(d.today.estimatedSpendUsd, 0.045);
  assert.equal(d.today.failureRate, 0);
  assert.equal(d.costPerTransformUsd, 0.045);
  assert.equal(d.killSwitch, false);
  assert.equal(dash.data.stripeConfigured, true);
  assert.equal(dash.data.storageBackend, "local");
});

test("kill switch: KILL_SWITCH=1 pauses transforms with a friendly error", async () => {
  process.env.KILL_SWITCH = "1";
  const r = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "kill-account" },
  });
  assert.equal(r.status, 503);
  assert.equal(r.data.error, "disabled");
  assert.equal(falCalls, 0, "kill switch must not call fal");
});

test("stripe checkout without a key: child server returns 503 stripe_not_configured", async (t) => {
  const port = 18800 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env,
      STRIPE_SECRET_KEY: "",
      STRIPE_API_BASE: process.env.STRIPE_API_BASE,
      FAL_KEY: TEST_KEY,
      PORT: String(port),
      // Test-only: lets this test read the magic-link token from the
      // child's stdout (default logging never prints it — see
      // lib/accounts.js). Never set outside tests.
      RABISCO_TEST_LOG_MAGIC_TOKEN: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  let childOut = "";
  child.stdout.on("data", (d) => (childOut += d.toString()));
  const childBase = `http://127.0.0.1:${port}`;
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try {
      const r = await fetch(childBase + "/api/health");
      up = r.ok;
    } catch (_e) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  assert.ok(up, "child server did not start");
  // Sign up + verify in the child (the token is printed to its stdout
  // only because RABISCO_TEST_LOG_MAGIC_TOKEN=1 is set above; default
  // logging never prints it).
  const signup = await fetch(childBase + "/api/parent/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "semchave@example.com" }),
  });
  assert.equal(signup.status, 200);
  const m = childOut.match(/token=([a-f0-9]{64})/);
  assert.ok(m, "magic link was not logged by the child");
  const verify = await fetch(childBase + "/api/parent/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: m[1] }),
  });
  const vdata = await verify.json();
  assert.equal(verify.status, 200);
  const checkout = await fetch(childBase + "/api/checkout/family", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-parent-session": vdata.sessionToken },
    body: JSON.stringify({ billing: "monthly" }),
  });
  const cdata = await checkout.json();
  assert.equal(checkout.status, 503);
  assert.equal(cdata.error, "stripe_not_configured");
  assert.ok(!JSON.stringify(cdata).includes(STRIPE_TEST_KEY));
});
