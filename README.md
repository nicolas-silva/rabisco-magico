# Rabisco Mágico

A mobile-only web app for children aged about 4–10. A child draws with a
finger, taps **Transformar**, and gets back a realistic AI scene that
interprets the drawing — with the original drawing shown as a small tilted
thumbnail in the corner. Then they can download or share the result.

## How it works: Draw → Transform → Share

1. **Draw** — The child draws with a finger on a white canvas. 12 colours,
   3 brush sizes, an eraser, undo, and clear-all (double-tap to confirm).
   The drawing is stored as stroke data, so undo and resizing never lose work.
2. **Transform** — The phone sends the drawing (512×512 PNG) to the backend.
   The backend runs two AI steps, server-side only:
   - **Step 1 — Interpret (vision):** returns a short title (max 5 words),
     a caring phrase for the child (max 18 words), and a detailed English
     image prompt listing every element, its colour and its position.
   - **Step 2 — Generate (image):** fal.ai FLUX.2 Pro Edit
     (`fal-ai/flux-2-pro/edit`) receives the prompt **and** the drawing as
     conditioning, so the realistic scene keeps the child's objects, colours
     and layout.
3. **Share** — The result screen shows the title, phrase, generated image
   and the original drawing thumbnail. **Baixar** downloads a 1024×1024
   image with the original thumbnail inset; **Compartilhar** shares a
   1080×1350 card — tried server-side first (`POST /api/share-card`,
   pure-Node PNG, no AI call, no quota), with the client-side canvas
   card as fallback. **Desenhar outro** clears the board;
   **Continuar** goes back to the drawing without clearing it.
   The gallery keeps the last 8 works on the device, with favourites
   (star, favourites first) and search by title.

## Tech stack

- Front-end: plain HTML/CSS/JS, no framework, installable PWA
  (`public/manifest.json`). Fredoka font, sky `#2b9be0`, sun `#ffc93c`,
  coral `#ff6b5b`, ink `#10324a`.
- Back-end: Node 20+, Express (`server.js`). One endpoint,
  `POST /api/transform`, plus static hosting of `public/`.
- Image generation: fal.ai FLUX.2 Pro Edit.
- Vision interpretation: provider-agnostic — see `server.js`
  (`interpretDrawing`). If no vision key is set, the server still starts
  and uses a clearly-marked generic fallback prompt.

## Run locally

```bash
cp .env.example .env   # then fill in FAL_KEY (never commit .env)
npm install
npm run dev            # or: npm start
```

Open http://localhost:3000 on your phone (or a narrow browser window).
The app is designed for portrait, 360–480 px wide; on desktop (≥700 px)
it appears centred in a phone frame.

## Deploy

Any small Node host works (Vercel, Render, Fly.io, a VPS). Set the
environment variables on the host — do **not** copy `.env` into the repo
or the deployment bundle:

- `FAL_KEY` — fal.ai API key (required for real transforms)
- `VISION_API_KEY` — optional, for the vision step (see `server.js`)
- `BASE_URL` — public URL of the app (Stripe links, magic links)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_FAMILY_MONTHLY`, `STRIPE_PRICE_FAMILY_YEARLY`,
  `STRIPE_PRICE_MAGIC_PACK` — Stripe **test mode only** (see below)
- `ADMIN_TOKEN` — unlocks the cost dashboard (`GET /api/admin/dashboard`)
- `DAILY_SPEND_ALERT_USD` — default `5`; `KILL_SWITCH=1` pauses all transforms
- `BLOCKLIST_EXTRA_TERMS` — comma-separated extra blocklist terms, no restart needed (see `lib/blocklist.js`)
- `OUTPUT_SAFETY_CHECK` — `stub` (default) / `off` / `live` for the output-image safety check (see `lib/output-safety.js`; `live` is not wired yet and fails closed)
- `AUDIT_LOG_FILE` — optional JSONL audit log path (e.g. `data/audit.jsonl`); `AUDIT_HASH_SALT` — long random salt for hashing account ids in audit events (dev default must be replaced before launch)
- `GALLERY_RETENTION_DAYS` — auto-purge window for anonymous works, default `90` (see `docs/data-retention.md`)
- `LOG_LEVEL` — `debug` / `info` (default) / `warn` / `error` for structured JSON-line logs; `LOG_FILE` — optional JSONL log path (e.g. `data/server.jsonl`); `ERROR_LOG_FILE` — optional JSONL error-monitor path (e.g. `data/errors.jsonl`). See `lib/logger.js` and `lib/errors.js`
- `STORAGE_BACKEND` — `local` (dev) or `s3` (production stub)
- `PORT` — optional, defaults to 3000

Step-by-step for Vercel and Render, with cost notes (~US$25–50/month
fixed): see [`docs/deploy.md`](docs/deploy.md).

## Payments (Stripe, test mode only)

Checkout is wired but **test mode only**: `POST /api/checkout/family`
(subscription, monthly/yearly) and `POST /api/checkout/pack` (one-off
Magic Pack) create a Stripe Checkout Session and return its URL; the
parent is redirected there. `POST /api/stripe/webhook` verifies the
HMAC signature and grants the plan on `checkout.session.completed`
(Family subscription or +30 pack transforms) and revokes it on
`customer.subscription.deleted`. Keys and price ids come from
`process.env` only; without them the routes return 503. Live mode is
not wired — do not paste a live secret key. See `lib/stripe.js` and
`docs/deploy.md`.

## Parent accounts + parental gate

Parents only — no child accounts, no child personal data. A parent
signs up with an email (`POST /api/parent/signup`) and gets a magic
link (`POST /api/parent/verify` returns a session token). **No email
is sent in this build** — the link is logged server-side only until a
real email provider is wired. In the PWA, the 🔒 button opens a
parental gate (a maths question a small child can't answer) that
guards signup, payment, settings and gallery deletion. A signed-in
parent can delete the whole gallery (`DELETE /api/gallery`, two-tap
confirm in the app). See `lib/accounts.js`.

## Gallery storage

Generated images are stored by URL — the device keeps only URLs.
`lib/storage.js` defines the interface (`saveWork`, `listWorks`,
`deleteWork`, `deleteAccountGallery`); the dev implementation writes
one JSON record per work under `data/gallery/<account>/` (gitignored).
Each work carries a `favourite` flag: `PATCH
/api/gallery/:workId/favourite` toggles it (parent only), and `GET
/api/gallery?q=...` searches titles + phrases case- and
accent-insensitively, favourites first by default. In the PWA the
gallery has the same star toggle, a title search box and a
favourites-only filter; a star also syncs to the server when the
work has a server id and the parent is signed in (best effort).
The production swap is an S3-compatible stub: set
`STORAGE_BACKEND=s3` plus `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` /
`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`, and wire a real client —
until then every S3 call throws `STORAGE_NOT_CONFIGURED`.

## Cost dashboard

`GET /api/admin/dashboard` (header `x-admin-token: <ADMIN_TOKEN>`,
503 if no token is set) shows transforms today/month, estimated AI
spend at US$0.045/transform, quota usage, failure rate, a configurable
daily spend-alert threshold (`DAILY_SPEND_ALERT_USD`) and the kill
switch flag (`KILL_SWITCH=1` pauses all transforms with a friendly
503). Figures are **in-memory and labelled MOCK** — estimates only,
reset on restart, not billing data. See `lib/metrics.js`.

## PWA

Installable: `public/manifest.json` (SVG placeholder icon —
`public/icon.svg`, replace with a finished 512×512 PNG before
launch), a service worker (`public/sw.js`, cache-first app shell,
API never cached) and install-prompt handling (the install button
lives in the parent panel). Bump `CACHE_NAME` in `sw.js` when the
shell changes.

## Pricing / cost notes

- Image generation: fal.ai FLUX.2 Pro Edit, about **US$0.03 per image**
  (1024×1024). Budget **US$0.045 per image until the first invoice** —
  the exact price with a 512 px sketch input was not confirmed.
- All-in cost per transform (vision + image + storage): about
  **US$0.04 (~A$0.06)**. Fixed hosting costs: roughly **US$25–50/month**.
- Product pricing (launch plan): Free = 5 transforms in total per
  account; Family = **A$7.99/month** or **A$54.99/year** (fair-use cap
  300/month); Magic Pack = **A$4.99 for 30 transforms**.
- The server enforces a 5-free-transform quota stub per account and
  one transform in flight at a time. It never auto-retries in a loop.

## Safety

- API keys live **server-side only**, in `.env` / host environment
  variables. The browser never sees `FAL_KEY`.
- fal.ai safety checker is on (`enable_safety_checker: true`,
  `safety_tolerance: "2"`).
- **Title/phrase blocklist** (`lib/blocklist.js`): the vision-generated
  title and phrase are checked server-side before the image call. A hit
  fails friendly, keeps the drawing, charges no quota, and is audited by
  category only. Starter list in English/Portuguese/Spanish; extend it
  in code or via `BLOCKLIST_EXTRA_TERMS`.
- **Output-image safety check** (`lib/output-safety.js`): a second
  vision pass on the generated image before it is shown or saved. It is
  currently a **stub** (no provider call, no key) — the wiring and the
  fail-closed behaviour are real, the judgement is not. Controlled by
  `OUTPUT_SAFETY_CHECK` (`stub` / `off` / `live`); `live` fails closed
  until a provider is wired. **Must be wired to a real provider before
  launch.**
- **Audit logging** (`lib/audit.js`, schema in
  `docs/audit-log-schema.md`): transforms and deletions are logged as
  structured events with a hashed account id — never an email, title,
  phrase, image, or any child data.
- **Retention & deletion** (`docs/data-retention.md`): parent-account
  works are kept until the parent deletes them; anonymous works
  auto-purge after 90 days (`scripts/purge-expired.js`); audit logs are
  kept 12 months. Every stored work carries a `retention` record.
- No child names, photos, birthdays or accounts are collected. Original
  drawings are stored only with parent consent and are deletable.
- Any generation failure shows a friendly message, keeps the drawing,
  and does not charge quota.
- Kids-compliance checklist (COPPA, GDPR-K, Google Play Families,
  Apple Kids, neutral age-screen design): `docs/kids-compliance-checklist.md`
  — a checklist, not legal advice; lawyer sign-off still needed.

## Share card, referrals, seasonal prompts, emails

- **Share card** (`lib/share-card.js`, `POST /api/share-card`):
  builds the 1080×1350 card server-side with pure Node — PNG
  decoded/encoded by hand, no canvas library, no AI call, no quota.
  Body: `{ image | imageUrl, thumb?, titulo?, frase?, language? }`;
  the server fetches `imageUrl` itself (the browser cannot, the
  generated image is cross-origin). Title on top, generated image
  in a white frame, original drawing tilted in the corner, phrase
  below, localised footer. Text uses a built-in 5×7 bitmap font,
  so accented letters render as their base letter in capitals.
- **Referrals** (`lib/referrals.js`, stub): `GET /api/referral/code`
  gives the parent one stable code (`MAGICO-XXXXXX`); `POST
  /api/referral/redeem` grants +1 bonus transform to both the
  referrer and the redeemer (one redemption per parent, no
  self-redemption). Bonus transforms are spent like pack
  transforms and never touch Stripe. No email is sent.
- **Seasonal prompts**: `docs/seasonal-prompts.md` — one theme per
  month, 3 ideas each, pt-BR + English, southern-hemisphere
  seasons with northern notes.
- **Emails**: `docs/email-templates.md` — welcome, first-transform
  encouragement, 14-day winback, upgrade nudge, pt-BR + English.
  Copy only — no email is sent by the app in this build.

## Docs

- `docs/launch-plan.md` — web-first launch plan summary
- `docs/image-provider-benchmark.md` — image-provider benchmark summary
- `docs/privacy-policy-draft.md` — privacy policy DRAFT (needs lawyer sign-off)
- `docs/kids-compliance-checklist.md` — COPPA / GDPR-K / Google Play Families / Apple Kids checklist + neutral age-screen design (checklist, not legal advice; lawyer sign-off needed)
- `docs/data-retention.md` — retention periods and the deletion flow (parent request → wipe gallery + storage + audit reference)
- `docs/audit-log-schema.md` — audit log schema (hashed account id, no child data)
- `docs/acceptance-checklist.md` — the 12 acceptance checks, each with how to test on a real phone
- `docs/support-refund-draft.md` — support and refunds DRAFT (needs owner sign-off)
- `docs/deploy.md` — step-by-step deploy for Vercel and Render, env vars, costs
- `docs/beta-invites.md` — invite templates (pt-BR + English) for the first 20 families, plus a parent FAQ
- `docs/seasonal-prompts.md` — 12 months of seasonal drawing prompt ideas (pt-BR + English)
- `docs/email-templates.md` — onboarding + winback email templates (pt-BR + English; copy only, no sending wired)
- `docs/accessibility-audit.md` — WCAG 2.2 AA audit of the PWA (contrast ratios, touch targets, screen-reader labels, reduced motion) and the fixes applied
- `docs/performance-notes.md` — what to measure, measured shell sizes, image sizes, service-worker caching, canvas hot spots
- `docs/backup-restore.md` — gallery backup/restore (daily snapshots, 30-day prune, restore procedure, S3 changes, deletion-vs-backup)
- `docs/release-checklist.md` — pre-release, deploy, smoke-test and launch-only checklists
- `capacitor.config.draft.json` — Capacitor wrapper draft (DRAFT — no native project yet; live-server mode required, see the notes inside)
- `docs/store-metadata.md` — app-store metadata drafts, PT + EN (title, subtitle, description, keywords, promotional text; character counts verified)
- `docs/store-screenshots.md` — screenshot checklist (Apple + Google Play sizes, shot list, kid-safe content rules)
- `docs/store-kids-compliance.md` — Kids/Families store-compliance checklist (Apple Kids + Google Play Families; checklist, not legal advice)
- `CHANGELOG.md` — changelog from 0.1.0 (unreleased)

## Tests, landing page, benchmark, languages

- `npm test` — 63 server tests (`test/server.test.js` + `test/new-features.test.js` + `test/safety-compliance.test.js` + `test/growth-retention.test.js` + `test/quality-ops.test.js` + `test/store-prep.test.js`, node:test, no framework). The fal.ai and Stripe calls are mocked locally; tests never call a real API.
- `npm run drawings` — generates the 20 synthetic kid-style drawings (`benchmark/drawings-synthetic/`, gitignored).
- `npm run benchmark:dry-run` — validates the benchmark harness end-to-end against mocked fal/OpenAI responses; writes `benchmark/dry-run-results.csv` + `benchmark/dry-run-report.md` (gitignored, mock scores only).
- `public/landing.html` — parent-facing landing page (pt-BR/English toggle): first 5 transformations free, pricing, no ads, no child data.
- `benchmark/` — the 20-drawing live-test harness: scoring sheet, method, pre-registered decision rule, and a permission template for collecting drawings.
- `locales/` — every UI string in pt-BR, English and Spanish (`pt-BR.json`, `en.json`, `es.json`, 38 keys each). Spanish and the English child-facing phrases still need a native-speaker check — see `locales/README.md`.
