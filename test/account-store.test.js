/* Rabisco Mágico — account-store backends tests.
 *
 * Run: npm test
 *
 * The store is what makes magic links survive restarts and (with the kv
 * backend) across Vercel serverless instances. Memory is the default,
 * file is local-dev only, kv is a generic Upstash-style REST store.
 * The kv test stubs global fetch — no network, no account created.
 */
"use strict";

const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createStore, emptyState } = require("../lib/account-store");

const OLD_BACKEND = process.env.ACCOUNTS_BACKEND;
const OLD_FILE = process.env.ACCOUNTS_FILE;
const OLD_KV_URL = process.env.ACCOUNTS_KV_REST_API_URL;
const OLD_KV_TOKEN = process.env.ACCOUNTS_KV_REST_API_TOKEN;
const OLD_FETCH = global.fetch;

const SAMPLE = {
  accounts: [{ id: "par_1", email: "mae@exemplo.com", plan: "free", packTransforms: 0, bonusTransforms: 0, familyUsedThisMonth: 0, subscriptionId: null, createdAt: "2026-11-22T00:00:00.000Z" }],
  magicTokens: [{ token: "tok1", accountId: "par_1", expiresAt: 9999999999999 }],
  sessions: [{ token: "ses1", accountId: "par_1", expiresAt: 9999999999999 }],
};

beforeEach(() => {
  delete process.env.ACCOUNTS_BACKEND;
  delete process.env.ACCOUNTS_FILE;
  delete process.env.ACCOUNTS_KV_REST_API_URL;
  delete process.env.ACCOUNTS_KV_REST_API_TOKEN;
  global.fetch = OLD_FETCH;
});

after(() => {
  if (OLD_BACKEND === undefined) delete process.env.ACCOUNTS_BACKEND;
  else process.env.ACCOUNTS_BACKEND = OLD_BACKEND;
  if (OLD_FILE === undefined) delete process.env.ACCOUNTS_FILE;
  else process.env.ACCOUNTS_FILE = OLD_FILE;
  if (OLD_KV_URL === undefined) delete process.env.ACCOUNTS_KV_REST_API_URL;
  else process.env.ACCOUNTS_KV_REST_API_URL = OLD_KV_URL;
  if (OLD_KV_TOKEN === undefined) delete process.env.ACCOUNTS_KV_REST_API_TOKEN;
  else process.env.ACCOUNTS_KV_REST_API_TOKEN = OLD_KV_TOKEN;
  global.fetch = OLD_FETCH;
});

test("store: memory backend round-trips state, empty at first", async () => {
  const store = createStore();
  assert.equal(store.backend, "memory");
  assert.deepEqual(await store.load(), emptyState());
  await store.save(SAMPLE);
  assert.deepEqual(await store.load(), SAMPLE);
});

test("store: file backend round-trips state to disk", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rabisco-acct-")), "accounts.json");
  process.env.ACCOUNTS_BACKEND = "file";
  process.env.ACCOUNTS_FILE = file;
  const store = createStore();
  assert.equal(store.backend, "file");
  assert.deepEqual(await store.load(), emptyState());
  await store.save(SAMPLE);
  assert.deepEqual(await store.load(), SAMPLE);
  assert.ok(fs.existsSync(file));
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

test("store: kv backend uses the Upstash-style REST API", async () => {
  process.env.ACCOUNTS_BACKEND = "kv";
  process.env.ACCOUNTS_KV_REST_API_URL = "https://kv.example.test";
  process.env.ACCOUNTS_KV_REST_API_TOKEN = "kv-test-token";
  let saved = null;
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes("/get/")) return { ok: true, status: 200, json: async () => ({ result: saved }) };
    saved = JSON.parse(opts.body)[2];
    return { ok: true, status: 200, json: async () => ({ result: "OK" }) };
  };
  const store = createStore();
  assert.equal(store.backend, "kv");
  assert.deepEqual(await store.load(), emptyState());
  await store.save(SAMPLE);
  assert.deepEqual(await store.load(), SAMPLE);
  assert.ok(calls.some((c) => c.url === "https://kv.example.test" && c.opts.method === "POST"));
  assert.ok(calls.every((c) => c.opts.headers.Authorization === "Bearer kv-test-token"));
});

test("store: kv backend without credentials throws at creation", () => {
  process.env.ACCOUNTS_BACKEND = "kv";
  assert.throws(() => createStore(), /ACCOUNTS_KV_REST_API_URL/);
});
