/**
 * Rabisco Mágico — purge expired anonymous gallery works.
 *
 * Deletes only works whose retention.deleteAfter has passed — i.e.
 * anonymous (no-parent-account) works older than GALLERY_RETENTION_DAYS
 * (default 90). Parent-account works have deleteAfter: null and are
 * NEVER touched by this script. This is a deliberate, scheduled
 * operation, not something the transform flow does on its own.
 *
 * Usage:
 *   node scripts/purge-expired.js            # purge, print a summary
 *   node scripts/purge-expired.js --dry-run  # report only, delete nothing
 *
 * Run it from a scheduler (e.g. a daily cron on the host). It prints a
 * one-line JSON summary: { accounts, purged, dryRun }. It never deletes
 * real user data beyond the expired anonymous works described in
 * docs/data-retention.md, and it never touches audit logs.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createStorageFromEnv } = require("../lib/storage");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const storage = createStorageFromEnv();
  if (storage.backend !== "local") {
    console.log(JSON.stringify({ accounts: 0, purged: 0, dryRun, note: "purge only implemented for local storage; wire it for s3 before using STORAGE_BACKEND=s3" }));
    return;
  }
  const root = storage.rootDir;
  let accountDirs = [];
  try {
    accountDirs = (await fs.promises.readdir(root, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch (_e) {
    accountDirs = [];
  }
  let purged = 0;
  for (const accountId of accountDirs) {
    if (dryRun) {
      const works = await storage.listWorks(accountId);
      const nowIso = new Date().toISOString();
      purged += works.filter((w) => w.retention && w.retention.deleteAfter && w.retention.deleteAfter <= nowIso).length;
    } else {
      purged += await storage.purgeExpiredWorks(accountId);
    }
  }
  console.log(JSON.stringify({ accounts: accountDirs.length, purged, dryRun }));
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[rabisco] purge-expired failed:", err && err.message ? err.message : err);
    process.exitCode = 1;
  });
}

module.exports = { main };
