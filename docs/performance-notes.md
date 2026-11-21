# Performance notes — Rabisco Mágico

Date: 20 November 2026. Status: notes from code inspection and measured
file sizes only. **No real user data, no external calls, no profiling
run was made** — the numbers below are static sizes and reasoned
bottlenecks, not measurements from a device. Measure on a real phone
(low-end Android, 4G) before launch; see §5 for what to measure.

## 1. What to measure (before launch)

| Metric | Target (beta) | How |
|---|---|---|
| Time to first draw (open → canvas usable) | < 2 s on 4G, < 1 s on Wi-Fi | Phone stopwatch / Chrome DevTools throttled 4G |
| App-shell size (first load, gzipped) | < 50 KB | DevTools Network, see §2 |
| Transform round-trip (tap → result) | dominated by fal.ai, 6–9 s expected | Server log `durationMs` on `POST /api/transform` (see `lib/logger.js`) |
| Frame rate while drawing | 60 fps, no visible lag | DevTools Performance while scribbling fast |
| Memory while drawing | no growth after 50 strokes | DevTools Memory heap snapshot before/after |
| Offline open (2nd visit, no network) | board opens, drawing works | Airplane mode after first visit |

## 2. Current rough sizes (measured 20 Nov 2026, repo files)

| File | Raw | Gzipped | Notes |
|---|---|---|---|
| `public/app.js` | 32,153 B | 9,069 B | Largest shell file; all UI + drawing engine |
| `public/styles.css` | 8,750 B | 2,646 B | |
| `public/index.html` | 7,911 B | 2,427 B | |
| `public/sw.js` | 1,641 B | 791 B | |
| `public/manifest.json` | 428 B | 288 B | |
| `public/icon.svg` | 1,075 B | 587 B | Placeholder SVG icon |
| `public/landing.html` | 11,096 B | 4,130 B | Not part of the app shell |
| **App shell total (excl. landing)** | **~51.9 KB** | **~15.8 KB** | Well under the 50 KB gzipped target |
| `server.js` + `lib/*` | ~110 KB source | — | Server-side only, not downloaded |

External weight on first load: one Google Fonts request (Fredoka,
weights 500/600/700) via `fonts.googleapis.com` + `fonts.gstatic.com`
— the only third-party dependency. If the font fails, the app falls
back to `system-ui` and still works. Consider self-hosting the font
before launch to remove the external request and the offline gap
(the service worker does not cache it — see §3).

### Image sizes (runtime, not shipped files)

| Image | Size | Notes |
|---|---|---|
| Drawing sent to the server | 512×512 PNG, data URL | Exported by `exportDrawing()`; white background, content centred. A dense drawing is roughly 50–200 KB base64 — the `express.json` limit is 2 MB, so this fits with headroom. |
| Generated image (fal.ai URL) | fal.ai output, ~1024 px | Not downloaded by the server; the browser loads it from fal.ai's CDN on the result screen. Its size is whatever fal.ai returns — not measured here. |
| Download (Baixar) | 1024×1024 PNG | Built client-side on a canvas; a PNG that size is roughly 1–3 MB in memory. |
| Share card | 1080×1350 PNG | Built server-side (`lib/share-card.js`) or client-side fallback; ~1–3 MB. |
| Gallery thumbnails | 512×512 PNG files under `data/gallery/` | Stored server-side; served from `/gallery-files/`. Device gallery keeps only URLs (plus the last 8 works' URLs in `localStorage`). |

## 3. Caching (service worker, `public/sw.js`)

- **Cache-first for the app shell**: `./`, `index.html`, `styles.css`,
  `app.js`, `manifest.json`, `icon.svg` are pre-cached on install
  (`CACHE_NAME = "rabisco-magico-v2"` — bumped in Batch 5 because the
  shell changed) and served from cache on repeat visits, so the board
  opens offline. Old caches are purged on activation.
- **API calls (`/api/*`) are never cached** — a transform always needs
  the network, and caching a transform response would be wrong.
- **Gallery files (`/gallery-files/*`) are never cached** — they are
  user data with retention rules, not shell assets.
- **Same-origin GETs** that miss the cache are fetched and then cached
  for next time (runtime caching of shell-like assets).
- **Gap: the Google Font is not cached** (cross-origin, not in the
  shell list). Offline, the app falls back to `system-ui`. Self-host
  the font and add it to `SHELL` if offline typography matters.
- **Gap: generated images are not cached.** The result image comes from
  fal.ai's CDN each time. That is deliberate (freshness + the image is
  not ours to cache long-term), but it means the result screen needs
  the network even for a work already in the gallery. The gallery
  itself is localStorage URLs, so it also needs the network to show
  images. Do not "fix" this by caching generated images in the
  service worker without a retention review — see `docs/data-retention.md`.

## 4. What would slow the drawing canvas

These are the known hot spots in `public/app.js` — read from the code,
not profiled:

1. **Full redraw on every pointermove.** `redraw()` replays *every*
   stroke from scratch on each move event. Cost grows linearly with
   stroke count, so a long, enthusiastic drawing gets laggier the
   longer it goes on. Mitigations already in place: strokes are data
   (not pixels), `getCoalescedEvents()` is used when available, and
   the canvas is capped at DPR 3. If lag is reported, the fix is an
   offscreen "committed strokes" layer so only the current stroke is
   redrawn per frame — do not just raise the DPR cap.
2. **DevicePixelRatio cap is 3.** On a DPR-3 phone the canvas backing
   store is 3× the CSS size in each dimension (9× pixels). That is
   already the cap; raising it would cost memory and fill-rate for no
   visible gain. Lowering it to 2 on low-end devices is an option if
   drawing lags.
3. **`touch-action: none` + a `touchmove` preventDefault.** Correct
   (stops scroll/zoom fighting the stroke), but it means every touch
   goes through JS — a slow main thread stalls drawing directly.
4. **Export is 512×512 and synchronous.** `exportDrawing()` draws the
   full canvas into a 512×512 offscreen canvas and base64-encodes it
   on the Transform tap. That is a one-off ~50–200 KB encode, fine —
   but it happens on the main thread, so a very dense drawing can
   jank the tap. Not worth optimising before measuring.
5. **Transform round-trip is network-bound, not canvas-bound.** The
   6–9 s wait is the fal.ai call (plus vision). The loading screen
   exists for exactly this. Do not "optimise" it by shrinking the
   drawing below 512×512 — the image model conditions on it.
6. **Gallery rendering is cheap** (max 8 works, localStorage). The
   server-side gallery (`GET /api/gallery`) lists JSON files per
   account — fine at beta scale; it will need pagination if an
   account ever holds hundreds of works.
7. **No build step, no bundler.** The shell is three small files with
   no framework. That is a performance feature at this size — do not
   add a bundler to "optimise" it.

## 5. How to re-measure

1. `npm start`, open the app on a real phone (not just a narrow
   desktop window) on 4G.
2. DevTools → Network: confirm the shell loads once, then comes from
   the service worker on repeat visits; note the font request.
3. DevTools → Performance: record 10 s of fast scribbling; look for
   long tasks and dropped frames in `redraw()`.
4. Transform 3 times; note the server `durationMs` in the JSON logs.
5. Airplane mode → reload: board must open and draw; Transform must
   fail friendly (it needs the network) and keep the drawing.
