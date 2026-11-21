# Data retention & deletion — Rabisco Mágico

How long we keep each kind of data, and how a parent gets it deleted.
This is the operational companion to `docs/privacy-policy-draft.md`
(DRAFT — needs lawyer sign-off) and `docs/kids-compliance-checklist.md`.
Nothing here is legal advice; the periods below are the product's
current decisions, to be confirmed by the lawyer before launch.

## Retention periods

| Data | Kept for | Why / notes |
|---|---|---|
| Generated image + child's drawing (parent account) | Until the parent deletes it, or the account is closed | The gallery is the product. No automatic expiry while a parent account exists. |
| Generated image + drawing (anonymous, no parent account) | 90 days from creation (`GALLERY_RETENTION_DAYS`, env) | Legacy only: since the parent sign-in requirement, the app no longer creates anonymous works. Works stored before that change still auto-purge after 90 days via `scripts/purge-expired.js`. |
| Title + phrase for a work | Same as the work itself | They are part of the artwork record, stored with it. |
| Audit log events | 12 months, then deleted | Long enough to answer "what happened to my gallery?" and to reconcile spend; short enough to limit exposure. Audit events contain only a hashed account id — no child data (see `docs/audit-log-schema.md`). |
| Aggregate metrics (transform counts, spend estimates) | 13 months | No personal data at all; kept for year-on-year comparison. In-memory in this build, resets on restart. |
| Magic-link tokens | 15 minutes | One-time, single use, then deleted. |
| Parent sessions | 30 days | Then the parent signs in again. |
| Parent account + email | Until the account is closed | Needed to run the account and send receipts. |
| Payment records | Per Stripe's terms | Card numbers are never stored by us. |
| Backups (if any) | 30 days, then overwritten | **To be confirmed with the hosting provider** — same open item as in the privacy-policy draft. |
| Support emails | Until the request is resolved + 90 days | So a follow-up can be answered; then deleted. |

## How retention is stored (code hooks)

Every stored work carries a `retention` record (see `lib/storage.js`):

```json
{
  "id": "work_…",
  "createdAt": "2026-11-20T12:00:00.000Z",
  "retention": {
    "policy": "parent_controlled",
    "createdAt": "2026-11-20T12:00:00.000Z",
    "deleteAfter": null,
    "retentionDays": 90
  }
}
```

- Parent-account works: `policy: "parent_controlled"`, `deleteAfter: null`
  — the transform flow passes `{ autoPurge: false }` when a parent is
  signed in. They are never auto-deleted.
- Anonymous works: `policy: "auto_purge"`, `deleteAfter` =
  `createdAt + GALLERY_RETENTION_DAYS` (default 90) — the transform flow
  passes `{ autoPurge: true }` when there is no parent session.
- `storage.purgeExpiredWorks(accountId, now)` deletes only works whose
  `deleteAfter` has passed and returns how many it removed. It never
  touches `parent_controlled` works, and it is **not run automatically**.

## Deletion flow

### 1. Parent deletes one work or the whole gallery (in the app)

1. Parent opens the parental gate (maths question) → gallery.
2. Delete one work, or **delete the whole gallery** (`DELETE /api/gallery`,
   two-tap confirm in the app).
3. The server deletes the work record(s) **and** the drawing thumbnail
   file(s) from storage (`storage.deleteWork` / `deleteAccountGallery`).
4. The server writes an audit event (`gallery_deleted`, hashed account
   id only — see `docs/audit-log-schema.md`). The audit event is not
   itself personal data and is kept for 12 months.
5. The fal.ai-hosted generated image URL stops being referenced. Note:
   the image file itself lives on fal.ai's CDN under their retention;
   **open item:** confirm with fal.ai how long generated images are
   kept and whether a delete API exists — until then, deletion removes
   our copy/reference, not necessarily the provider's cached copy.
   The privacy policy must say this honestly once confirmed.

### 2. Parent closes the account (parent request)

1. Parent asks in the app (settings) or by email to support.
2. Support (or the account-closure flow, when built) verifies the
   requester owns the account — magic-link sign-in, never a password
   the parent has to remember.
3. Wipe, in order: gallery + storage (`deleteAccountGallery`), usage /
   quota record, parent session tokens, the account record itself.
4. Audit: one `gallery_deleted` event per wipe (hashed id only).
   Payment records stay with Stripe under Stripe's terms; the local
   subscription reference is removed.
5. Confirm to the parent by email that the wipe is done, and within
   what window backups are overwritten (30 days, to be confirmed).

### 3. Automatic purge (anonymous works only)

1. A scheduled job (daily cron on the host) runs
   `node scripts/purge-expired.js` (`--dry-run` first, to report
   without deleting).
2. The script walks `data/gallery/<account>/` (local storage) and
   calls `purgeExpiredWorks` per account. S3 is not wired yet — do not
   switch `STORAGE_BACKEND=s3` until the purge is wired for it too.
3. The script prints a one-line JSON summary
   (`{ accounts, purged, dryRun }`) for the job log. It never deletes
   parent-account works or audit logs.

## What we never do

- Never delete real user data from the transform flow, a test, or a
  dry run. Tests use throwaway accounts and clean up `data/` after
  themselves.
- Never "delete" by hiding a record while keeping the file. Deletion
  removes the JSON record **and** the thumbnail PNG.
- Never log a deletion request with the parent's email or any child
  data — audit events carry only the hashed account id.
