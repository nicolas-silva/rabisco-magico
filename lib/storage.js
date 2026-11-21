/**
 * Rabisco Mágico — gallery storage abstraction.
 *
 * The device keeps only URLs. Generated images (and the metadata that
 * describes them) live server-side behind this interface:
 *
 *   saveWork(accountId, work)   -> { id, url }   (work: {titulo, frase,
 *                                                  imageUrl, thumb?,
 *                                                  favourite?})
 *   listWorks(accountId, opts?) -> [ {id, titulo, frase, imageUrl,
 *                                      favourite, createdAt} ]
 *     opts.query            — case/accent-insensitive search on title
 *                             + phrase (empty = no filtering)
 *     opts.favouritesFirst  — favourites first, then newest (default
 *                             true); false = newest first only
 *   setFavourite(accountId, id, favourite) -> boolean
 *   deleteWork(accountId, id)   -> boolean
 *   deleteAccountGallery(accountId) -> number of works deleted
 *
 * Implementations:
 *   LocalDiskStorage  — dev default. Writes one JSON file per work under
 *                       data/gallery/<accountId>/ (gitignored). The
 *                       generated image itself is NOT re-downloaded: the
 *                       fal.ai URL is stored, so the device only ever
 *                       holds URLs. The child's original drawing
 *                       thumbnail is stored alongside as a PNG file.
 *   S3CompatibleStorage — production stub. Env-configured, no credentials
 *                       in the repo. Every method throws
 *                       STORAGE_NOT_CONFIGURED until the S3 swap is wired
 *                       (see README "Gallery storage"). The interface is
 *                       identical, so the swap is a one-line env change.
 *
 * Env: STORAGE_BACKEND=local (default) | s3
 *      S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID,
 *      S3_SECRET_ACCESS_KEY (all placeholders in .env.example).
 *      GALLERY_RETENTION_DAYS — auto-purge window for anonymous
 *      (no-parent-account) works, default 90 (see docs/data-retention.md).
 *
 * Retention hooks: every saved work carries a `retention` record
 * ({ policy, createdAt, deleteAfter, retentionDays }). Parent-account
 * works are policy "parent_controlled" (deleteAfter null — kept until
 * the parent deletes them or closes the account). Anonymous works are
 * policy "auto_purge" with deleteAfter = createdAt + retentionDays.
 * purgeExpiredWorks(accountId, now) deletes works past deleteAfter and
 * returns how many it removed; it is NOT run automatically — run it
 * from a scheduled job (scripts/purge-expired.js) so deletion is
 * deliberate and auditable. Deleting real user data is never done by
 * the transform flow.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function thumbToPngBuffer(thumbDataUrl) {
  if (typeof thumbDataUrl !== "string" || !thumbDataUrl.startsWith("data:image/png;base64,")) return null;
  try {
    return Buffer.from(thumbDataUrl.split(",", 2)[1], "base64");
  } catch (_e) {
    return null;
  }
}

function defaultRetentionDays() {
  const v = Number(process.env.GALLERY_RETENTION_DAYS || "90");
  return Number.isFinite(v) && v > 0 ? v : 90;
}

/**
 * Retention record for a stored work. `autoPurge` is true only for
 * anonymous works (no parent account): they get a deleteAfter deadline.
 * Parent-account works are kept until the parent deletes them, so
 * deleteAfter is null. Returns { policy, createdAt, deleteAfter,
 * retentionDays }.
 */
function retentionRecord(createdAt, { autoPurge = false, retentionDays = defaultRetentionDays() } = {}) {
  if (!autoPurge) {
    return { policy: "parent_controlled", createdAt, deleteAfter: null, retentionDays };
  }
  const deleteAfter = new Date(new Date(createdAt).getTime() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return { policy: "auto_purge", createdAt, deleteAfter, retentionDays };
}

function normaliseForSearch(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

class LocalDiskStorage {
  constructor(rootDir) {
    this.rootDir = rootDir || path.join(__dirname, "..", "data", "gallery");
    this.backend = "local";
  }

  _dir(accountId) {
    return path.join(this.rootDir, String(accountId).replace(/[^a-zA-Z0-9_-]/g, "_"));
  }

  async saveWork(accountId, work, opts = {}) {
    const id = "work_" + crypto.randomBytes(8).toString("hex");
    const dir = this._dir(accountId);
    await fs.promises.mkdir(dir, { recursive: true });
    const createdAt = new Date().toISOString();
    const thumbBuf = thumbToPngBuffer(work.thumb);
    let thumbUrl = null;
    if (thumbBuf) {
      await fs.promises.writeFile(path.join(dir, id + "-thumb.png"), thumbBuf);
      thumbUrl = "/gallery-files/" + encodeURIComponent(accountId) + "/" + id + "-thumb.png";
    }
    const record = {
      id,
      titulo: work.titulo || "",
      frase: work.frase || "",
      imageUrl: work.imageUrl || "", // fal.ai URL — device keeps only URLs
      thumbUrl,
      favourite: Boolean(work.favourite),
      createdAt,
      retention: retentionRecord(createdAt, opts),
    };
    await fs.promises.writeFile(path.join(dir, id + ".json"), JSON.stringify(record, null, 2));
    return { id, url: "/gallery-files/" + encodeURIComponent(accountId) + "/" + id + ".json" };
  }

  async listWorks(accountId, opts = {}) {
    const dir = this._dir(accountId);
    let names;
    try {
      names = await fs.promises.readdir(dir);
    } catch (_e) {
      return [];
    }
    const works = [];
    for (const name of names.filter((n) => n.endsWith(".json"))) {
      try {
        const work = JSON.parse(await fs.promises.readFile(path.join(dir, name), "utf8"));
        // Older records predate favourites: default to not favourite.
        if (typeof work.favourite !== "boolean") work.favourite = false;
        works.push(work);
      } catch (_e) {
        // Skip a corrupt record rather than failing the whole gallery.
      }
    }
    // Search: case- and accent-insensitive match on title + phrase.
    const query = normaliseForSearch(opts.query).trim();
    const filtered = query
      ? works.filter((w) => normaliseForSearch((w.titulo || "") + " " + (w.frase || "")).includes(query))
      : works;
    // Favourites first (default), then newest first within each group.
    const favouritesFirst = opts.favouritesFirst !== false;
    return filtered.sort((a, b) => {
      if (favouritesFirst && Boolean(a.favourite) !== Boolean(b.favourite)) {
        return a.favourite ? -1 : 1;
      }
      return a.createdAt < b.createdAt ? 1 : -1;
    });
  }

  /**
   * Toggle a work's favourite flag. Returns true when the work was
   * found and updated, false when there is no such work.
   */
  async setFavourite(accountId, id, favourite) {
    const dir = this._dir(accountId);
    const file = path.join(dir, String(id).replace(/[^a-zA-Z0-9_-]/g, "_") + ".json");
    let record;
    try {
      record = JSON.parse(await fs.promises.readFile(file, "utf8"));
    } catch (_e) {
      return false;
    }
    record.favourite = Boolean(favourite);
    await fs.promises.writeFile(file, JSON.stringify(record, null, 2));
    return true;
  }

  async deleteWork(accountId, id) {
    const dir = this._dir(accountId);
    let deleted = false;
    for (const name of [id + ".json", id + "-thumb.png"]) {
      try {
        await fs.promises.unlink(path.join(dir, name));
        deleted = true;
      } catch (_e) {
        // Already gone — fine.
      }
    }
    return deleted;
  }

  async deleteAccountGallery(accountId) {
    const works = await this.listWorks(accountId);
    const dir = this._dir(accountId);
    await fs.promises.rm(dir, { recursive: true, force: true });
    return works.length;
  }

  /**
   * Delete works whose retention.deleteAfter has passed. Only works
   * with policy "auto_purge" and a past deleteAfter are removed;
   * parent-controlled works (deleteAfter null) are never touched here.
   * Returns the number of works purged. Not run automatically — call
   * from scripts/purge-expired.js on a schedule.
   */
  async purgeExpiredWorks(accountId, now = new Date()) {
    const nowIso = now instanceof Date ? now.toISOString() : String(now);
    const works = await this.listWorks(accountId);
    let purged = 0;
    for (const work of works) {
      const del = work && work.retention && work.retention.deleteAfter;
      if (del && del <= nowIso) {
        if (await this.deleteWork(accountId, work.id)) purged += 1;
      }
    }
    return purged;
  }
}

class S3CompatibleStorage {
  constructor(config) {
    this.backend = "s3";
    this.config = {
      bucket: config.bucket || "",
      region: config.region || "",
      endpoint: config.endpoint || "",
      configured: Boolean(config.bucket && config.accessKeyId && config.secretAccessKey),
    };
  }

  _stub(method) {
    const err = new Error(
      "S3 storage is a stub in this build: STORAGE_BACKEND=s3 is set but the " +
        "S3 client is not wired yet (" + method + "). Set STORAGE_BACKEND=local " +
        "for dev, or wire an S3-compatible client (see README)."
    );
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  async saveWork() {
    this._stub("saveWork");
  }
  async listWorks() {
    this._stub("listWorks");
  }
  async setFavourite() {
    this._stub("setFavourite");
  }
  async deleteWork() {
    this._stub("deleteWork");
  }
  async deleteAccountGallery() {
    this._stub("deleteAccountGallery");
  }
  async purgeExpiredWorks() {
    this._stub("purgeExpiredWorks");
  }
}

function createStorageFromEnv() {
  if ((process.env.STORAGE_BACKEND || "local").toLowerCase() === "s3") {
    return new S3CompatibleStorage({
      bucket: process.env.S3_BUCKET || "",
      region: process.env.S3_REGION || "",
      endpoint: process.env.S3_ENDPOINT || "",
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    });
  }
  return new LocalDiskStorage();
}

module.exports = {
  LocalDiskStorage,
  S3CompatibleStorage,
  createStorageFromEnv,
  retentionRecord,
  defaultRetentionDays,
};
