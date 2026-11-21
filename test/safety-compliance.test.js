/* Rabisco Mágico — tests for Batch 3 (safety & compliance):
 * title/phrase blocklist, output-image safety-check stub, structured
 * audit logging, retention hooks on stored works.
 *
 * Run:  npm test
 *
 * node:test only, no framework. fal.ai is mocked by a local HTTP
 * server — these tests never call a real API, never spend money, and
 * use fake test keys only. No real children's drawings are used: the
 * vision step is overridden in tests to return fixed titles/phrases.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const zlib = require("node:zlib");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const TEST_KEY = "test-fake-key-do-not-use";

process.env.FAL_KEY = TEST_KEY;

const blocklist = require("../lib/blocklist");
const outputSafety = require("../lib/output-safety");
const audit = require("../lib/audit");
const { LocalDiskStorage } = require("../lib/storage");

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

// ===========================================================================
// Unit: blocklist
// ===========================================================================

test("blocklist: blocks English, Portuguese and Spanish terms", () => {
  assert.equal(blocklist.checkText("a nice shit day").blocked, true);
  assert.equal(blocklist.checkText("que merda é essa").blocked, true);
  assert.equal(blocklist.checkText("qué mierda es esta").blocked, true);
  assert.equal(blocklist.checkText("My magic drawing").blocked, false);
  assert.equal(blocklist.checkText("Um sol amarelo e grama verde").blocked, false);
});

test("blocklist: accent-insensitive, so pênis matches penis and vice versa", () => {
  assert.equal(blocklist.checkText("pênis").blocked, true);
  assert.equal(blocklist.checkText("penis").blocked, true);
  assert.deepEqual(blocklist.checkText("pênis").categories, ["sexual"]);
});

test("blocklist: whole-word matching only — no substring false positives", () => {
  assert.equal(blocklist.checkText("sexto desenho").blocked, false); // "sex" inside "sexto"
  assert.equal(blocklist.checkText("a class passed").blocked, false);
  assert.equal(blocklist.checkText("sex").blocked, true);
});

test("blocklist: checkTitleAndPhrase merges title and phrase hits", () => {
  const clean = blocklist.checkTitleAndPhrase("Meu sol", "Olha que lindo!");
  assert.equal(clean.blocked, false);
  const hit = blocklist.checkTitleAndPhrase("Meu desenho", "que porra é essa");
  assert.equal(hit.blocked, true);
  assert.deepEqual(hit.categories, ["profanity"]);
  assert.deepEqual(hit.checkedFields, ["titulo", "frase"]);
});

test("blocklist: addTerms, env extras, and removeTerm extend it", () => {
  assert.equal(blocklist.checkText("zanzibar").blocked, false);
  blocklist.addTerms([{ term: "zanzibar", lang: "xx", category: "extra" }]);
  assert.equal(blocklist.checkText("zanzibar").blocked, true);
  assert.equal(blocklist.removeTerm("zanzibar"), true);
  assert.equal(blocklist.checkText("zanzibar").blocked, false);

  process.env.BLOCKLIST_EXTRA_TERMS = "palavra-inventada";
  try {
    assert.equal(blocklist.checkText("palavra inventada").blocked, true);
  } finally {
    delete process.env.BLOCKLIST_EXTRA_TERMS;
  }
});

// ===========================================================================
// Unit: output-safety stub
// ===========================================================================

test("output-safety: stub passes a real URL, fails a missing one", async () => {
  const pass = await outputSafety.checkOutputImage("https://example.invalid/generated.png");
  assert.equal(pass.checked, true);
  assert.equal(pass.safe, true);
  assert.equal(pass.stub, true);
  assert.equal(pass.mode, "stub");
  assert.equal(pass.reason, "stub_pass");

  const missing = await outputSafety.checkOutputImage("");
  assert.equal(missing.checked, true);
  assert.equal(missing.safe, false);
  assert.equal(missing.reason, "missing_image");
});

test("output-safety: forced-fail override (env and option) exercises the fail path", async () => {
  const viaOpt = await outputSafety.checkOutputImage("https://example.invalid/x.png", { forceResult: "fail" });
  assert.equal(viaOpt.safe, false);
  assert.equal(viaOpt.reason, "stub_forced_fail");

  process.env.OUTPUT_SAFETY_STUB_RESULT = "fail";
  try {
    const viaEnv = await outputSafety.checkOutputImage("https://example.invalid/x.png");
    assert.equal(viaEnv.safe, false);
  } finally {
    delete process.env.OUTPUT_SAFETY_STUB_RESULT;
  }
});

test("output-safety: mode off skips the check; mode live fails closed (no provider wired)", async () => {
  process.env.OUTPUT_SAFETY_CHECK = "off";
  try {
    const off = await outputSafety.checkOutputImage("https://example.invalid/x.png");
    assert.equal(off.checked, false);
    assert.equal(off.safe, true);
    assert.equal(off.reason, "disabled");
    assert.equal(outputSafety.safetyCheckEnabled(), false);
  } finally {
    delete process.env.OUTPUT_SAFETY_CHECK;
  }

  process.env.OUTPUT_SAFETY_CHECK = "live";
  try {
    const live = await outputSafety.checkOutputImage("https://example.invalid/x.png");
    assert.equal(live.checked, true);
    assert.equal(live.safe, false, "live with no provider must fail closed, never pass");
    assert.equal(live.reason, "provider_not_configured");
    assert.equal(live.stub, false);
  } finally {
    delete process.env.OUTPUT_SAFETY_CHECK;
  }

  process.env.OUTPUT_SAFETY_CHECK = "nonsense";
  try {
    assert.equal(outputSafety.currentMode(), "stub", "unknown mode falls back to stub");
  } finally {
    delete process.env.OUTPUT_SAFETY_CHECK;
  }
});

// ===========================================================================
// Unit: audit logging
// ===========================================================================

test("audit: hashes the account id, never logs the raw id or extra fields", () => {
  audit._testReset();
  const event = audit.logEvent({
    accountId: "par_abc123",
    action: audit.ACTIONS.TRANSFORM_SUCCESS,
    outcome: "success",
    costUsd: 0.045,
    workId: "work_xyz",
    // Fields a careless caller might pass — all must be dropped.
    email: "mae@example.com",
    titulo: "Meu desenho",
    frase: "Olha só!",
    imageUrl: "https://example.invalid/generated.png",
  });
  assert.match(event.account_id_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(event).includes("par_abc123"), "raw account id leaked");
  assert.ok(!JSON.stringify(event).includes("mae@example.com"), "email leaked");
  assert.ok(!JSON.stringify(event).includes("Meu desenho"), "title leaked");
  assert.ok(!JSON.stringify(event).includes("example.invalid"), "image URL leaked");
  assert.equal(event.action, "transform_success");
  assert.equal(event.cost_usd, 0.045);
  assert.equal(event.work_id, "work_xyz");
  // Same account hashes the same way; a different account does not.
  assert.equal(audit.hashAccountId("par_abc123"), event.account_id_hash);
  assert.notEqual(audit.hashAccountId("par_other"), event.account_id_hash);
});

test("audit: getEvents returns copies and _testReset clears the buffer", () => {
  audit._testReset();
  audit.logEvent({ accountId: "a", action: "transform_success", outcome: "success" });
  assert.equal(audit.count(), 1);
  const copy = audit.getEvents();
  copy[0].action = "tampered";
  assert.equal(audit.getEvents()[0].action, "transform_success");
  audit._testReset();
  assert.equal(audit.count(), 0);
});

// ===========================================================================
// Unit: storage retention hooks
// ===========================================================================

test("storage: parent works are parent-controlled, anonymous works get a deleteAfter", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rabisco-retention-"));
  try {
    const store = new LocalDiskStorage(dir);
    const parent = await store.saveWork("par_1", { titulo: "Sol", frase: "Lindo", imageUrl: "https://example.invalid/a.png" });
    const anon = await store.saveWork("anon_1", { titulo: "Sol", frase: "Lindo", imageUrl: "https://example.invalid/b.png" }, { autoPurge: true, retentionDays: 90 });
    const [p] = await store.listWorks("par_1");
    const [a] = await store.listWorks("anon_1");
    assert.equal(p.retention.policy, "parent_controlled");
    assert.equal(p.retention.deleteAfter, null);
    assert.equal(a.retention.policy, "auto_purge");
    assert.ok(a.retention.deleteAfter > a.retention.createdAt);
    assert.ok(Math.abs(new Date(a.retention.deleteAfter) - new Date(a.retention.createdAt) - 90 * 86400000) < 5000);
    assert.ok(parent.id && anon.id);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("storage: purgeExpiredWorks removes only expired anonymous works", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rabisco-purge-"));
  try {
    const store = new LocalDiskStorage(dir);
    await store.saveWork("anon_1", { titulo: "Velho", frase: "x", imageUrl: "https://example.invalid/old.png" }, { autoPurge: true, retentionDays: 0 });
    await store.saveWork("anon_1", { titulo: "Novo", frase: "y", imageUrl: "https://example.invalid/new.png" }, { autoPurge: true, retentionDays: 90 });
    await store.saveWork("par_1", { titulo: "Pai", frase: "z", imageUrl: "https://example.invalid/p.png" });
    const purged = await store.purgeExpiredWorks("anon_1", new Date(Date.now() + 1000));
    assert.equal(purged, 1);
    assert.equal((await store.listWorks("anon_1")).length, 1);
    assert.equal((await store.listWorks("anon_1"))[0].titulo, "Novo");
    assert.equal(await store.purgeExpiredWorks("par_1", new Date(Date.now() + 365 * 86400000)), 0, "parent works are never purged");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Integration: transform flow safety layers
// ===========================================================================

let server;
let baseUrl;
let mockServer;
let falCalls = 0;

async function req(method, urlPath, { body, headers = {} } = {}) {
  const res = await fetch(baseUrl + urlPath, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_e) { /* non-JSON */ }
  return { status: res.status, data, text };
}

async function signedInParent(email) {
  const signup = await req("POST", "/api/parent/signup", { body: { email } });
  assert.equal(signup.status, 200);
  const token = require("../server.js").accounts._testGetMagicToken(email);
  assert.ok(token);
  const verify = await req("POST", "/api/parent/verify", { body: { token } });
  assert.equal(verify.status, 200);
  return verify.data.sessionToken;
}

const cleanVision = () => ({
  titulo: "Meu sol amarelo",
  frase: "Olha que sol lindo!",
  prompt_imagem: "A photorealistic yellow sun over green grass.",
});

before(async () => {
  mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      falCalls += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ images: [{ url: "https://example.invalid/generated.png" }] }));
    });
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  process.env.FAL_ENDPOINT = `http://127.0.0.1:${mockServer.address().port}/fal-ai/flux-2-pro/edit`;

  const { app } = require("../server.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => mockServer.close(resolve));
  fs.rmSync(path.join(__dirname, "..", "data"), { recursive: true, force: true });
});

beforeEach(() => {
  falCalls = 0;
  delete process.env.OUTPUT_SAFETY_CHECK;
  delete process.env.OUTPUT_SAFETY_STUB_RESULT;
  delete process.env.BLOCKLIST_EXTRA_TERMS;
  const srv = require("../server.js");
  srv._testReset();
  srv._testSetVisionOverride(cleanVision);
});

test("integration: blocklisted title fails friendly, before any fal call, no quota charged", async () => {
  const srv = require("../server.js");
  srv._testSetVisionOverride(() => ({
    titulo: "Meu desenho",
    frase: "que porra é essa",
    prompt_imagem: "A photorealistic scene.",
  }));
  const r = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "blocked-account" },
  });
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "failed");
  assert.equal(r.data.message, "Ops, a mágica falhou. Tente de novo!");
  assert.equal(falCalls, 0, "blocklist hit must not call fal");

  // Quota untouched: a clean transform afterwards still has 4 remaining.
  srv._testSetVisionOverride(cleanVision);
  const ok = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "blocked-account" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.remaining, 4);

  const blocked = srv.audit.getEvents().find((e) => e.action === "transform_blocked_blocklist");
  assert.ok(blocked, "blocklist hit must be audited");
  assert.equal(blocked.outcome, "blocked");
  assert.equal(blocked.cost_usd, 0);
  assert.match(blocked.reason, /blocklist:profanity/);
  assert.ok(!JSON.stringify(blocked).includes("porra"), "matched word must not be in the audit log");
  // Nothing was saved for the blocked attempt.
  const list = await req("GET", "/api/gallery", { headers: {} });
  assert.equal(list.status, 401); // anonymous has no gallery endpoint without a parent
});

test("integration: output-safety fail blocks showing/saving, charges no quota (fal already ran)", async () => {
  process.env.OUTPUT_SAFETY_STUB_RESULT = "fail";
  const r = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "safety-account" },
  });
  assert.equal(r.status, 502);
  assert.equal(r.data.error, "failed");
  assert.equal(falCalls, 1, "the image was generated before the output check ran");
  assert.ok(!r.data.imageUrl, "blocked image must not be returned");

  delete process.env.OUTPUT_SAFETY_STUB_RESULT;
  const ok = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "safety-account" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.remaining, 4, "blocked output must not consume quota");

  const blocked = require("../server.js").audit.getEvents().find((e) => e.action === "transform_blocked_output_safety");
  assert.ok(blocked);
  assert.equal(blocked.cost_usd, 0.045, "generation already happened, so the cost is recorded");
});

test("integration: OUTPUT_SAFETY_CHECK=off lets a transform through (debug only)", async () => {
  process.env.OUTPUT_SAFETY_CHECK = "off";
  const r = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "off-account" },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.imageUrl, "https://example.invalid/generated.png");
});

test("integration: successful transform is audited with a hash, no raw id, and a work id", async () => {
  const r = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "audited-account" },
  });
  assert.equal(r.status, 200);
  assert.ok(r.data.workId);
  const events = require("../server.js").audit.getEvents();
  assert.equal(events.length, 1);
  const e = events[0];
  assert.equal(e.action, "transform_success");
  assert.equal(e.outcome, "success");
  assert.equal(e.cost_usd, 0.045);
  assert.equal(e.work_id, r.data.workId);
  assert.match(e.account_id_hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(e).includes("audited-account"));
});

test("integration: gallery delete is audited, and saved works carry retention records", async () => {
  const session = await signedInParent("auditoria@example.com");
  const t = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-parent-session": session },
  });
  assert.equal(t.status, 200);

  const list = await req("GET", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(list.data.works.length, 1);
  assert.equal(list.data.works[0].retention.policy, "parent_controlled");
  assert.equal(list.data.works[0].retention.deleteAfter, null);

  const del = await req("DELETE", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(del.status, 200);
  assert.equal(del.data.deleted, 1);
  const wiped = require("../server.js").audit.getEvents().find((e) => e.action === "gallery_deleted");
  assert.ok(wiped, "gallery wipe must be audited");
  assert.equal(wiped.outcome, "success");

  // Anonymous transform: auto-purge retention on the stored work.
  const anon = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-account-id": "anon-retention" },
  });
  assert.equal(anon.status, 200);
  const stored = await require("../server.js").storage.listWorks("anon-retention");
  assert.equal(stored.length, 1);
  assert.equal(stored[0].retention.policy, "auto_purge");
  assert.ok(stored[0].retention.deleteAfter > stored[0].retention.createdAt);
});
