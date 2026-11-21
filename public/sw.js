/* Rabisco Mágico — service worker.
 * Offline shell: cache-first for the app shell (HTML/CSS/JS/manifest/icon)
 * so the drawing board opens without a connection. API calls (/api/*) are
 * never cached — a transform always needs the network. Old caches are
 * purged on activation. Bump CACHE_NAME when the shell changes.
 */
"use strict";

const CACHE_NAME = "rabisco-magico-v2";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icon.svg",
];

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
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((res) => {
          // Cache same-origin shell assets for next time.
          if (res.ok && url.origin === self.location.origin) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
    )
  );
});
