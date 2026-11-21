/**
 * Rabisco Mágico — account + token persistence.
 *
 * Parent accounts, magic-link tokens and sessions must survive across
 * server restarts and across Vercel serverless instances. The in-memory
 * Maps in lib/accounts.js do neither: a parent who clicks an emailed
 * magic link can land on an instance that never saw their token.
 *
 * This module is the storage abstraction for that state. Backends:
 *
 *   memory (default) — the current behaviour. Data lives only in this
 *     process. Fine for tests and for a single local dev server.
 *
 *   file — ACCOUNTS_BACKEND=file. State is a JSON file (default
 *     data/accounts.json, override with ACCOUNTS_FILE). Local dev only:
 *     it does not work on Vercel — the serverless filesystem is
 *     ephemeral and is not shared between instances. The file is
 *     gitignored; it contains magic-link and session tokens, so treat
 *     it like a credential and never commit or share it.
 *
 *   kv — ACCOUNTS_BACKEND=kv. A generic Upstash-style REST key-value
 *     store: ACCOUNTS_KV_REST_API_URL + ACCOUNTS_KV_REST_API_TOKEN,
 *     one key (ACCOUNTS_KV_KEY, default "rabisco:accounts") holding the
 *     whole state document as JSON. Provision it in Vercel (Storage →
 *     Upstash KV, free tier) and connect it to the project; the
 *     KV_REST_API_URL / KV_REST_API_TOKEN env vars it creates are the
 *     values to use here. No KV store is provisioned by this repo —
 *     until one is connected, the Vercel deployment runs on memory and
 *     magic links are unreliable there.
 *
 * The state document is { accounts: [...], magicTokens: [...], sessions: [...] }
 * where each entry is a plain JSON value. Tokens are random 64-hex
 * strings; the store itself must be access-controlled (it is the
 * credential store for parent sign-in).
 */
"use strict";

const fs = require("fs");
const path = require("path");

function backendFromEnv() {
  return (process.env.ACCOUNTS_BACKEND || "memory").toLowerCase();
}

function emptyState() {
  return { accounts: [], magicTokens: [], sessions: [] };
}

function createStore() {
  const backend = backendFromEnv();

  if (backend === "file") {
    const file = process.env.ACCOUNTS_FILE || path.join(process.cwd(), "data", "accounts.json");
    return {
      backend: "file",
      async load() {
        try {
          const raw = await fs.promises.readFile(file, "utf8");
          const parsed = JSON.parse(raw);
          if (!parsed || !Array.isArray(parsed.accounts)) return emptyState();
          return {
            accounts: parsed.accounts,
            magicTokens: Array.isArray(parsed.magicTokens) ? parsed.magicTokens : [],
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
          };
        } catch (err) {
          if (err && err.code === "ENOENT") return emptyState();
          throw err;
        }
      },
      async save(state) {
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        const tmp = file + ".tmp-" + process.pid;
        await fs.promises.writeFile(tmp, JSON.stringify(state), "utf8");
        await fs.promises.rename(tmp, file);
      },
    };
  }

  if (backend === "kv") {
    const url = (process.env.ACCOUNTS_KV_REST_API_URL || "").replace(/\/+$/, "");
    const token = process.env.ACCOUNTS_KV_REST_API_TOKEN || "";
    const key = process.env.ACCOUNTS_KV_KEY || "rabisco:accounts";
    if (!url || !token) {
      throw new Error(
        "ACCOUNTS_BACKEND=kv needs ACCOUNTS_KV_REST_API_URL and ACCOUNTS_KV_REST_API_TOKEN"
      );
    }
    return {
      backend: "kv",
      async load() {
        const res = await fetch(url + "/get/" + encodeURIComponent(key), {
          headers: { Authorization: "Bearer " + token },
        });
        if (res.status === 404) return emptyState();
        if (!res.ok) throw new Error("kv load failed: http " + res.status);
        const data = await res.json();
        if (!data || !data.result) return emptyState();
        const parsed = typeof data.result === "string" ? JSON.parse(data.result) : data.result;
        if (!parsed || !Array.isArray(parsed.accounts)) return emptyState();
        return {
          accounts: parsed.accounts,
          magicTokens: Array.isArray(parsed.magicTokens) ? parsed.magicTokens : [],
          sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        };
      },
      async save(state) {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify(["SET", key, JSON.stringify(state)]),
        });
        if (!res.ok) throw new Error("kv save failed: http " + res.status);
      },
    };
  }

  // memory — no persistence.
  let state = null;
  return {
    backend: "memory",
    async load() {
      return state ? JSON.parse(JSON.stringify(state)) : emptyState();
    },
    async save(next) {
      state = JSON.parse(JSON.stringify(next));
    },
  };
}

module.exports = { createStore, emptyState };
