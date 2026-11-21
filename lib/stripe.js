/**
 * Rabisco Mágico — Stripe integration (TEST MODE ONLY, code only).
 *
 * No Stripe SDK dependency: the Checkout Sessions API is called with
 * fetch + application/x-www-form-urlencoded, exactly as Stripe documents
 * it. STRIPE_API_BASE can be overridden (tests point it at a local mock
 * server) — it defaults to https://api.stripe.com.
 *
 * Keys come from process.env only:
 *   STRIPE_SECRET_KEY          — test secret key, sk_test_... (NEVER live
 *                                 in this build; live mode is not wired)
 *   STRIPE_PRICE_FAMILY_MONTHLY — Price id for Family A$7.99/month
 *   STRIPE_PRICE_FAMILY_YEARLY  — Price id for Family A$54.99/year
 *   STRIPE_PRICE_MAGIC_PACK     — Price id for Magic Pack A$4.99 / 30
 *   STRIPE_WEBHOOK_SECRET       — whsec_... test webhook signing secret
 *
 * Nothing here creates a Stripe account, spends money, or touches live
 * mode. The checkout routes return 503 until a test key AND the matching
 * price id are configured. Webhook events are verified with HMAC-SHA256
 * (Stripe signature scheme v1) before anything is granted.
 */
"use strict";

const crypto = require("crypto");

const STRIPE_API_BASE = process.env.STRIPE_API_BASE || "https://api.stripe.com";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

function stripeConfigured() {
  return Boolean(STRIPE_SECRET_KEY);
}

function priceIdFor(product, billing) {
  if (product === "family") {
    return billing === "yearly"
      ? process.env.STRIPE_PRICE_FAMILY_YEARLY || ""
      : process.env.STRIPE_PRICE_FAMILY_MONTHLY || "";
  }
  if (product === "pack") return process.env.STRIPE_PRICE_MAGIC_PACK || "";
  return "";
}

/**
 * Create a Stripe Checkout Session. mode: "subscription" (Family) or
 * "payment" (Magic Pack). Returns { id, url } — the browser redirects
 * the parent to `url`. Throws with code NOT_CONFIGURED / STRIPE_FAILED.
 */
async function createCheckoutSession({ product, billing, accountId, successUrl, cancelUrl }) {
  if (!STRIPE_SECRET_KEY) {
    const err = new Error("STRIPE_SECRET_KEY is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  const priceId = priceIdFor(product, billing);
  if (!priceId) {
    const err = new Error("Stripe price id is not configured for " + product);
    err.code = "PRICE_NOT_CONFIGURED";
    throw err;
  }
  const mode = product === "family" ? "subscription" : "payment";
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("line_items[0][price]", priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", successUrl);
  params.set("cancel_url", cancelUrl);
  // Metadata ties the payment back to the parent account in the webhook.
  params.set("metadata[accountId]", accountId);
  params.set("metadata[product]", product);
  if (mode === "subscription") {
    params.set("subscription_data[metadata][accountId]", accountId);
    params.set("subscription_data[metadata][product]", product);
  }

  const res = await fetch(STRIPE_API_BASE + "/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + STRIPE_SECRET_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error("Stripe request failed: " + res.status + " " + text.slice(0, 200));
    err.code = "STRIPE_FAILED";
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  if (!data || !data.url) {
    const err = new Error("Stripe returned no checkout URL");
    err.code = "STRIPE_FAILED";
    throw err;
  }
  return { id: data.id, url: data.url };
}

/**
 * Verify a Stripe webhook signature header (v1 scheme):
 *   t=<timestamp>,v1=<hmac-sha256 hex of "<t>.<payload>">
 * Uses timingSafeEqual. Returns true/false; never throws on bad input.
 */
function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  try {
    const header = String(signatureHeader || "");
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2)));
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1 || !secret) return false;
    const expected = crypto
      .createHmac("sha256", secret)
      .update(t + "." + rawBody.toString("utf8"))
      .digest("hex");
    const a = Buffer.from(v1, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (_e) {
    return false;
  }
}

/**
 * Parse + verify a webhook request. Returns the event object.
 * Throws code NOT_CONFIGURED (no webhook secret) or INVALID_SIGNATURE.
 */
function parseWebhookEvent(rawBody, signatureHeader) {
  if (!STRIPE_WEBHOOK_SECRET) {
    const err = new Error("STRIPE_WEBHOOK_SECRET is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }
  if (!verifyWebhookSignature(rawBody, signatureHeader, STRIPE_WEBHOOK_SECRET)) {
    const err = new Error("invalid webhook signature");
    err.code = "INVALID_SIGNATURE";
    throw err;
  }
  return JSON.parse(rawBody.toString("utf8"));
}

module.exports = {
  stripeConfigured,
  priceIdFor,
  createCheckoutSession,
  verifyWebhookSignature,
  parseWebhookEvent,
};
