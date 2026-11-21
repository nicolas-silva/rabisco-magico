/**
 * Rabisco Mágico — cost dashboard metrics (in-memory, MOCK data).
 *
 * Tracks transform attempts/successes/failures per day and per calendar
 * month, and estimates AI spend at COST_PER_TRANSFORM_USD (US$0.045 —
 * fal.ai FLUX.2 Pro Edit $0.03 + vision, budget figure until the first
 * invoice confirms it).
 *
 * Env:
 *   DAILY_SPEND_ALERT_USD — spend level that flips `alertTriggered`
 *                           (default 5). Alert only — it never blocks.
 *   KILL_SWITCH / TRANSFORMS_DISABLED — set to "1" to pause ALL
 *                           transforms (server returns 503 "disabled").
 *
 * IMPORTANT: this is in-memory and resets on restart, and the spend is
 * an ESTIMATE, not a bill. The dashboard labels itself as mock data.
 * Production: persist counters in a database and reconcile against the
 * fal.ai / Stripe invoices.
 */
"use strict";

const COST_PER_TRANSFORM_USD = 0.045;

const dayKey = (d) => d.toISOString().slice(0, 10);
const monthKey = (d) => d.toISOString().slice(0, 7);

const days = new Map(); // "2026-11-20" -> { attempts, successes, failures }
const months = new Map(); // "2026-11" -> { attempts, successes, failures }

function _bucket(map, key) {
  let b = map.get(key);
  if (!b) {
    b = { attempts: 0, successes: 0, failures: 0 };
    map.set(key, b);
  }
  return b;
}

function recordAttempt() {
  const now = new Date();
  _bucket(days, dayKey(now)).attempts += 1;
  _bucket(months, monthKey(now)).attempts += 1;
}

function recordSuccess() {
  const now = new Date();
  _bucket(days, dayKey(now)).successes += 1;
  _bucket(months, monthKey(now)).successes += 1;
}

function recordFailure() {
  const now = new Date();
  _bucket(days, dayKey(now)).failures += 1;
  _bucket(months, monthKey(now)).failures += 1;
}

function _summary(bucket) {
  const successes = bucket.successes;
  const failures = bucket.failures;
  const attempts = bucket.attempts;
  return {
    transforms: successes,
    attempts,
    successes,
    failures,
    failureRate: attempts ? Number((failures / attempts).toFixed(3)) : 0,
    estimatedSpendUsd: Number((successes * COST_PER_TRANSFORM_USD).toFixed(3)),
  };
}

function killSwitchOn() {
  return process.env.KILL_SWITCH === "1" || process.env.TRANSFORMS_DISABLED === "1";
}

function dailySpendAlertThreshold() {
  const v = Number(process.env.DAILY_SPEND_ALERT_USD || "5");
  return Number.isFinite(v) && v > 0 ? v : 5;
}

function getDashboard(quotaSummary) {
  const now = new Date();
  const today = _summary(days.get(dayKey(now)) || { attempts: 0, successes: 0, failures: 0 });
  const month = _summary(months.get(monthKey(now)) || { attempts: 0, successes: 0, failures: 0 });
  const threshold = dailySpendAlertThreshold();
  return {
    dataLabel: "MOCK / IN-MEMORY — estimates only, resets on restart, not billing data",
    costPerTransformUsd: COST_PER_TRANSFORM_USD,
    today,
    month,
    quota: quotaSummary || { accounts: 0, totalFreeUsed: 0 },
    dailySpendAlertThresholdUsd: threshold,
    alertTriggered: today.estimatedSpendUsd >= threshold,
    killSwitch: killSwitchOn(),
    generatedAt: now.toISOString(),
  };
}

module.exports = {
  COST_PER_TRANSFORM_USD,
  recordAttempt,
  recordSuccess,
  recordFailure,
  getDashboard,
  killSwitchOn,
  dailySpendAlertThreshold,
  _testReset() {
    days.clear();
    months.clear();
  },
};
