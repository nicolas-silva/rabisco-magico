# Release checklist — Rabisco Mágico

Use this before any release (beta or launch). Check each box in order;
a release does not go out with an unchecked box in §1–§3. §4 is
launch-only. See `CHANGELOG.md` for what is in the release.

## 1. Code & tests

- [ ] `npm test` passes in full (currently 63 tests: server, new
      features, safety/compliance, growth/retention, quality-ops,
      store-prep).
- [ ] `node --check` passes on `server.js`, `lib/*.js`,
      `public/app.js`, `public/sw.js`, `scripts/*.js`.
- [ ] No real API key, token, or secret anywhere in the repo:
      `grep -r "sk_live\|sk_test\|FAL_KEY=.\|whsec" --exclude-dir=node_modules .`
      must show only placeholders / `.env.example`.
- [ ] No `.env` file in the repo or the deployment bundle
      (`.env` is gitignored; set vars on the host, never copy the file).
- [ ] `CACHE_NAME` in `public/sw.js` bumped if `public/` changed
      (current: `rabisco-magico-v2`).
- [ ] `CHANGELOG.md` updated for the release (version, date, what changed).
- [ ] No `console.log` of personal data, keys, or drawings in
      `server.js` / `lib/` — logging is structured JSON via
      `lib/logger.js` (see `docs/` logging notes in the audit doc set);
      the one former leak (magic-link token + email in `lib/accounts.js`)
      is fixed.

## 2. Deploy (see `docs/deploy.md` for the host steps)

- [ ] Env vars set on the host (never from a committed file):
      `FAL_KEY` (account has credits), `BASE_URL`, Stripe test keys +
      price ids, `ADMIN_TOKEN` (long random), `AUDIT_HASH_SALT` (long
      random — the dev default must not ship), `GALLERY_RETENTION_DAYS`
      if not 90, `STORAGE_BACKEND`.
- [ ] `KILL_SWITCH` is `0` (or unset) for a normal release.
- [ ] `OUTPUT_SAFETY_CHECK` is `stub` (default). It must be `live`
      with a real provider before a public launch — see §4.
- [ ] `STRIPE_*` are **test-mode** keys only. Live keys are not wired;
      do not paste one.
- [ ] Persistent disk attached if the local gallery backend is used
      (Render: mounted at the `data/` path), otherwise gallery works
      are wiped on every deploy — see `docs/backup-restore.md`.
- [ ] Daily gallery backup job running and verified (§3 of
      `docs/backup-restore.md`); one practice restore done.

## 3. Smoke test (real phone, not a desktop window)

From `docs/acceptance-checklist.md` — the short version:

- [ ] Open the app, draw with a finger, tap Transformar — result
      appears with title, phrase, generated image and original thumbnail.
- [ ] Blank board → friendly "Desenhe alguma coisa primeiro!", no quota used.
- [ ] 6th free transform → quota message, no charge.
- [ ] Download (1024×1024, thumbnail inset) and Share (1080×1350 card) work.
- [ ] Gallery: work appears, star toggles, search finds it by title.
- [ ] Parental gate blocks the parent area; magic-link sign-in works;
      parent can delete the whole gallery (two-tap).
- [ ] Airplane mode after first visit: board opens and draws; Transform
      fails friendly and keeps the drawing.
- [ ] `GET /api/health` returns `{ ok: true, … }`.
- [ ] `GET /api/admin/dashboard` with `x-admin-token` returns the
      dashboard; without it, 401.
- [ ] `GET /api/admin/errors` with the token returns the error list;
      without it, 401.
- [ ] Kill switch: `KILL_SWITCH=1` → transforms return 503 "disabled".

## 4. Launch-only (public release, not beta)

- [ ] Privacy policy signed off by a lawyer (`docs/privacy-policy-draft.md`
      is a DRAFT until then); support/refund draft signed off by the owner.
- [ ] Kids-compliance checklist reviewed (`docs/kids-compliance-checklist.md`):
      COPPA / GDPR-K / Google Play Families / Apple Kids — checklist, not
      legal advice; lawyer sign-off still needed.
- [ ] Store listings reviewed as drafts, not submitted
      (`docs/store-metadata.md`, `docs/store-screenshots.md`,
      `docs/store-kids-compliance.md`, `capacitor.config.draft.json`):
      sizes re-checked in App Store Connect / Play Console on the day,
      screenshots captured from the native build with the kid-safe
      rules applied, lawyer sign-off on both listings.
- [ ] Output-image safety check wired to a real provider
      (`OUTPUT_SAFETY_CHECK=live`); the stub must not ship to the public.
- [ ] Vision step wired to a real provider, or the generic fallback is
      an accepted product decision (not a surprise).
- [ ] Email sending wired for magic links (currently a stub — the link
      is only logged server-side) and for the templates in
      `docs/email-templates.md`, or the beta flow (paste the code) is
      an accepted interim step.
- [ ] Parent accounts, quota, metrics and referrals moved off in-memory
      Maps to a database (a restart currently loses them — see
      `docs/backup-restore.md` §1).
- [ ] Accessibility re-audit on a real device, including the landing
      page (`docs/accessibility-audit.md` §6 — landing was not audited
      in Batch 5). Automated check (axe / Lighthouse) added to the
      release process.
- [ ] Performance measured on a low-end Android phone on 4G against
      the targets in `docs/performance-notes.md` §1.
- [ ] Spanish and English child-facing phrases checked by a native
      speaker (see `locales/README.md`).
- [ ] Finished 512×512 PNG app icon replaces the SVG placeholder
      (`public/icon.svg`).
- [ ] fal.ai image retention / delete API confirmed with fal.ai (open
      item in `docs/data-retention.md`); privacy policy states it honestly.
- [ ] Backup retention window (30 days) confirmed and stated in the
      privacy policy.

## 5. After the release

- [ ] Watch the cost dashboard daily for the first week
      (`DAILY_SPEND_ALERT_USD`, default US$5) and the error list
      (`GET /api/admin/errors`).
- [ ] Keep the kill switch procedure somewhere the on-call person can
      reach it in one minute (`KILL_SWITCH=1` + restart/redeploy).
- [ ] Log the release in `CHANGELOG.md` (move the version out of
      "Unreleased" with the date).
