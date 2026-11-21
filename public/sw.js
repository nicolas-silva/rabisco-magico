/* Rabisco Mágico — service worker.
 * Offline shell: the app shell is cached so the drawing board opens
 * without a connection. API calls (/api/*) are never cached — a transform
 * always needs the network.
 *
 * The shell files (HTML/CSS/JS) are fetched NETWORK-FIRST, with the cache
 * only as an offline fallback. An older cache-first worker served a stale
 * shell after deploys, so a new HTML page could pair with an older app.js
 * (or vice versa): the newer script then threw on elements the older page
 * did not have, killing every control on the page. Network-first keeps
 * the shell files in matching versions. Bump CACHE_NAME when the shell
 * changes so old caches are purged on activation.
 */
"use strict";

const CACHE_NAME = "rabisco-magico-v3";
const SHELL = [
  "./",
  "./index.html",
  "./landing.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

// Shell files that must always load in matching versions.
const NETWORK_FIRST = new Set([
  "/",
  "/index.html",
  "/landing.html",
  "/app.js",
  "/styles.css",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // API + gallery files: network only, never cached.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/gallery-files/")) return;
  if (event.request.method !== "GET") return;
  // Cross-origin (e.g. Google Fonts): let the network handle it.
  if (url.origin !== self.location.origin) return;

  if (NETWORK_FIRST.has(url.pathname) || event.request.mode === "navigate") {
    // Network first, cache as offline fallback. A failed fetch still
    // returns the cached shell instead of an error page.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Other same-origin assets (manifest, icon): cache first, as before.
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
    )
  );
});
