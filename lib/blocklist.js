/**
 * Rabisco Mágico — title/phrase blocklist (server-side).
 *
 * Checked against the vision-generated title and phrase (never against
 * the child's drawing itself, and never against anything the child typed
 * — the child types nothing) BEFORE a work is saved or shown, and before
 * the image-generation call. On a hit the transform fails with the
 * friendly message, the drawing is kept, and NO quota is charged.
 *
 * Matching is deliberately conservative: text is lower-cased, accents
 * are stripped (so "pênis" and "penis" match the same entry), and
 * single-word terms match whole words only — "sex" must not fire on
 * "sexto", "ass" is not in the list at all (it hides inside "class",
 * "passar", "massa"). Multi-word phrases match as phrases.
 *
 * This is a STARTER list, not a safety guarantee. It covers the obvious
 * English / Portuguese / Spanish terms a vision model could plausibly
 * put in a title or phrase for a children's app. It is NOT a substitute
 * for the provider safety checker (fal.ai, `enable_safety_checker`) or
 * for the output-image check in lib/output-safety.js. A vision model
 * that writes around the list, or a drawing that is itself
 * inappropriate, is caught — if at all — by those other layers.
 *
 * How to extend it (the owner, not the child, does this):
 *   1. Preferred: add entries to DEFAULT_BLOCKLIST below, with
 *      { term, lang, category }. Terms are matched accent-insensitively.
 *   2. Without a code change: set BLOCKLIST_EXTRA_TERMS to a
 *      comma-separated list, e.g.
 *        BLOCKLIST_EXTRA_TERMS="palavra1,palavra2,frase má"
 *      Extra terms are loaded on every check, category "extra", lang "xx".
 *   3. At runtime (tests / admin tooling): addTerms([{ term, lang,
 *      category }]) / removeTerm(term) / listTerms().
 *   4. Hate-speech slurs are intentionally NOT in the starter list:
 *      they change fast, vary by region, and a wrong entry can block
 *      innocent words. The owner must add them deliberately, with a
 *      reviewer who speaks the language, and record the decision.
 *
 * Categories: "sexual" | "profanity" | "violence" | "substance" | "extra".
 * Nothing in this module logs, stores, or returns the offending text
 * beyond the matched term itself (for the audit log's `reason` field,
 * only the category is recorded — see lib/audit.js).
 */
"use strict";

const DEFAULT_BLOCKLIST = [
  // -- Sexual / explicit -----------------------------------------------
  { term: "sex", lang: "en", category: "sexual" },
  { term: "sexo", lang: "pt", category: "sexual" },
  { term: "sexo", lang: "es", category: "sexual" },
  { term: "porn", lang: "en", category: "sexual" },
  { term: "porno", lang: "pt", category: "sexual" },
  { term: "pornô", lang: "pt", category: "sexual" },
  { term: "porno", lang: "es", category: "sexual" },
  { term: "pornografia", lang: "pt", category: "sexual" },
  { term: "pornografía", lang: "es", category: "sexual" },
  { term: "nude", lang: "en", category: "sexual" },
  { term: "nudes", lang: "en", category: "sexual" },
  { term: "pelado", lang: "pt", category: "sexual" },
  { term: "pelada", lang: "pt", category: "sexual" },
  { term: "desnudo", lang: "es", category: "sexual" },
  { term: "desnuda", lang: "es", category: "sexual" },
  { term: "penis", lang: "en", category: "sexual" },
  { term: "pênis", lang: "pt", category: "sexual" },
  { term: "pene", lang: "es", category: "sexual" },
  { term: "vagina", lang: "pt", category: "sexual" },
  { term: "vagina", lang: "es", category: "sexual" },
  { term: "tesão", lang: "pt", category: "sexual" },
  // -- Profanity --------------------------------------------------------
  { term: "fuck", lang: "en", category: "profanity" },
  { term: "shit", lang: "en", category: "profanity" },
  { term: "merda", lang: "pt", category: "profanity" },
  { term: "mierda", lang: "es", category: "profanity" },
  { term: "caralho", lang: "pt", category: "profanity" },
  { term: "porra", lang: "pt", category: "profanity" },
  { term: "puta", lang: "pt", category: "profanity" },
  { term: "puta", lang: "es", category: "profanity" },
  { term: "coño", lang: "es", category: "profanity" },
  { term: "joder", lang: "es", category: "profanity" },
  { term: "cabrón", lang: "es", category: "profanity" },
  { term: "vadia", lang: "pt", category: "profanity" },
  { term: "bosta", lang: "pt", category: "profanity" },
  // -- Violence / weapons / self-harm -----------------------------------
  { term: "kill", lang: "en", category: "violence" },
  { term: "matar", lang: "pt", category: "violence" },
  { term: "matar", lang: "es", category: "violence" },
  { term: "blood", lang: "en", category: "violence" },
  { term: "sangue", lang: "pt", category: "violence" },
  { term: "sangre", lang: "es", category: "violence" },
  { term: "gun", lang: "en", category: "violence" },
  { term: "arma", lang: "pt", category: "violence" },
  { term: "arma", lang: "es", category: "violence" },
  { term: "pistola", lang: "pt", category: "violence" },
  { term: "pistola", lang: "es", category: "violence" },
  { term: "faca", lang: "pt", category: "violence" },
  { term: "cuchillo", lang: "es", category: "violence" },
  { term: "knife", lang: "en", category: "violence" },
  { term: "bomba", lang: "pt", category: "violence" },
  { term: "bomba", lang: "es", category: "violence" },
  { term: "bomb", lang: "en", category: "violence" },
  { term: "suicide", lang: "en", category: "violence" },
  { term: "suicídio", lang: "pt", category: "violence" },
  { term: "suicidio", lang: "es", category: "violence" },
  // -- Drugs / alcohol ---------------------------------------------------
  { term: "droga", lang: "pt", category: "substance" },
  { term: "drogas", lang: "pt", category: "substance" },
  { term: "droga", lang: "es", category: "substance" },
  { term: "drogas", lang: "es", category: "substance" },
  { term: "cocaína", lang: "pt", category: "substance" },
  { term: "cocaína", lang: "es", category: "substance" },
  { term: "maconha", lang: "pt", category: "substance" },
  { term: "marijuana", lang: "en", category: "substance" },
  { term: "marihuana", lang: "es", category: "substance" },
  { term: "crack", lang: "en", category: "substance" },
  { term: "heroína", lang: "pt", category: "substance" },
  { term: "heroína", lang: "es", category: "substance" },
  { term: "cerveja", lang: "pt", category: "substance" },
  { term: "cerveza", lang: "es", category: "substance" },
];

// Runtime additions (addTerms) live here; the default list is never mutated.
const extraTerms = [];

/** Lower-case, strip accents, collapse punctuation to spaces. */
function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function allTerms() {
  const seen = new Map(); // normalized term -> entry
  for (const entry of DEFAULT_BLOCKLIST.concat(extraTerms)) {
    const term = normalize(entry.term);
    if (term && !seen.has(term)) {
      seen.set(term, { term, lang: entry.lang || "xx", category: entry.category || "extra" });
    }
  }
  // Env extras, re-read on every call so no restart is needed to add one.
  const env = String(process.env.BLOCKLIST_EXTRA_TERMS || "");
  for (const raw of env.split(",")) {
    const term = normalize(raw);
    if (term && !seen.has(term)) {
      seen.set(term, { term, lang: "xx", category: "extra" });
    }
  }
  return [...seen.values()];
}

/**
 * Check one piece of text. Returns
 *   { blocked: boolean, matchedTerms: string[], categories: string[] }
 * `matchedTerms` holds the matched (normalised) terms — used by tests and
 * by server-side diagnostics, never shown to the child and never put in
 * the audit log (the audit log records only the category).
 */
function checkText(text) {
  const norm = normalize(text);
  if (!norm) return { blocked: false, matchedTerms: [], categories: [] };
  const padded = " " + norm + " ";
  const words = new Set(norm.split(" "));
  const matched = [];
  for (const entry of allTerms()) {
    const hit = entry.term.includes(" ")
      ? padded.includes(" " + entry.term + " ")
      : words.has(entry.term);
    if (hit) matched.push(entry);
  }
  return {
    blocked: matched.length > 0,
    matchedTerms: matched.map((m) => m.term),
    categories: [...new Set(matched.map((m) => m.category))],
  };
}

/**
 * Check the vision-generated title + phrase together — the exact call
 * the transform flow makes. Returns the same shape as checkText, plus
 * `checkedFields: ["titulo", "frase"]`.
 */
function checkTitleAndPhrase(titulo, frase) {
  const titleHit = checkText(titulo);
  const phraseHit = checkText(frase);
  const matchedTerms = [...new Set([...titleHit.matchedTerms, ...phraseHit.matchedTerms])];
  const categories = [...new Set([...titleHit.categories, ...phraseHit.categories])];
  return {
    blocked: titleHit.blocked || phraseHit.blocked,
    matchedTerms,
    categories,
    checkedFields: ["titulo", "frase"],
  };
}

/** Add terms at runtime (tests / admin tooling). Ignores blanks/dupes. */
function addTerms(terms) {
  let added = 0;
  for (const t of Array.isArray(terms) ? terms : []) {
    const term = normalize(t && t.term);
    if (!term) continue;
    if (extraTerms.some((e) => normalize(e.term) === term)) continue;
    extraTerms.push({ term: t.term, lang: (t && t.lang) || "xx", category: (t && t.category) || "extra" });
    added += 1;
  }
  return added;
}

function removeTerm(term) {
  const norm = normalize(term);
  const i = extraTerms.findIndex((e) => normalize(e.term) === norm);
  if (i === -1) return false;
  extraTerms.splice(i, 1);
  return true;
}

function listTerms() {
  return allTerms();
}

module.exports = {
  DEFAULT_BLOCKLIST,
  normalize,
  checkText,
  checkTitleAndPhrase,
  addTerms,
  removeTerm,
  listTerms,
  _testReset() {
    extraTerms.length = 0;
  },
};
