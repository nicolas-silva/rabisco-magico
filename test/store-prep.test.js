/* Rabisco Mágico — tests for Batch 6 (store prep, no submission):
 * Capacitor config draft, app-store metadata drafts (PT/EN), screenshot
 * checklist, Kids/Families store-compliance checklist.
 *
 * Run:  npm test
 *
 * node:test only, no framework. These tests read the draft files and
 * check they are internally consistent — the Capacitor config parses
 * and names a real webDir, every character-count annotation in the
 * metadata doc matches the actual string and its store limit, the
 * screenshot doc names the required sizes, and the compliance doc
 * carries the not-legal-advice warning. No store is contacted, no
 * money is spent, no real API is called, and no real children's
 * drawings are used.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// --- 1. Capacitor config draft --------------------------------------------

test("capacitor draft: parses, names the app, and points at public/", () => {
  const raw = read("capacitor.config.draft.json");
  const cfg = JSON.parse(raw);

  assert.match(cfg._DRAFT, /DRAFT/, "draft must be marked DRAFT");
  assert.ok(Array.isArray(cfg._notes) && cfg._notes.length > 0, "draft notes must exist");
  assert.match(cfg.appId, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, "appId must be reverse-domain");
  assert.equal(cfg.appName, "Rabisco Mágico");
  assert.equal(cfg.webDir, "public");
  assert.ok(fs.existsSync(path.join(ROOT, cfg.webDir, "index.html")), "webDir must contain the app");
});

test("capacitor draft: live-server placeholder, never a real URL or key", () => {
  const cfg = JSON.parse(read("capacitor.config.draft.json"));
  assert.match(cfg.server.url, /__DEPLOYED_BASE_URL__/, "server.url must still be a placeholder");
  assert.equal(cfg.server.cleartext, false, "cleartext must stay off");
  const raw = read("capacitor.config.draft.json");
  assert.doesNotMatch(raw, /sk_(live|test)_[A-Za-z0-9]{8,}/, "no Stripe key in the draft");
  assert.doesNotMatch(raw, /FAL_KEY=\S+/, "no fal.ai key in the draft");
});

// --- 2. Store metadata drafts (PT/EN) --------------------------------------

test("store metadata: every character-count annotation is true and within its limit", () => {
  const doc = read("docs/store-metadata.md");
  const found = [...doc.matchAll(/"([^"]+)" — (\d+)\/(\d+) characters/g)];
  assert.ok(found.length >= 10, `expected >=10 annotated fields, found ${found.length}`);
  for (const [, value, stated, limit] of found) {
    const actual = [...value].length;
    assert.equal(actual, Number(stated), `count wrong for ${JSON.stringify(value)}`);
    assert.ok(actual <= Number(limit), `${JSON.stringify(value)} exceeds its ${limit} limit`);
  }
});

test("store metadata: full descriptions exist, are under 4000 chars, and state no ads", () => {
  const doc = read("docs/store-metadata.md");
  const blocks = [...doc.matchAll(/```text\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 2, "expected exactly two full descriptions (PT + EN)");
  for (const block of blocks) {
    assert.ok(block.length > 500, "description looks truncated");
    assert.ok(block.length <= 4000, `description is ${block.length} chars, over the 4000 limit`);
  }
  assert.match(blocks[0], /Sem anúncios/, "PT description must state no ads");
  assert.match(blocks[0], /A\$7,99/, "PT description must state the Family price");
  assert.match(blocks[1], /No ads/, "EN description must state no ads");
  assert.match(blocks[1], /A\$7\.99/, "EN description must state the Family price");
  assert.match(doc, /Teacher Approved/, "doc must note the Teacher Approved position");
});

// --- 3. Screenshot checklist ------------------------------------------------

test("screenshot checklist: names the required Apple and Google Play sizes", () => {
  const doc = read("docs/store-screenshots.md");
  for (const size of ["1206 × 2622", "1290 × 2796", "2048 × 2732", "1080 × 1920", "1024 × 500", "512 × 512"]) {
    assert.ok(doc.includes(size), `screenshot doc must name ${size}`);
  }
  assert.match(doc, /synthetic/i, "screenshots must use synthetic/test drawings, never real kids' drawings");
  assert.match(doc, /Never use a real child/i, "kid-safe rules must forbid real children's drawings");
});

// --- 4. Kids/Families store-compliance checklist -----------------------------

test("kids/families compliance: not legal advice, lawyer sign-off, and the ads rules", () => {
  const doc = read("docs/store-kids-compliance.md");
  assert.match(doc, /not legal advice/i, "checklist must say it is not legal advice");
  assert.match(doc, /lawyer must sign off/i, "checklist must require lawyer sign-off");
  assert.match(doc, /No third-party advertising/i, "Apple Kids ads rule must be stated");
  assert.match(doc, /certified ad SDKs/i, "Google Play certified-SDK rule must be stated");
  assert.match(doc, /no personalised ads/i, "personalised-ads ban must be stated");
  assert.match(doc, /parental gate/i, "parental gate must be covered");
});

// --- 5. No secrets in any Batch 6 file, and no .env in the repo -------------

test("store-prep files contain no real secrets and the repo has no .env", () => {
  const files = [
    "capacitor.config.draft.json",
    "docs/store-metadata.md",
    "docs/store-screenshots.md",
    "docs/store-kids-compliance.md",
  ];
  // Note: this test file itself is not scanned — it contains the secret
  // patterns as regex literals, which a naive scan would flag as hits.
  // The repo-wide check in docs/release-checklist.md §1 covers all files.
  for (const rel of files) {
    const content = read(rel);
    assert.doesNotMatch(content, /sk_(live|test)_[A-Za-z0-9]{8,}/, `${rel} must not contain a Stripe key`);
    assert.doesNotMatch(content, /FAL_KEY=\S+/, `${rel} must not contain a fal.ai key`);
    assert.doesNotMatch(content, /whsec_[A-Za-z0-9]{8,}/, `${rel} must not contain a webhook secret`);
  }
  assert.equal(fs.existsSync(path.join(ROOT, ".env")), false, "no .env file in the repo");
});
