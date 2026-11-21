/* Rabisco Mágico — Batch 5 quality & ops tests.
 *
 * Run:  npm test
 *
 * Covers lib/logger.js (scrubbing — no keys, emails, titles, images or
 * drawings ever reach a log line), lib/errors.js (capture, dedupe,
 * sanitising, ring-buffer cap) and the GET /api/admin/errors endpoint
 * (admin token required, same token as the cost dashboard) plus the
 * X-Request-Id header on every response. No real API is called; the
 * transform failure below is the NOT_CONFIGURED path (no FAL_KEY).
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const zlib = require("node:zlib");

process.env.ADMIN_TOKEN = "test-admin-token-do-not-use";
delete process.env.FAL_KEY;

const logger = require("../lib/logger");
const errorMonitor = require("../lib/errors");

// Minimal 8-bit RGB PNG encoder (filter 0), copied pattern from server.test.js.
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
const nonBlankDrawing = () => makePng(8, 8, (x, y) => (x === 0 && y === 0 ? [255, 0, 0] : [255, 255, 255]));

let server;
let baseUrl;

before(async () => {
  const { app } = require("../server.js");
  server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  require("../server.js")._testReset();
});

// ---------------------------------------------------------------------------
// 1. Structured logging: scrubbing
// ---------------------------------------------------------------------------
test("logger: scrub keeps a server-generated requestId intact (UUIDs are not secrets)", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  const out = logger.scrub({ requestId: uuid, event: "http_request" });
  assert.equal(out.requestId, uuid);
});

test("logger: scrub drops keys, tokens, emails, titles, phrases and images", () => {
  const out = logger.scrub({
    event: "transform_failed",
    code: "FAL_FAILED",
    status: 502,
    apiKey: "sk-test-1234567890abcdefghij",
    token: "abcdef0123456789abcdef0123456789",
    email: "parent@example.com",
    titulo: "Meu Sol",
    frase: "Olha o sol!",
    imageUrl: "https://example.com/generated.png",
    image: "data:image/png;base64,iVBORw0KGgo=",
    requestId: "req-123",
  });
  assert.equal(out.event, "transform_failed");
  assert.equal(out.code, "FAL_FAILED");
  assert.equal(out.status, 502);
  assert.equal(out.requestId, "req-123");
  for (const key of ["apiKey", "token", "email", "titulo", "frase", "imageUrl", "image"]) {
    assert.equal(key in out, false, key + " leaked into the log fields");
  }
  assert.equal(JSON.stringify(out).includes("parent@example.com"), false);
  assert.equal(JSON.stringify(out).includes("Meu Sol"), false);
});

test("logger: scrub redacts a long opaque value even under an innocent key", () => {
  const out = logger.scrub({ note: "fal.ai request failed: " + "a".repeat(40) });
  assert.equal(out.note.includes("a".repeat(40)), false);
  assert.equal(out.note.includes("[redacted-long-token]"), true);
});

test("logger: scrub drops data-URI values", () => {
  const out = logger.scrub({ detail: "data:image/png;base64,AAAA" });
  assert.equal(out.detail, "[redacted-image]");
});

// ---------------------------------------------------------------------------
// 2. Error monitor: capture, dedupe, sanitise, cap
// ---------------------------------------------------------------------------
test("errors: capture stores code/route/requestId and never the raw object", () => {
  const err = new Error("fal.ai request failed: 500 boom");
  err.code = "FAL_FAILED";
  const entry = errorMonitor.capture(err, { route: "POST /api/transform", method: "POST", requestId: "req-1" });
  assert.equal(entry.code, "FAL_FAILED");
  assert.equal(entry.route, "POST /api/transform");
  assert.equal(entry.requestId, "req-1");
  assert.equal(entry.count, 1);
  assert.equal(errorMonitor.count(), 1);
  assert.equal(JSON.stringify(errorMonitor.getErrors()).includes("boom"), true);
});

test("errors: identical repeats collapse into one entry with a count", () => {
  const err = new Error("same failure");
  err.code = "FAL_FAILED";
  errorMonitor.capture(err, { route: "POST /api/transform" });
  errorMonitor.capture(err, { route: "POST /api/transform" });
  errorMonitor.capture(err, { route: "POST /api/transform" });
  const list = errorMonitor.getErrors();
  assert.equal(list.length, 1);
  assert.equal(list[0].count, 3);
  assert.equal(errorMonitor.count(), 3);
});

test("errors: a pasted-looking secret in the message is redacted", () => {
  const err = new Error("auth failed for key " + "k".repeat(40));
  const entry = errorMonitor.capture(err, { route: "POST /api/checkout/:product" });
  assert.equal(entry.message.includes("k".repeat(40)), false);
});

test("errors: ring buffer caps at MAX_ERRORS", () => {
  for (let i = 0; i < errorMonitor.MAX_ERRORS + 5; i++) {
    const err = new Error("distinct failure " + i);
    err.code = "ERR_" + i;
    errorMonitor.capture(err, { route: "POST /api/transform" });
  }
  assert.equal(errorMonitor.getErrors().length, errorMonitor.MAX_ERRORS);
});

test("errors: capture never throws, even for junk input", () => {
  assert.doesNotThrow(() => errorMonitor.capture(null, null));
  assert.doesNotThrow(() => errorMonitor.capture(undefined, { route: 123 }));
  assert.doesNotThrow(() => errorMonitor.capture({ weird: true }, {}));
});

// ---------------------------------------------------------------------------
// 3. Endpoint + request ids
// ---------------------------------------------------------------------------
test("admin/errors: 401 without the admin token, 200 with it, empty at first", async () => {
  const noAuth = await fetch(baseUrl + "/api/admin/errors");
  assert.equal(noAuth.status, 401);
  const withAuth = await fetch(baseUrl + "/api/admin/errors", {
    headers: { "x-admin-token": "test-admin-token-do-not-use" },
  });
  assert.equal(withAuth.status, 200);
  const data = await withAuth.json();
  assert.equal(data.ok, true);
  assert.equal(data.count, 0);
  assert.deepEqual(data.errors, []);
});

test("http: every response carries an X-Request-Id header", async () => {
  const res = await fetch(baseUrl + "/api/health");
  assert.equal(res.status, 200);
  const id = res.headers.get("x-request-id");
  assert.ok(id && id.length >= 8, "missing X-Request-Id");
});

test("transform failure is captured by the error monitor (NOT_CONFIGURED)", async () => {
  const res = await fetch(baseUrl + "/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-account-id": "anon-quality-ops" },
    body: JSON.stringify({ image: nonBlankDrawing(), language: "pt", strokeCount: 3 }),
  });
  assert.equal(res.status, 503); // no FAL_KEY in this test process
  const data = await res.json();
  assert.equal(data.error, "not_configured");
  const list = await (await fetch(baseUrl + "/api/admin/errors", {
    headers: { "x-admin-token": "test-admin-token-do-not-use" },
  })).json();
  assert.equal(list.count, 1);
  assert.equal(list.errors[0].code, "NOT_CONFIGURED");
  assert.equal(list.errors[0].route, "POST /api/transform");
  assert.ok(list.errors[0].requestId, "captured error has no requestId to join with the log");
});
