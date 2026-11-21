/* Rabisco Mágico — GET /api/quota tests.
 *
 * Run: npm test
 *
 * The quota endpoint powers the "free transforms left" line under the
 * Transform button. Same mock-fal harness as test/server.test.js: the
 * fal.ai call is mocked by a local HTTP server, so these tests never
 * call the real fal.ai API and never spend money.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const zlib = require("node:zlib");

const TEST_KEY = "test-fake-key-do-not-use";
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

const inkDrawing = () => makePng(512, 512, (x, y) => (x === 10 && y === 10 ? [255, 59, 48] : [255, 255, 255]));

let mockServer;
let server;
let baseUrl;

async function getQuota(account) {
  const res = await fetch(baseUrl + "/api/quota", {
    headers: account ? { "x-account-id": account } : {},
  });
  return { status: res.status, data: await res.json() };
}

before(async () => {
  mockServer = http.createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ images: [{ url: "https://example.invalid/generated.png" }], seed: 1 }));
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
});

beforeEach(() => {
  require("../server.js")._testReset();
});

test("quota starts at 5 free, 0 used, 5 left", async () => {
  const { status, data } = await getQuota("quota-ui-fresh");
  assert.equal(status, 200);
  assert.deepEqual(data, { ok: true, freeTotal: 5, used: 0, left: 5 });
});

test("quota counts successful transforms and never leaks the key", async () => {
  for (let i = 0; i < 2; i++) {
    const res = await fetch(baseUrl + "/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-account-id": "quota-ui-used" },
      body: JSON.stringify({ image: inkDrawing(), language: "pt" }),
    });
    assert.equal(res.status, 200);
  }
  const { status, data } = await getQuota("quota-ui-used");
  assert.equal(status, 200);
  assert.deepEqual(data, { ok: true, freeTotal: 5, used: 2, left: 3 });
  assert.ok(!JSON.stringify(data).includes(TEST_KEY));
});

test("quota is per account", async () => {
  await getQuota("quota-ui-a");
  const { data } = await getQuota("quota-ui-b");
  assert.deepEqual(data, { ok: true, freeTotal: 5, used: 0, left: 5 });
});
