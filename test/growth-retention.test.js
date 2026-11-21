/* Rabisco Mágico — tests for Batch 4 (growth & retention):
 * share-card generator, gallery favourites + search, referral stub,
 * seasonal prompts + email templates docs.
 *
 * Run:  npm test
 *
 * node:test only, no framework. fal.ai is mocked by a local HTTP
 * server — these tests never call a real API, never spend money,
 * and use fake test keys only.
 */
"use strict";

const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const TEST_KEY = "test-fake-key-do-not-use";

process.env.FAL_KEY = TEST_KEY;

const shareCard = require("../lib/share-card");

// --- Minimal PNG encoder (same shape as the other test files) --------------
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
function makePngBuffer(width, height, pixel) {
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
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
function makePng(width, height, pixel) {
  return "data:image/png;base64," + makePngBuffer(width, height, pixel).toString("base64");
}
const inkDrawing = () => makePng(512, 512, (x, y) => (x === 10 && y === 10 ? [255, 59, 48] : [255, 255, 255]));
const redScene = () => makePng(64, 64, () => [200, 30, 40]);
const blueThumb = () => makePng(32, 32, () => [30, 60, 200]);

function pixelOf(decoded, x, y) {
  const o = (y * decoded.width + x) * 4;
  return [decoded.data[o], decoded.data[o + 1], decoded.data[o + 2]];
}

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
  try { data = JSON.parse(text); } catch (_e) { /* non-JSON body */ }
  return { status: res.status, data, text };
}

async function reqBuffer(method, urlPath, { body, headers = {} } = {}) {
  const res = await fetch(baseUrl + urlPath, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}

async function signedInParent(email) {
  const signup = await req("POST", "/api/parent/signup", { body: { email } });
  assert.equal(signup.status, 200, "signup failed: " + JSON.stringify(signup.data));
  const token = require("../server.js").accounts._testGetMagicToken(email);
  assert.ok(token, "no magic token issued");
  const verify = await req("POST", "/api/parent/verify", { body: { token } });
  assert.equal(verify.status, 200);
  return verify.data.sessionToken;
}

before(async () => {
  mockServer = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.url === "/generated.png") {
        const buf = makePngBuffer(64, 64, () => [200, 30, 40]);
        res.writeHead(200, { "Content-Type": "image/png", "Content-Length": buf.length });
        res.end(buf);
      } else {
        falCalls += 1;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ images: [{ url: `http://127.0.0.1:${mockServer.address().port}/generated.png` }] }));
      }
    });
  });
  await new Promise((resolve) => mockServer.listen(0, "127.0.0.1", resolve));
  const port = mockServer.address().port;
  process.env.FAL_ENDPOINT = `http://127.0.0.1:${port}/fal-ai/flux-2-pro/edit`;

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
  delete process.env.KILL_SWITCH;
  require("../server.js")._testReset();
});

// ---------------------------------------------------------------------------
// 1. Share-card generator
// ---------------------------------------------------------------------------
test("share-card: builds a 1080x1350 PNG with sky background, white frame, scene and tilted thumb", () => {
  const png = shareCard.generateShareCard({
    image: redScene(),
    thumb: blueThumb(),
    titulo: "Sol Amarelo",
    frase: "Olha so o que virou!",
    language: "pt",
  });
  assert.ok(Buffer.isBuffer(png));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const card = shareCard.decodePng(png);
  assert.equal(card.width, 1080);
  assert.equal(card.height, 1350);
  assert.deepEqual(pixelOf(card, 10, 10), [43, 155, 224]); // sky background
  assert.deepEqual(pixelOf(card, 52, 52), [255, 201, 60]); // decorative sun
  assert.deepEqual(pixelOf(card, 95, 175), [255, 255, 255]); // white frame
  assert.deepEqual(pixelOf(card, 300, 400), [200, 30, 40]); // generated scene
  assert.deepEqual(pixelOf(card, 860, 1010), [30, 60, 200]); // tilted thumb centre
});

test("share-card: works without a thumb, localises the footer, rejects bad images", () => {
  const noThumb = shareCard.generateShareCard({ image: redScene(), titulo: "X", language: "en" });
  const card = shareCard.decodePng(noThumb);
  assert.equal(card.width, shareCard.CARD_WIDTH);
  assert.equal(card.height, shareCard.CARD_HEIGHT);

  const pt = shareCard.generateShareCard({ image: redScene(), titulo: "Sol", language: "pt" });
  const en = shareCard.generateShareCard({ image: redScene(), titulo: "Sol", language: "en" });
  const es = shareCard.generateShareCard({ image: redScene(), titulo: "Sol", language: "es" });
  assert.ok(!pt.equals(en), "footer must differ by language");
  assert.ok(!pt.equals(es));
  assert.equal(shareCard.footerText("pt"), "Feito com Rabisco Mágico");
  assert.equal(shareCard.footerText("en"), "Made with Rabisco Mágico");
  assert.equal(shareCard.footerText("es"), "Hecho con Rabisco Mágico");

  assert.throws(() => shareCard.generateShareCard({ image: null }), (e) => e.code === "MISSING_IMAGE");
  assert.throws(() => shareCard.generateShareCard({ image: "data:image/png;base64,AAAA" }), (e) => e.code === "INVALID_IMAGE");
  assert.throws(() => shareCard.generateShareCard({ image: "https://example.com/x.png" }), (e) => e.code === "INVALID_IMAGE");
});

test("share-card endpoint: POST returns the PNG, accepts an imageUrl, rejects bad input", async () => {
  const ok = await reqBuffer("POST", "/api/share-card", {
    body: { image: redScene(), thumb: blueThumb(), titulo: "Sol", frase: "Oi!", language: "pt" },
  });
  assert.equal(ok.status, 200);
  assert.equal(shareCard.decodePng(ok.buf).width, 1080);

  // imageUrl path: the server fetches the generated PNG itself.
  const viaUrl = await reqBuffer("POST", "/api/share-card", {
    body: { imageUrl: `http://127.0.0.1:${mockServer.address().port}/generated.png`, titulo: "Sol", language: "en" },
  });
  assert.equal(viaUrl.status, 200);
  assert.deepEqual(pixelOf(shareCard.decodePng(viaUrl.buf), 300, 400), [200, 30, 40]);

  const bad = await req("POST", "/api/share-card", { body: { image: "not-a-png" } });
  assert.equal(bad.status, 400);
  assert.equal(bad.data.error, "invalid_image");
  const missing = await req("POST", "/api/share-card", { body: {} });
  assert.equal(missing.status, 400);
});

// ---------------------------------------------------------------------------
// 3. Gallery favourites + search
// ---------------------------------------------------------------------------
test("gallery: favourite toggle puts the older work first, search filters by title (accents ignored)", async () => {
  const session = await signedInParent("galeria4@example.com");
  const srv = require("../server.js");
  const titles = ["Coracao Vermelho", "Gato Azul"];
  const workIds = [];
  for (const title of titles) {
    srv._testSetVisionOverride(() => ({
      titulo: title,
      frase: "frase de " + title,
      prompt_imagem: "A photorealistic scene.",
    }));
    const t = await req("POST", "/api/transform", {
      body: { image: inkDrawing(), language: "pt" },
      headers: { "x-parent-session": session },
    });
    assert.equal(t.status, 200, "transform failed: " + JSON.stringify(t.data));
    workIds.push(t.data.workId);
  }
  srv._testSetVisionOverride(null);

  // Newest first by default: Gato Azul first.
  let list = await req("GET", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(list.data.works[0].titulo, "Gato Azul");
  assert.equal(list.data.works[0].favourite, false);

  // Favourite the OLDER work (Coracao Vermelho): it jumps to the top.
  const fav = await req("PATCH", `/api/gallery/${workIds[0]}/favourite`, {
    body: { favourite: true },
    headers: { "x-parent-session": session },
  });
  assert.equal(fav.status, 200);
  assert.equal(fav.data.favourite, true);
  list = await req("GET", "/api/gallery", { headers: { "x-parent-session": session } });
  assert.equal(list.data.works[0].titulo, "Coracao Vermelho");
  assert.equal(list.data.works[0].favourite, true);

  // Search: case-insensitive, accent-insensitive, matches title.
  const byTitle = await req("GET", "/api/gallery?q=gato", { headers: { "x-parent-session": session } });
  assert.equal(byTitle.data.works.length, 1);
  assert.equal(byTitle.data.works[0].titulo, "Gato Azul");
  const byAccent = await req("GET", "/api/gallery?q=CORACAO", { headers: { "x-parent-session": session } });
  assert.equal(byAccent.data.works.length, 1);
  const none = await req("GET", "/api/gallery?q=dinossauro", { headers: { "x-parent-session": session } });
  assert.equal(none.data.works.length, 0);

  // Unfavourite again, and errors: unknown work 404, no session 401.
  const unfav = await req("PATCH", `/api/gallery/${workIds[0]}/favourite`, {
    body: { favourite: false },
    headers: { "x-parent-session": session },
  });
  assert.equal(unfav.status, 200);
  assert.equal(unfav.data.favourite, false);
  const missing = await req("PATCH", "/api/gallery/work_nope/favourite", {
    body: { favourite: true },
    headers: { "x-parent-session": session },
  });
  assert.equal(missing.status, 404);
  const anon = await req("PATCH", `/api/gallery/${workIds[0]}/favourite`, { body: { favourite: true } });
  assert.equal(anon.status, 401);
});

// ---------------------------------------------------------------------------
// 4. Referral / invite-code stub
// ---------------------------------------------------------------------------
test("referrals: one code per parent, redeem grants a bonus transform to both sides, then it is spent", async () => {
  const sessionA = await signedInParent("indicador@example.com");
  const sessionB = await signedInParent("convidado@example.com");

  const codeRes = await req("GET", "/api/referral/code", { headers: { "x-parent-session": sessionA } });
  assert.equal(codeRes.status, 200);
  assert.match(codeRes.data.code, /^MAGICO-[A-Z2-9]{6}$/);
  assert.equal(codeRes.data.redemptions, 0);
  const again = await req("GET", "/api/referral/code", { headers: { "x-parent-session": sessionA } });
  assert.equal(again.data.code, codeRes.data.code, "code must be stable per account");
  const anon = await req("GET", "/api/referral/code");
  assert.equal(anon.status, 401);

  // Own code, unknown code, then a real redemption.
  const own = await req("POST", "/api/referral/redeem", {
    body: { code: codeRes.data.code },
    headers: { "x-parent-session": sessionA },
  });
  assert.equal(own.status, 400);
  assert.equal(own.data.error, "own_code");
  const bad = await req("POST", "/api/referral/redeem", {
    body: { code: "MAGICO-XXXXXX" },
    headers: { "x-parent-session": sessionB },
  });
  assert.equal(bad.status, 404);
  assert.equal(bad.data.error, "invalid_code");

  const redeem = await req("POST", "/api/referral/redeem", {
    body: { code: codeRes.data.code },
    headers: { "x-parent-session": sessionB },
  });
  assert.equal(redeem.status, 200);
  assert.equal(redeem.data.bonusGranted, 1);

  // Second redemption by the same parent is rejected; both sides hold +1.
  const twice = await req("POST", "/api/referral/redeem", {
    body: { code: codeRes.data.code },
    headers: { "x-parent-session": sessionB },
  });
  assert.equal(twice.status, 409);
  assert.equal(twice.data.error, "already_redeemed");
  for (const session of [sessionA, sessionB]) {
    const me = await req("GET", "/api/parent/me", { headers: { "x-parent-session": session } });
    assert.equal(me.data.account.bonusTransforms, 1);
  }

  // The bonus buys a 6th transform past the 5-free quota (5 free + 1 bonus).
  for (let i = 0; i < 6; i++) {
    const r = await req("POST", "/api/transform", {
      body: { image: inkDrawing(), language: "pt" },
      headers: { "x-parent-session": sessionB },
    });
    assert.equal(r.status, 200, "transform " + i + " failed: " + JSON.stringify(r.data));
  }
  const seventh = await req("POST", "/api/transform", {
    body: { image: inkDrawing(), language: "pt" },
    headers: { "x-parent-session": sessionB },
  });
  assert.equal(seventh.status, 402);
  assert.equal(falCalls, 6);
});

// ---------------------------------------------------------------------------
// 2 + 5. Docs: seasonal prompts and email templates
// ---------------------------------------------------------------------------
test("docs: seasonal prompts cover 12 months with pt-BR and English ideas", () => {
  const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "seasonal-prompts.md"), "utf8");
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  for (const month of months) assert.ok(doc.includes("## " + month), "missing month: " + month);
  assert.ok(doc.includes("Desenhe um boneco de neve"));
  assert.ok(doc.includes("Draw a snowman"));
});

test("docs: email templates cover welcome, first-transform, winback and upgrade in pt-BR and English", () => {
  const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "email-templates.md"), "utf8");
  for (const heading of [
    "Welcome after signup — pt-BR",
    "Welcome after signup — English",
    "First-transform encouragement — pt-BR",
    "First-transform encouragement — English",
    "Winback after 14 days inactive — pt-BR",
    "Winback after 14 days inactive — English",
    "Upgrade nudge — pt-BR",
    "Upgrade nudge — English",
  ]) {
    assert.ok(doc.includes(heading), "missing template: " + heading);
  }
  assert.ok(doc.includes("{{app_link}}"));
  assert.ok(doc.includes("14 dias"));
  assert.ok(doc.toLowerCase().includes("no email is sent"));
});
