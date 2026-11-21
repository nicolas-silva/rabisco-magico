/**
 * Rabisco Mágico — output-image safety check (STUB).
 *
 * Second vision pass on the GENERATED image, before it is shown to the
 * child. This is a STUB: no real provider is called, no API key is used,
 * and no image bytes leave the server. The stub exists so the real check
 * can drop in later without changing the transform flow — the wiring
 * (call site, fail-closed behaviour, audit event, tests) is real, the
 * judgement is not.
 *
 * Modes — env OUTPUT_SAFETY_CHECK (read on every call, no restart needed):
 *   "stub" (default) — the stub runs: it passes any non-empty image URL,
 *                      fails an empty/missing URL, and honours the
 *                      test-only override below. Clearly labelled stub.
 *   "off"            — the check is skipped entirely. Only for local
 *                      debugging; do not run production with "off".
 *   "live"           — the real provider check. NOT WIRED YET: until a
 *                      provider is implemented in checkWithProvider(),
 *                      "live" FAILS CLOSED (safe: false, reason
 *                      "provider_not_configured") so a misconfigured
 *                      deploy can never show an unchecked image.
 *
 * To wire the real check later, implement checkWithProvider() to call
 * your vision provider with the generated image URL (or bytes) and a
 * prompt such as "Is this image appropriate for a child aged 4–10?
 * Answer JSON { safe: true|false, reason: string }", return its verdict,
 * and keep the fail-closed rule: any provider error, timeout, or
 * unparseable answer must return safe: false, never safe: true.
 *
 * Test-only override (never set in production):
 *   OUTPUT_SAFETY_STUB_RESULT=fail  — the stub fails every check
 *   OUTPUT_SAFETY_STUB_RESULT=pass  — the stub passes every check
 * It is read from process.env on each call so tests can flip it.
 *
 * Return shape (all modes):
 *   { checked, safe, reason, mode, stub }
 *   checked — did a check actually run (false when mode is "off")
 *   safe    — may the image be shown (false blocks it: friendly failure,
 *             drawing kept, no quota charged, work NOT saved)
 *   reason  — short machine-readable enum, safe for the audit log
 *   mode    — the effective mode; stub — true unless mode is "live" and
 *             a real provider answered
 */
"use strict";

const VALID_MODES = ["stub", "off", "live"];

function currentMode() {
  const mode = String(process.env.OUTPUT_SAFETY_CHECK || "stub").toLowerCase().trim();
  return VALID_MODES.includes(mode) ? mode : "stub";
}

function safetyCheckEnabled() {
  return currentMode() !== "off";
}

/**
 * TODO: wire a real vision provider here (see header). Until then this
 * throws PROVIDER_NOT_CONFIGURED, which the caller treats as fail-closed.
 * It must never return safe: true on an error path.
 */
async function checkWithProvider(_imageUrl) {
  const err = new Error("no output-safety provider is wired yet (OUTPUT_SAFETY_CHECK=live)");
  err.code = "PROVIDER_NOT_CONFIGURED";
  throw err;
}

/**
 * Check a generated image before it is shown.
 * @param {string} imageUrl — the generated image URL (fal.ai URL).
 * @param {object} [opts] — { forceResult: "pass"|"fail" } test override.
 */
async function checkOutputImage(imageUrl, opts = {}) {
  const mode = currentMode();
  if (mode === "off") {
    return { checked: false, safe: true, reason: "disabled", mode, stub: false };
  }

  if (!imageUrl || typeof imageUrl !== "string" || !imageUrl.trim()) {
    return { checked: true, safe: false, reason: "missing_image", mode, stub: mode === "stub" };
  }

  if (mode === "live") {
    try {
      const verdict = await checkWithProvider(imageUrl);
      return {
        checked: true,
        safe: verdict.safe === true,
        reason: verdict.safe === true ? "provider_pass" : verdict.reason || "provider_flagged",
        mode,
        stub: false,
      };
    } catch (err) {
      return {
        checked: true,
        safe: false, // fail closed — an unchecked image is never shown
        reason: err && err.code === "PROVIDER_NOT_CONFIGURED" ? "provider_not_configured" : "provider_error",
        mode,
        stub: false,
      };
    }
  }

  // STUB mode: no provider call, no key, no image bytes sent anywhere.
  const override = opts.forceResult || String(process.env.OUTPUT_SAFETY_STUB_RESULT || "").toLowerCase().trim();
  if (override === "fail") {
    return { checked: true, safe: false, reason: "stub_forced_fail", mode, stub: true };
  }
  // "pass" override, or default: the stub passes any non-empty URL.
  return { checked: true, safe: true, reason: "stub_pass", mode, stub: true };
}

module.exports = {
  currentMode,
  safetyCheckEnabled,
  checkOutputImage,
  VALID_MODES,
};
