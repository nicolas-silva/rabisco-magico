/**
 * Rabisco Mágico — structured server logging.
 *
 * One JSON object per line on stdout (JSON lines), so a host log
 * collector can parse it without any dependency:
 *
 *   {"ts":"...","level":"info","event":"transform_failed",
 *    "requestId":"...","code":"FAL_FAILED"}
 *
 * Levels: debug < info < warn < error. LOG_LEVEL (default "info")
 * filters below the threshold. LOG_FILE, if set, also appends each
 * line to that file (e.g. "data/server.jsonl"); a write failure is
 * swallowed after one plain stderr line so logging never crashes
 * the server.
 *
 * What is NEVER logged (enforced by scrub(), applied to every field):
 * API keys / tokens / secrets / passwords, parent emails, child
 * titles and phrases, image URLs, image bytes / data URIs, drawing
 * contents, and any string that looks like a long opaque token.
 * Callers pass only short machine-readable fields (event codes,
 * counts, status codes, durations). If a caller accidentally passes
 * a forbidden field, scrub() drops or redacts it — it never reaches
 * the log line. Request bodies are never logged.
 */
"use strict";

const fs = require("fs");

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function configuredLevel() {
  const raw = String(process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] !== undefined ? raw : "info";
}

// Keys that must never appear in a log line, matched case-insensitively
// against the field name (substring match, so "stripeSecretKey" is caught).
const FORBIDDEN_KEY = /key|token|secret|password|passwd|auth|email|image|drawing|thumb|titulo|title|frase|phrase|base64|dataurl|session|cookie|credential|bearer/i;
// A long opaque-looking value (e.g. a pasted key) is redacted even under
// an innocent field name.
const LONG_TOKEN = /[A-Za-z0-9_\-.]{32,}/;

function scrubValue(value) {
  if (typeof value === "string") {
    if (value.startsWith("data:image/") || value.includes("base64")) return "[redacted-image]";
    if (LONG_TOKEN.test(value)) return "[redacted-long-token]";
    return value.length > 500 ? value.slice(0, 500) + "…" : value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(scrubValue);
  if (value && typeof value === "object") return scrub(value);
  return value;
}

function scrub(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (FORBIDDEN_KEY.test(key)) continue; // drop the field entirely
    // requestId is a server-generated random UUID, not a secret: it must
    // survive scrubbing, or log lines can never be joined to errors.
    if (key === "requestId") {
      out[key] = typeof value === "string" ? value.slice(0, 64) : value;
      continue;
    }
    out[key] = scrubValue(value);
  }
  return out;
}

function writeLine(line) {
  try {
    process.stdout.write(line + "\n");
  } catch (_e) {
    /* stdout gone — nothing safe left to do */
  }
  const file = process.env.LOG_FILE;
  if (file) {
    try {
      fs.appendFileSync(file, line + "\n");
    } catch (_e) {
      /* one plain warning, then never again for this process */
      if (!writeLine.warned) {
        writeLine.warned = true;
        try {
          process.stderr.write("[rabisco] log file write failed (non-fatal)\n");
        } catch (_e2) {
          /* ignore */
        }
      }
    }
  }
}

function log(level, event, fields) {
  if (LEVELS[level] < LEVELS[configuredLevel()]) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event: String(event),
    ...scrub(fields),
  });
  writeLine(line);
}

module.exports = {
  LEVELS,
  configuredLevel,
  scrub,
  debug(event, fields) {
    log("debug", event, fields);
  },
  info(event, fields) {
    log("info", event, fields);
  },
  warn(event, fields) {
    log("warn", event, fields);
  },
  error(event, fields) {
    log("error", event, fields);
  },
  // Bound logger that always attaches the same requestId.
  child(requestId) {
    const withId = (fields) => ({ requestId: requestId || null, ...(fields || {}) });
    return {
      debug: (event, fields) => log("debug", event, withId(fields)),
      info: (event, fields) => log("info", event, withId(fields)),
      warn: (event, fields) => log("warn", event, withId(fields)),
      error: (event, fields) => log("error", event, withId(fields)),
    };
  },
};
