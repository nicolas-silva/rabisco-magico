/**
 * Rabisco Mágico — structured audit logging.
 *
 * One JSON object per event, one line each. Audit events record THAT
 * something happened, never WHAT a child drew or wrote:
 *
 *   { ts, event_id, account_id_hash, action, outcome, cost_usd,
 *     reason, work_id }
 *
 * Field rules (enforced by logEvent — only these fields are ever emitted):
 *   ts              ISO-8601 timestamp of the event.
 *   event_id        Random id for the event itself ("evt_<hex>").
 *   account_id_hash SHA-256 of (AUDIT_HASH_SALT + ":" + accountId).
 *                   The raw account id and the parent's email are NEVER
 *                   logged. Set AUDIT_HASH_SALT to a long random value in
 *                   production (env); the built-in default is only for
 *                   dev and must be replaced before launch — rotating the
 *                   salt breaks linkability of old hashes, which is
 *                   expected and fine.
 *   action          One of the ACTIONS below.
 *   outcome         "success" | "blocked" | "failed".
 *   cost_usd        Estimated provider cost of the event, or 0. A blocked
 *                   transform costs 0 when blocked before generation
 *                   (blocklist) and ~US$0.045 when blocked after it
 *                   (output-safety fail — the image was already made).
 *   reason          Short machine-readable enum (e.g. "blocklist",
 *                   "output_safety", "fal_failed"). For a blocklist hit
 *                   this is the CATEGORY (sexual/profanity/...) — the
 *                   matched words themselves are never logged.
 *   work_id         Opaque stored-work id ("work_<hex>"), or null. No
 *                   title, phrase, image URL, or drawing data.
 *
 * NEVER in an audit event, by design (logEvent drops any other field,
 * even if a caller passes it): email, name, title, phrase, image URL /
 * image bytes, drawing contents, birthday, photo, device id, IP address.
 *
 * Storage: in-memory ring buffer (last 1000 events) + optional JSONL
 * file append when AUDIT_LOG_FILE is set (e.g. "data/audit.jsonl").
 * Logging never throws and never blocks a transform — a write failure
 * is swallowed after one console warning.
 *
 * Retention: audit logs are kept 12 months, then deleted (see
 * docs/data-retention.md). The in-memory buffer resets on restart.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const logger = require("./logger");

const MAX_EVENTS = 1000;

const ACTIONS = {
  TRANSFORM_SUCCESS: "transform_success",
  TRANSFORM_BLOCKED_BLOCKLIST: "transform_blocked_blocklist",
  TRANSFORM_BLOCKED_OUTPUT_SAFETY: "transform_blocked_output_safety",
  TRANSFORM_FAILED: "transform_failed",
  GALLERY_DELETED: "gallery_deleted",
  GALLERY_DELETE_FAILED: "gallery_delete_failed",
  WORK_DELETED: "work_deleted",
  WORK_FAVOURITED: "work_favourited",
  REFERRAL_REDEEMED: "referral_redeemed",
};

const events = []; // ring buffer, oldest first

function hashAccountId(accountId) {
  const salt = process.env.AUDIT_HASH_SALT || "rabisco-audit-v1-dev-only";
  return crypto
    .createHash("sha256")
    .update(salt + ":" + String(accountId || "anonymous"))
    .digest("hex");
}

function logEvent(input) {
  const event = {
    ts: new Date().toISOString(),
    event_id: "evt_" + crypto.randomBytes(8).toString("hex"),
    account_id_hash: hashAccountId(input && input.accountId),
    action: String((input && input.action) || "unknown"),
    outcome: String((input && input.outcome) || "success"),
    cost_usd: typeof input && typeof input.costUsd === "number" ? input.costUsd : 0,
    reason: input && input.reason ? String(input.reason) : null,
    work_id: input && input.workId ? String(input.workId) : null,
  };
  // Deliberately allowlist-only: any other field the caller passed
  // (email, titulo, frase, imageUrl, ...) is dropped here, not logged.
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  const file = process.env.AUDIT_LOG_FILE;
  if (file) {
    try {
      fs.appendFileSync(file, JSON.stringify(event) + "\n");
    } catch (err) {
      logger.warn("audit_log_write_failed");
    }
  }
  return event;
}

/** Copy of the buffered events, oldest first. Never contains raw ids. */
function getEvents() {
  return events.map((e) => ({ ...e }));
}

function count() {
  return events.length;
}

module.exports = {
  ACTIONS,
  MAX_EVENTS,
  hashAccountId,
  logEvent,
  getEvents,
  count,
  _testReset() {
    events.length = 0;
  },
};
