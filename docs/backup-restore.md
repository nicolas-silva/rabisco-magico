# Backup & restore — Rabisco Mágico gallery

Date: 20 November 2026. Companion docs: `docs/data-retention.md`
(what is kept and for how long), `docs/deploy.md` (hosts),
`docs/audit-log-schema.md` (what a restore must not rewrite).

## 1. What to back up

The gallery is the only user data the server holds. Everything else
is either in-memory (quota, metrics, sessions — lost on restart by
design) or with a provider (Stripe holds payment records; fal.ai
holds generated images under their retention).

| Data | Where it lives (local backend) | Back up? |
|---|---|---|
| Gallery works — one JSON record per work + one thumbnail PNG per work | `data/gallery/<accountId>/<workId>.json` and `<workId>-thumb.png` | **Yes — this is the backup** |
| Generated images themselves | fal.ai CDN URLs, stored *by reference* in the JSON records | No — we do not hold the bytes. A restore re-links the same URLs; if fal.ai has expired them, the record restores but the image 404s (see §5). |
| Audit log (optional file) | `data/audit.jsonl` when `AUDIT_LOG_FILE` is set | Yes, if enabled — it is the only record of deletions and spend |
| Error log (optional file) | `data/errors.jsonl` when `ERROR_LOG_FILE` is set | Optional — diagnostic only, safe to lose |
| Server log (optional file) | `data/server.jsonl` when `LOG_FILE` is set | Optional — diagnostic only |
| Parent accounts, sessions, quota, metrics, referral codes | In-memory Maps (`lib/accounts.js`, `lib/referrals.js`, server `usage`) | **Cannot be backed up in this build** — there is no persistence yet. A restart loses them. That is a known beta limitation, not a backup gap to paper over: do not promise parents their plan survives a restart until accounts move to a database. |
| App code + config | Git repo; env vars on the host | Code: git. Secrets: host env vars only, never in a backup file |

**Do not back up:** `.env` files, API keys, Stripe secrets, magic-link
tokens, session tokens. A backup that contains a credential is a
breach waiting to happen. The gallery JSON records contain no keys,
no emails, no titles/phrases beyond the artwork's own title — but
treat the backup as user data anyway: encrypt at rest if the host
offers it, and restrict who can read it.

## 2. How often

| Situation | Frequency |
|---|---|
| Beta, local-disk backend, Render persistent disk (see `docs/deploy.md`) | **Daily** automated snapshot of `data/gallery/` + `data/audit.jsonl` if enabled. The disk itself is the live copy; the snapshot is the recovery copy. |
| Beta without a persistent disk | **Do not rely on backups at all** — `data/` is wiped on every deploy/restart, so gallery works are lost regardless of backup frequency. Add the disk first (Render: 1 GB, ~US$0.25/GB/month), then back it up. |
| After the S3 swap (§4) | Daily versioned bucket snapshots (or rely on bucket versioning + cross-region replication if the provider offers it). |
| Retention of backups | **30 days, then overwritten** — same window as `docs/data-retention.md`. A backup must not become a way to keep deleted data forever: when a parent deletes their gallery, the next backup cycle must not still hold it past 30 days. |

## 3. How to back up (local backend)

The layout is plain files, so the backup is a file copy. Run it from
the host (cron or the host's scheduled job), not from the app:

```bash
# 1. Copy the gallery + audit log to a timestamped snapshot directory.
#    rsync -a preserves the per-account layout; --delete keeps the
#    snapshot honest about deletions (a deleted work must disappear
#    from the next snapshot — see §6).
BACKUP_ROOT=/var/backups/rabisco-magico
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
mkdir -p "$BACKUP_ROOT/$STAMP"
rsync -a --delete data/gallery/ "$BACKUP_ROOT/$STAMP/gallery/"
[ -f data/audit.jsonl ] && cp data/audit.jsonl "$BACKUP_ROOT/$STAMP/audit.jsonl"

# 2. Verify: count works in the snapshot vs the live directory.
diff <(cd data/gallery && find . -type f | sort) \
     <(cd "$BACKUP_ROOT/$STAMP/gallery" && find . -type f | sort) \
  && echo "backup $STAMP verified"

# 3. Prune snapshots older than 30 days.
find "$BACKUP_ROOT" -maxdepth 1 -type d -mtime +30 -exec rm -rf {} +
```

Notes:

- Run the copy while the server is running — reads are plain file
  reads, and a work saved mid-copy either lands in this snapshot or
  the next one; there is no transaction to corrupt. (A torn JSON
  record is possible in theory if a write lands mid-copy; the
  reader in `lib/storage.js` already skips corrupt records rather
  than failing the whole gallery, and the next snapshot repairs it.)
- The `data/` directory is gitignored — never "back up" by committing
  it. That would put children's drawings in git history.
- Test the restore (below) after setting this up, not when you need it.

## 4. How to restore (local backend)

```bash
# 1. Stop the server (prevents a transform writing mid-restore).
# 2. Restore the snapshot over data/gallery/ (and audit.jsonl if kept).
rsync -a --delete /var/backups/rabisco-magico/<STAMP>/gallery/ data/gallery/
[ -f /var/backups/rabisco-magico/<STAMP>/audit.jsonl ] \
  && cp /var/backups/rabisco-magico/<STAMP>/audit.jsonl data/audit.jsonl
# 3. Start the server.
npm start
# 4. Verify: pick one restored account and check GET /api/gallery
#    returns its works (parent session required), and that a
#    thumbnail loads from /gallery-files/<account>/<workId>-thumb.png.
```

Restoring does **not** restore: parent accounts, sessions, quota
usage, metrics, or referral codes (all in-memory — see §1). After a
restore, parents sign in again via magic link and quota restarts from
zero for the 5-free count. Say so honestly if a parent asks; do not
present a gallery restore as a full account restore.

Restoring does **not** rewrite the audit log: a restore is itself an
operational event, not a user action. If the audit log is file-backed,
append nothing for the restore (there is no audit action for it);
note the restore in the host's job log instead.

## 5. What the S3 swap changes

`lib/storage.js` has an `S3CompatibleStorage` stub: setting
`STORAGE_BACKEND=s3` today makes every gallery call throw
`STORAGE_NOT_CONFIGURED`. When a real S3-compatible client is wired,
the backup story changes in these ways:

| | Local disk | S3 |
|---|---|---|
| Live copy | `data/gallery/<account>/` files on the host disk | Objects in the bucket (`<account>/<workId>.json`, `<workId>-thumb.png`) |
| Backup | rsync snapshot of the directory (§3) | Bucket versioning + a second bucket/region copy, or a scheduled `aws s3 sync` to a backup bucket. No rsync of local files — there are none. |
| Restore | rsync back (§4) | Copy the objects back, or point the app at the backup bucket and re-point DNS/config. The storage interface is identical, so the app code does not change — only the env config does. |
| Purge | `scripts/purge-expired.js` walks the local directory | The purge must be wired for S3 too (see `docs/data-retention.md`) — **do not switch to S3 until it is**, or anonymous works will never auto-purge and backups will keep them indefinitely. |
| Deletion | `rm` of the JSON + thumbnail | Object delete (+ delete marker if versioning is on — a versioned delete is not a real delete; expire the versions too, or a "deleted" drawing survives in version history). |
| Generated images | Still fal.ai URLs by reference | Unchanged — the bucket holds records and thumbnails, not generated images. |

## 6. Deletion vs backup (the trap)

A parent deleting their gallery must actually delete it. Two rules:

1. **The next backup after a deletion must not contain the deleted
   works.** That is why §3 uses `rsync --delete` instead of an
   ever-growing copy. An append-only backup would silently keep every
   "deleted" drawing.
2. **Backups older than 30 days are pruned** (§2). A deletion request
   is therefore fully honoured within 30 days at most (live data
   immediately, backup copies within the prune window). The privacy
   policy must state this window honestly once the lawyer confirms it
   — see the open item in `docs/data-retention.md`.

## 7. Checklist before launch

- [ ] Persistent disk attached (or S3 wired with purge).
- [ ] Daily snapshot job running; first snapshot verified with the
      `diff` check in §3.
- [ ] One practice restore done on a staging copy, gallery verified
      via `GET /api/gallery`.
- [ ] Snapshot pruning (30 days) running.
- [ ] No `.env`, key, or token in any backup path (check with
      `grep -r "FAL_KEY\|STRIPE_SECRET" <backup-root>` — must be empty).
- [ ] Privacy policy states the 30-day backup window (lawyer sign-off).
