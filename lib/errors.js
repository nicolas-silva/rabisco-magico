/**
 * Rabisco Mágico — error-monitoring stub (no third-party service).
 *
 * Server-side errors are captured in-memory (ring buffer, last 100
 * entries) and optionally appended as JSON lines to ERROR_LOG_FILE
 * (e.g. "data/errors.jsonl"). There is no external SDK, no account,
 * and no credential: nothing leaves the server. An admin can inspect
 * the buffer at GET /api/admin/errors (x-admin-token, same token as
 * the cost dashboard).
 *
 * What is captured per error: a random id, first/last seen timestamps,
 * a short machine-readable code (e.g. "FAL_FAILED"), the route and
 * method, the request id (to join with the structured log), a
 * truncated message, and a count of identical repeats (same code +
 * route + message collapses into one entry instead of flooding the
 * buffer). What is NEVER captured: the full error object, stack
 * traces that could embed request data, API keys, tokens, emails,
 * titles/phrases, image URLs, drawing contents, or request bodies.
 * Messages are scrubbed with the same rules as lib/logger.js.
 *
 * capture() never throws and never blocks a request — a failed file
 * append is swallowed after one stderr warning.
 *
 * This is a stub on purpose: when a real error service is adopted,
 * replace capture() with the SDK call and keep the same call sites
 * and the same no-child-data rule.
 */
"use strict";

const fs = require("fs");
const logger = require("./logger");

const MAX_ERRORS = 100;

const errors = []; // newest last; identical repeats collapse via `count`

function keyOf(entry) {
  return entry.code + "|" + entry.route + "|" + entry.message;
}

function sanitiseMessage(err) {
  let message = "";
  if (err instanceof Error) message = err.message || "";
  else if (typeof err === "string") message = err;
  else if (err && typeof err === "object") message = String(err.code || err.message || "error");
  else message = "error";
  // Reuse the logger's scrubbing: drops data URIs and long tokens.
  const cleaned = logger.scrub({ message }).message || "error";
  return String(cleaned).slice(0, 200);
}

function capture(err, context) {
  try {
    const ctx = context || {};
    const entry = {
      id: "err_" + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6),
      ts: new Date().toISOString(),
      code: err && err.code ? String(err.code).slice(0, 64) : "ERROR",
      message: sanitiseMessage(err),
      route: ctx.route ? String(ctx.route).slice(0, 128) : null,
      method: ctx.method ? String(ctx.method).slice(0, 16) : null,
      requestId: ctx.requestId ? String(ctx.requestId).slice(0, 64) : null,
      count: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    const existing = errors.find((e) => keyOf(e) === keyOf(entry));
    if (existing) {
      existing.count += 1;
      existing.lastSeen = entry.lastSeen;
      existing.requestId = entry.requestId;
    } else {
      errors.push(entry);
      if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
    }
    const file = process.env.ERROR_LOG_FILE;
    if (file) {
      try {
        fs.appendFileSync(file, JSON.stringify(existing || entry) + "\n");
      } catch (_e) {
        if (!capture.warned) {
          capture.warned = true;
          try {
            process.stderr.write("[rabisco] error log file write failed (non-fatal)\n");
          } catch (_e2) {
            /* ignore */
          }
        }
      }
    }
    return existing || entry;
  } catch (_e) {
    return null; // error monitoring must never break the request
  }
}

function getErrors() {
  return errors.map((e) => ({ ...e }));
}

function count() {
  return errors.reduce((n, e) => n + e.count, 0);
}

module.exports = {
  MAX_ERRORS,
  capture,
  getErrors,
  count,
  _testReset() {
    errors.length = 0;
  },
};
