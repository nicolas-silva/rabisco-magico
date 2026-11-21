/* Rabisco Mágico — server tests.
 *
 * Run:  npm test
 *
 * node:test only, no framework. The fal.ai HTTP call is mocked by a local
 * HTTP server (FAL_ENDPOINT env override) — these tests never call the
 * real fal.ai API and never spend money. The API key used here is a fake
 * test value; it must never appear in any response body.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const zlib = require("node:zlib");
const { spawn } = require("node:child_process");
const path = require("node:path");

const TEST_KEY = "test-fake-key-do-not-use";
let mockPort;
let mockServer;
let mockCalls = [];
let mockMode = "ok"; // "ok" | "delay"

process.env.FAL_KEY = TEST_KEY;

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

// Minimal 8-bit RGB PNG encoder (filter 0 on every row).
function makePng(width, height, pixel) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return "data:image/png;base64," + png.toString("base64");
}

const WHITE = () => [255, 255, 255];
const blankDrawing = () => makePng(512, 512, WHITE);
const inkDrawing = () => makePng(512, 512, (x, y) => (x === 10 && y === 10 ? [255, 59, 48] : [255, 255, 255]));

let server;
let baseUrl;

async function postTransform(body, account) {
  const res = await fetch(baseUrl + "/api/transform", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(account ? { "x-account-id": account } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      mockCalls.push({ auth: req.headers.authorization || "", body: raw });
      const reply = () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ images: [{ url: "https://example.invalid/generated.png" }], seed: 1 }));
      };
      if (mockMode === "delay") setTimeout(reply, 300);
      else reply();
    });
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  mockPort = mockServer.address().port;
  process.env.FAL_ENDPOINT = `http://127.0.0.1:${mockPort}/fal-ai/flux-2-pro/edit`;

  let app;
  try {
    ({ app } = require("../server.js"));
    server = await new Promise((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
  } catch (e) {
    // Don't leave the mock server listening or the test runner hangs.
    await new Promise((resolve) => mockServer.close(resolve));
    throw e;
  }
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => mockServer.close(resolve));
});

beforeEach(() => {
  mockCalls = [];
  mockMode = "ok";
  require("../server.js")._testReset();
});

test("happy path: a real drawing transforms and counts against quota", async () => {
  const { status, data } = await postTransform({ image: inkDrawing(), language: "pt" }, "happy");
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.imageUrl, "https://example.invalid/generated.png");
  assert.equal(data.remaining, 4);
  assert.ok(data.titulo && data.frase);
  assert.equal(mockCalls.length, 1);
  // The key goes to fal.ai server-side only, as an Authorization header.
  assert.equal(mockCalls[0].auth, "Key " + TEST_KEY);
  // ...and never comes back in the response.
  assert.ok(!JSON.stringify(data).includes(TEST_KEY));
});

test("rejects an empty (all-white) drawing before any AI call", async () => {
  const { status, data } = await postTransform({ image: blankDrawing(), language: "pt" }, "empty-1");
  assert.equal(status, 400);
  assert.equal(data.error, "empty");
  assert.equal(data.message, "Desenhe alguma coisa primeiro!");
  assert.equal(mockCalls.length, 0);
});

test("rejects an untouched board reported as strokeCount 0", async () => {
  const { status, data } = await postTransform(
    { image: inkDrawing(), language: "en", strokeCount: 0 },
    "empty-2"
  );
  assert.equal(status, 400);
  assert.equal(data.error, "empty");
  assert.equal(data.message, "Draw something first!");
  assert.equal(mockCalls.length, 0);
});

test("rejects a missing or invalid image", async () => {
  for (const body of [{ language: "pt" }, { image: "not-a-data-url", language: "pt" }, { image: "data:image/png;base64,!!!", language: "pt" }]) {
    const { status, data } = await postTransform(body, "invalid");
    assert.equal(status, 400);
    assert.equal(data.error, "empty");
  }
  assert.equal(mockCalls.length, 0);
});

test("returns the friendly error when FAL_KEY is absent, without calling fal", async (t) => {
  const port = 18700 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, FAL_KEY: "", PORT: String(port), FAL_ENDPOINT: process.env.FAL_ENDPOINT },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => child.kill());
  const childBase = `http://127.0.0.1:${port}`;
  // Wait for the child to answer /api/health.
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
  const callsBefore = mockCalls.length;
  const res = await fetch(childBase + "/api/transform", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-account-id": "no-key" },
    body: JSON.stringify({ image: inkDrawing(), language: "pt" }),
  });
  const data = await res.json();
  assert.equal(res.status, 503);
  assert.equal(data.error, "not_configured");
  assert.equal(data.message, "A mágica ainda não está ligada. Peça para um adulto verificar.");
  assert.ok(!JSON.stringify(data).includes(TEST_KEY));
  assert.equal(mockCalls.length, callsBefore, "fal must not be called without a key");
});

test("enforces one transform in flight per account", async () => {
  mockMode = "delay";
  const body = { image: inkDrawing(), language: "pt" };
  const [a, b] = await Promise.all([
    postTransform(body, "busy-account"),
    postTransform(body, "busy-account"),
  ]);
  const statuses = [a.status, b.status].sort();
  assert.deepEqual(statuses, [200, 429]);
  const busy = a.status === 429 ? a : b;
  assert.equal(busy.data.error, "busy");
  // After the first finishes, the account can transform again.
  const c = await postTransform(body, "busy-account");
  assert.equal(c.status, 200);
});

test("quota: 5 free transforms, then the 6th is blocked", async () => {
  for (let i = 0; i < 5; i++) {
    const r = await postTransform({ image: inkDrawing(), language: "pt" }, "quota-account");
    assert.equal(r.status, 200);
    assert.equal(r.data.remaining, 4 - i);
  }
  const blocked = await postTransform({ image: inkDrawing(), language: "pt" }, "quota-account");
  assert.equal(blocked.status, 402);
  assert.equal(blocked.data.error, "quota");
  assert.equal(mockCalls.length, 5, "blocked transforms must not call fal");
});

test("health endpoint never leaks the key", async () => {
  const res = await fetch(baseUrl + "/api/health");
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.falConfigured, true);
  assert.ok(!JSON.stringify(data).includes(TEST_KEY));
});
