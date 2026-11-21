# Changelog — Rabisco Mágico

All notable changes to this project. The format follows Keep a
Changelog loosely; versions are `0.1.0` until the first beta. Dates
are the build dates (20 November 2026 for everything so far — the
project was built in batches in a single stretch, not over months).

## [0.1.0] — Unreleased

First build: a mobile-only web app for children aged about 4–10.
A child draws with a finger, taps Transformar, and gets back a
realistic AI scene interpreting the drawing.

### Added — core app (Batch 1)

- Drawing board (PWA, `public/index.html` / `styles.css` / `app.js`):
  white canvas, 12 colours, 3 brush sizes, eraser, undo, clear-all
  (two-tap confirm), strokes stored as data so undo/resize never lose
  work, Pointer Events with coalesced events, canvas at devicePixelRatio
  (max 3), dot on tap, quadratic-curve smoothing.
- Transform flow (`POST /api/transform`, `server.js`): the phone sends a
  512×512 PNG; the server runs a vision interpretation step (title
  ≤ 5 words, phrase ≤ 18 words, detailed English image prompt) then
  fal.ai FLUX.2 Pro Edit conditioned on the drawing.
- Result screen: title, phrase, generated image, original drawing as a
  small tilted thumbnail; Baixar (1024×1024 with thumbnail inset) and
  Compartilhar (1080×1350 card).
- 5-free-transform quota per account, one transform in flight per
  account, no auto-retry, friendly child-facing errors, blank-drawing
  check server-side (all-white PNG rejected before any AI call, no quota
  used), kill switch (`KILL_SWITCH=1` → 503 "disabled").
- PWA: `manifest.json`, service worker (`sw.js`, cache-first app shell,
  API and gallery files never cached), install prompt in the parent panel.
- Pricing: Free 5 transforms; Family A$7.99/month or A$54.99/year;
  Magic Pack A$4.99 for 30 transforms. Cost ~US$0.045 per transform
  (fal.ai FLUX.2 Pro Edit ~US$0.03 + vision, budget figure until the
  first invoice).
- Locales: full UI strings in pt-BR, English and Spanish
  (`locales/*.json`, 38 keys each); Spanish and English child-facing
  phrases still need a native-speaker check.
- Landing page (`public/landing.html`, parent-facing, pt-BR/English toggle).
- Benchmark harness (`benchmark/`): 20-drawing live-test harness,
  scoring sheet, dry-run against mocked providers, synthetic drawing
  generator (`scripts/generate-synthetic-drawings.js`).

### Added — payments, accounts, gallery (Batch 2)

- Parent accounts (`lib/accounts.js`): magic-link sign-in (stub — no
  email sent in this build), no child accounts, plans (free / family /
  pack / referral bonus), Family fair-use cap 300/month, Magic Pack
  30 transforms, 15-minute magic-link tokens, 30-day sessions.
- Parental gate in the PWA: maths question guarding signup, payment,
  settings and gallery deletion.
- Stripe checkout, test mode only (`lib/stripe.js`): Family subscription
  (monthly/yearly) and Magic Pack one-off via Checkout Sessions;
  webhook verifies the HMAC signature and grants/revokes on
  `checkout.session.completed` / `customer.subscription.deleted`.
  Live mode is not wired.
- Gallery storage (`lib/storage.js`): interface (`saveWork`, `listWorks`,
  `setFavourite`, `deleteWork`, `deleteAccountGallery`,
  `purgeExpiredWorks`); local-disk dev implementation (one JSON record
  + thumbnail PNG per work under `data/gallery/<account>/`); generated
  images stored by URL only; S3-compatible production stub (every call
  throws `STORAGE_NOT_CONFIGURED` until wired).
- Gallery in the PWA: last 8 works on the device, favourites (star,
  favourites first), title search (case- and accent-insensitive),
  favourites-only filter; server sync of the star when the work has a
  server id and the parent is signed in (best effort).
- Cost dashboard (`GET /api/admin/dashboard`, admin token): transforms
  today/month, estimated spend at US$0.045/transform, quota usage,
  failure rate, daily spend-alert threshold, kill-switch flag.
  Figures are in-memory and labelled MOCK.
- Share card (`lib/share-card.js`, `POST /api/share-card`): server-side
  1080×1350 PNG built with pure Node (hand-decoded/encoded PNG, 5×7
  bitmap font — accented letters render as their base letter in
  capitals), no AI call, no quota; client-side canvas card as fallback.
- Referrals (`lib/referrals.js`): stable `MAGICO-XXXXXX` invite codes,
  +1 bonus transform for referrer and redeemer, one redemption per
  parent, no self-redemption, no Stripe involvement.
- Docs: launch plan, image-provider benchmark (fal.ai FLUX.2 Pro Edit
  recommended, Replicate as backup, OpenAI GPT-Image-2.5 benchmarked),
  deploy guide (Vercel + Render), beta invites, seasonal prompts
  (12 months, southern-hemisphere seasons), email templates (welcome,
  first-transform, winback, upgrade nudge — copy only, no sending wired).

### Added — safety & compliance (Batch 3)

- Title/phrase blocklist (`lib/blocklist.js`): vision-generated title
  and phrase checked server-side before the image call; a hit fails
  friendly, keeps the drawing, charges no quota, and is audited by
  category only. Starter list in English/Portuguese/Spanish, extendable
  via `BLOCKLIST_EXTRA_TERMS`.
- Output-image safety check (`lib/output-safety.js`): second vision pass
  on the generated image before it is shown or saved; currently a stub
  (wiring and fail-closed behaviour real, judgement not) controlled by
  `OUTPUT_SAFETY_CHECK` (`stub` / `off` / `live`).
- Audit logging (`lib/audit.js`, schema in `docs/audit-log-schema.md`):
  structured JSON events with a hashed account id — never an email,
  title, phrase, image, or child data; in-memory ring buffer (last
  1000) + optional JSONL file (`AUDIT_LOG_FILE`); allowlist-only fields.
- Retention & deletion (`docs/data-retention.md`, `scripts/purge-expired.js`):
  parent-account works kept until the parent deletes them; anonymous
  works auto-purge after 90 days (`GALLERY_RETENTION_DAYS`); audit logs
  12 months; parent can delete the whole gallery (`DELETE /api/gallery`,
  two-tap confirm).
- Docs: kids-compliance checklist (COPPA, GDPR-K, Google Play Families,
  Apple Kids — checklist, not legal advice), privacy-policy draft (DRAFT,
  needs lawyer sign-off), data-retention doc, audit-log schema,
  support/refund draft (needs owner sign-off), acceptance checklist
  (12 checks with how to test on a real phone).

### Added — quality & ops (Batch 5)

- Accessibility audit (`docs/accessibility-audit.md`) + fixes in the PWA:
  white text now on deep sky `#1770a8` (5.36:1) and deep coral `#c93a2c`
  (5.09:1) instead of bright sky (3.06:1) and bright coral (2.8:1);
  hint grey darkened to `#54616d` (6.35:1); errors/parent notes are now
  ink text on a pale-yellow banner (10.32:1) instead of yellow text on
  blue (2.37:1); colour swatches enlarged to 44×44 px; global
  `:focus-visible` style (was missing entirely); reduced-motion rule
  now covers all animations/transitions (was wand-only); skip link;
  human colour names + `aria-pressed` on swatches/brushes/eraser;
  canvas `role="img"` + `aria-describedby`; loading screen
  `role="status"`; errors `role="alert"`; gate answers labelled group;
  gallery tiles keyboard-openable (Enter/Space) with dynamic image
  `alt` text; Transform button `aria-busy` while running.
  Service-worker cache bumped to `rabisco-magico-v2` (shell changed).
- Performance notes (`docs/performance-notes.md`): what to measure,
  measured shell sizes (app shell ~51.9 KB raw / ~15.8 KB gzipped),
  image sizes, service-worker caching behaviour and gaps (Google Font
  not cached; generated images deliberately not cached), and the known
  canvas hot spot (full redraw per pointermove, O(strokes)).
- Error-monitoring stub (`lib/errors.js`, no third-party service):
  in-memory ring buffer (last 100 entries, identical repeats collapse
  with a count), optional JSONL file (`ERROR_LOG_FILE`), admin endpoint
  `GET /api/admin/errors` (same token as the dashboard), error count
  added to the dashboard. Captures code/route/method/requestId and a
  truncated, scrubbed message — never stacks with request data, keys,
  emails, titles, or drawings. 12 new tests.
- Structured logging (`lib/logger.js`): JSON-lines logs with levels
  (`LOG_LEVEL`, default `info`), request ids on every request
  (`X-Request-Id` response header, logged on every access line),
  optional log file (`LOG_FILE`). A scrubber drops forbidden fields
  (keys, tokens, emails, titles/phrases, images, drawings) and redacts
  long opaque values. All `console.*` calls removed from `server.js`
  and `lib/`; this also fixed a real leak — the magic-link log in
  `lib/accounts.js` used to print the parent's email and the token.
- Backup/restore notes (`docs/backup-restore.md`): what to back up
  (`data/gallery/` + audit log), daily snapshots, 30-day prune, restore
  procedure, what the S3 swap changes, and the deletion-vs-backup trap
  (backups must not keep deleted drawings past 30 days).
- Release checklist (`docs/release-checklist.md`) and this changelog.

### Added — store prep, no submission (Batch 6)

- Capacitor config draft (`capacitor.config.draft.json`, DRAFT — do
  not rename or run `npx cap add` yet): proposed app id
  `com.rabiscomagico.app`, name Rabisco Mágico, `webDir: public`, and
  a live-server `server.url` placeholder. Records the key constraint
  found while writing it: `public/app.js` calls `/api/...` with
  relative URLs, so a Capacitor shell only works in live-server mode
  until the API base is configurable; the service-worker registration
  also needs a Capacitor guard before the first native build. Lists
  everything a real native project still needs (Capacitor install,
  Xcode / Android Studio, developer accounts, signing, finished icon).
- App-store metadata drafts (`docs/store-metadata.md`, PT + EN):
  title, subtitle, description, keywords, promotional text, Google
  short description, with every character count verified against the
  store limits (e.g. subtitles 25/30 and 28/30, keywords 95/100 and
  88/100, full descriptions ~1,350/4,000). No Teacher Approved or
  Designed for Families claim; prices stated honestly (5 free, then
  Family / Magic Pack in the parent area only).
- Screenshot checklist (`docs/store-screenshots.md`): required Apple
  sizes (iPhone Dynamic Island medium 1206×2622 required, large
  1290×2796 recommended, iPad 13″ 2048×2732 if iPad is supported) and
  Google Play rules (min 2, up to 8 per device type, 1080×1920
  recommended, 1024×500 feature graphic, 512×512 icon), an 8-shot
  shot list, and kid-safe content rules — synthetic drawings only,
  never a real child's drawing without explicit permission for that
  image, no personal data visible.
- Kids/Families store-compliance checklist
  (`docs/store-kids-compliance.md`): Apple Kids (no third-party
  ads/analytics, no links out, no IAP prompts to children, parental
  gate, privacy labels) and Google Play Families (target-audience
  declaration, no ads at all, certified ad SDKs only if ads ever
  existed, no personalised ads, Data safety section, Teacher Approved
  notes). Marked clearly as a checklist, not legal advice; lawyer
  sign-off still needed.
- 7 new tests (`test/store-prep.test.js`): config parses and is
  internally consistent, every metadata character count is true and
  within its limit, descriptions are under 4,000 chars, screenshot
  sizes and kid-safe rules are present, compliance warnings are
  present, and no Batch 6 file contains a real secret. Total: 63 tests.

### Fixed (Batch 5)

- Magic-link creation no longer logs the parent's email or the token
  (`lib/accounts.js`). The spawned-server test that needed the token
  now opts into a test-only hatch (`RABISCO_TEST_LOG_MAGIC_TOKEN=1`,
  never set outside tests, not listed in `.env.example`).
- Log scrubber no longer redacts server-generated UUID request ids
  (they are not secrets; redacting them broke log correlation).
- Colour swatch touch target 40 px → 44 px.
- Error/parent-note text contrast 2.37:1 → 10.32:1 (banner treatment).
- White body-text contrast on the app background 3.06:1 → 5.36:1.

### Known limitations (still open — see docs)

- Vision step: generic fallback unless a provider is wired; output
  safety is a stub (`OUTPUT_SAFETY_CHECK=live` not wired, fails closed).
- Magic-link email not sent; Stripe is test-mode only; parent accounts,
  quota, metrics and referrals are in-memory (lost on restart).
- S3 storage is a stub; purge is local-only until wired for S3.
- No keyboard equivalent for drawing itself; landing page not yet
  accessibility-audited; Spanish/English child phrases need a
  native-speaker check; app icon is an SVG placeholder.
