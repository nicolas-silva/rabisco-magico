# Audit log schema — Rabisco Mágico

Structured audit events for transforms and deletions. One JSON object
per event, one line each (JSONL when `AUDIT_LOG_FILE` is set). See
`lib/audit.js` for the implementation.

## Schema

| Field | Type | Example | Notes |
|---|---|---|---|
| `ts` | string (ISO-8601) | `"2026-11-20T12:34:56.789Z"` | When the event happened. |
| `event_id` | string | `"evt_9f2c…" ` | Random id for the event itself. |
| `account_id_hash` | string (64 hex) | `"a3f9…"` (SHA-256) | `SHA-256(AUDIT_HASH_SALT + ":" + accountId)`. The raw account id and the parent's email are **never** logged. Set `AUDIT_HASH_SALT` to a long random value in production; the built-in default is dev-only. Rotating the salt breaks linkability of old hashes — that is expected. |
| `action` | string (enum) | `"transform_success"` | See actions below. |
| `outcome` | string (enum) | `"success"` \| `"blocked"` \| `"failed"` | |
| `cost_usd` | number | `0.045` or `0` | Estimated provider cost. Blocked-before-generation = 0; blocked-after-generation (output-safety fail) = 0.045, because the image was already made. Successful transform = 0.045. |
| `reason` | string \| null | `"blocklist:profanity"` | Short machine-readable enum. For a blocklist hit this is the **category only** — the matched words are never logged. |
| `work_id` | string \| null | `"work_9f2c…"` | Opaque stored-work id, or null when nothing was stored. |

## Actions

| Action | When | Outcome | `cost_usd` |
|---|---|---|---|
| `transform_success` | A transform completed and (best effort) was stored | `success` | 0.045 |
| `transform_blocked_blocklist` | Vision title/phrase hit the blocklist (before any image call) | `blocked` | 0 |
| `transform_blocked_output_safety` | Generated image failed the output check (after generation) | `blocked` | 0.045 |
| `transform_failed` | fal.ai / vision / other failure | `failed` | 0 |
| `gallery_deleted` | Parent wiped the whole gallery | `success` | 0 |
| `gallery_delete_failed` | Gallery wipe failed | `failed` | 0 |
| `work_deleted` | (Reserved) single-work deletion, when the API exists | `success` | 0 |

## What is never in an audit event

By design, `logEvent()` emits an allowlist of fields only. Even if a
caller passes extra data, it is dropped. Never logged: parent email,
child name, title, phrase, image URL or image bytes, drawing contents,
birthday, photo, device id, IP address, API keys.

Example (a blocked transform — note what is *absent*):

```json
{"ts":"2026-11-20T12:34:56.789Z","event_id":"evt_9f2c41aa08b1c2d3","account_id_hash":"a3f9c1…","action":"transform_blocked_blocklist","outcome":"blocked","cost_usd":0,"reason":"blocklist:profanity","work_id":null}
```

## Storage & retention

- In-memory ring buffer (last 1000 events) — resets on restart.
- Optional JSONL file: set `AUDIT_LOG_FILE` (e.g. `data/audit.jsonl`).
  Appends only; a write failure is logged once as a warning and never
  blocks a transform.
- Retained **12 months**, then deleted (see `docs/data-retention.md`).
- The admin dashboard (`GET /api/admin/dashboard`) reports only the
  **count** of buffered events (`auditEvents`), never the events
  themselves — events are read from the JSONL file on the host.
