/* Rabisco Mágico — tests for the service-worker shell fix:
 * a stale cache-first worker served a mixed shell after deploys (new HTML
 * with an older app.js), and the newer script threw on elements the older
 * page did not have, killing every control on the page. These tests read
 * the shipped files and check the fix is in place: the worker fetches the
 * shell network-first, the cache name moved on from the stale v2 worker,
 * vercel.json serves sw.js with no-cache so browsers pick up worker
 * updates, and the app script guards newer elements instead of throwing.
 * No network, no money spent, no real API called.
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

// --- 1. Service worker: network-first shell, fresh cache name -------------

test("service worker fetches the shell network-first, not cache-first", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /CACHE_NAME = "rabisco-magico-v3"/);
  assert.doesNotMatch(sw, /rabisco-magico-v2/);
  for (const shell of ["/index.html", "/app.js", "/styles.css"]) {
    assert.ok(sw.includes(`"${shell}"`), `sw.js must list ${shell} as network-first`);
  }
  assert.match(sw, /NETWORK_FIRST/);
  assert.match(sw, /fetch\(event\.request\)/);
  // The network-first branch still falls back to the cache when offline.
  assert.match(sw, /\.catch\(\(\) => caches\.match\(event\.request\)\)/);
});

test("vercel.json serves sw.js with no-cache so worker updates are picked up", () => {
  const vercel = JSON.parse(read("vercel.json"));
  const headers = vercel.headers || [];
  const sw = headers.find((h) => h.source === "/sw.js");
  assert.ok(sw, "vercel.json must have a headers entry for /sw.js");
  const cc = (sw.headers || []).find((h) => h.key === "Cache-Control");
  assert.ok(cc, "sw.js headers must set Cache-Control");
  assert.match(cc.value, /no-cache/);
});

// --- 2. App script: a missing element must never kill the script ----------

test("app.js guards newer elements instead of throwing on an older shell", () => {
  const app = read("public/app.js");
  // The guarded listener helper exists and the newer screens use it.
  assert.match(app, /function on\(id, event, fn\)/);
  assert.match(app, /on\("btn-welcome-parents", "click"/);
  assert.match(app, /on\("btn-upgrade-plans", "click"/);
  assert.match(app, /on\("btn-upgrade-back", "click"/);
  assert.match(app, /on\("lang-picker", "change"/);
  // show() falls back to the drawing screen when the target is absent.
  assert.match(app, /if \(!target\) target = \$\("screen-draw"\)/);
  // No unguarded listener registration on the newer screens remains.
  assert.doesNotMatch(app, /\$\("btn-welcome-parents"\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\("btn-upgrade-plans"\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\("btn-upgrade-back"\)\.addEventListener/);
  assert.doesNotMatch(app, /\$\("lang-picker"\)\.addEventListener/);
});

// --- 3. Layout: nothing on the welcome screen can exceed a 360px viewport -

test("welcome screen and palette cannot overflow a 360px viewport", () => {
  const css = read("public/styles.css");
  // The page itself can never scroll sideways: content that overflows is
  // clipped instead of sitting off-screen to the left.
  assert.match(css, /html, body \{[^}]*overflow-x: hidden/s);
  // Flex containers in the chain can shrink below their content.
  assert.match(css, /\.app \{[^}]*min-width: 0/s);
  assert.match(css, /\.screen \{[^}]*min-width: 0/s);
  // Buttons cannot be wider than the viewport and their labels wrap.
  assert.match(css, /\.btn \{[^}]*max-width: 100%/s);
  // The welcome language picker gets the same sizing as the draw one.
  assert.ok(css.includes("#lang-picker-welcome"), "welcome picker must be styled");
  // The palette row scrolls by touch so all 12 colours stay reachable.
  assert.match(css, /\.palette \{[^}]*touch-action: pan-x/s);
});
