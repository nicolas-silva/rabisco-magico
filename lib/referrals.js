/**
 * Rabisco Mágico — referral / invite-code stub.
 *
 * STUB ONLY: no payment changes, no email is sent, no money moves.
 * A parent gets one invite code (e.g. "MAGICO-K7Q2X9"); another
 * parent redeems it once, and both sides get +1 bonus transform
 * (see accounts.grantBonusTransform). The bonus is a plain counter
 * on the account — it is spent through the same check/consume path
 * as a Magic Pack, so a bonus transform never touches Stripe.
 *
 * Rules (enforced here, in-memory — replace the Maps with a database
 * in production, same as lib/accounts.js):
 *   - one code per account (getOrCreateReferralCode is idempotent);
 *   - a code can be redeemed by many different parents, but each
 *     parent redeems at most once (one redemption per redeemer);
 *   - you cannot redeem your own code;
 *   - unknown codes are rejected; nothing is granted on a rejection.
 *
 * Codes are random (crypto) and carry no personal data — the code
 * itself never reveals who it belongs to. Redemption records store
 * account ids only, never emails.
 */
"use strict";

const crypto = require("crypto");
const accounts = require("./accounts");

const CODE_PREFIX = "MAGICO-";
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const BONUS_TRANSFORMS_PER_REDEMPTION = 1;

const codesByAccount = new Map(); // accountId -> code
const ownerByCode = new Map(); // code -> accountId (owner)
const redeemedBy = new Map(); // redeemerAccountId -> { code, redeemedAt }
const redemptions = []; // [{ code, ownerId, redeemerId, redeemedAt }]

function randomCode() {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return CODE_PREFIX + suffix;
}

function normaliseCode(code) {
  return String(code || "").trim().toUpperCase();
}

/** One code per account; calling again returns the same code. */
function getOrCreateReferralCode(accountId) {
  if (!accountId || !accounts.getAccount(accountId)) return null;
  const existing = codesByAccount.get(accountId);
  if (existing) return existing;
  let code = randomCode();
  while (ownerByCode.has(code)) code = randomCode(); // collision: redraw
  codesByAccount.set(accountId, code);
  ownerByCode.set(code, accountId);
  return code;
}

function getReferralCode(accountId) {
  return codesByAccount.get(accountId) || null;
}

function getReferralStats(accountId) {
  const code = codesByAccount.get(accountId) || null;
  const count = redemptions.filter((r) => r.ownerId === accountId).length;
  return { code, redemptions: count, bonusPerRedemption: BONUS_TRANSFORMS_PER_REDEMPTION };
}

/**
 * Redeem a code for the redeeming parent.
 * Returns { ok: true, bonusGranted, ownerId } on success, or
 * { ok: false, error } with error one of:
 *   invalid_code | own_code | already_redeemed | unknown_account
 * On success both the owner and the redeemer get +1 bonus transform.
 */
function redeemReferralCode(codeRaw, redeemerAccountId) {
  const code = normaliseCode(codeRaw);
  if (!redeemerAccountId || !accounts.getAccount(redeemerAccountId)) {
    return { ok: false, error: "unknown_account" };
  }
  const ownerId = ownerByCode.get(code);
  if (!ownerId) return { ok: false, error: "invalid_code" };
  if (ownerId === redeemerAccountId) return { ok: false, error: "own_code" };
  if (redeemedBy.has(redeemerAccountId)) return { ok: false, error: "already_redeemed" };

  accounts.grantBonusTransform(ownerId, BONUS_TRANSFORMS_PER_REDEMPTION);
  accounts.grantBonusTransform(redeemerAccountId, BONUS_TRANSFORMS_PER_REDEMPTION);
  const record = { code, ownerId, redeemerId: redeemerAccountId, redeemedAt: new Date().toISOString() };
  redeemedBy.set(redeemerAccountId, record);
  redemptions.push(record);
  return { ok: true, bonusGranted: BONUS_TRANSFORMS_PER_REDEMPTION, ownerId };
}

function listRedemptions() {
  return redemptions.map((r) => ({ ...r }));
}

module.exports = {
  getOrCreateReferralCode,
  getReferralCode,
  getReferralStats,
  redeemReferralCode,
  listRedemptions,
  BONUS_TRANSFORMS_PER_REDEMPTION,
  CODE_PREFIX,
  _testReset() {
    codesByAccount.clear();
    ownerByCode.clear();
    redeemedBy.clear();
    redemptions.length = 0;
  },
};
