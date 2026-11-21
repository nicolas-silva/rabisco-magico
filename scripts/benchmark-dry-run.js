/**
 * Rabisco Mágico — benchmark dry run (MOCKED, no real API calls).
 *
 * Validates the benchmark harness end-to-end against the synthetic
 * drawings and the real scoring sheet:
 *   1. Reads benchmark/scoring-sheet.csv — expects exactly 80 rows
 *      (20 drawings x 4 arms A-D) with the required columns.
 *   2. Fills subject / colours / description from
 *      benchmark/drawings-synthetic/metadata.csv.
 *   3. "Generates" every row against LOCAL mock fal.ai / OpenAI servers
 *      (real HTTP to localhost, fake image URLs, fixed latencies) — so
 *      the request/response plumbing is exercised with zero spend.
 *   4. Assigns deterministic MOCK scores (hash of drawing+arm, 3-5) and
 *      billed costs per arm, then writes:
 *        benchmark/dry-run-results.csv  (scoring-sheet format, filled)
 *        benchmark/dry-run-report.md    (per-arm means, latency p50/p95,
 *                                        mock cost, decision-rule check)
 *   5. Validates the outputs (scores in 1-5, appropriate yes/no,
 *      latencies > 0) and exits non-zero on any failure.
 *
 * The scores are PLACEHOLDERS. Nothing here decides which provider to
 * ship — the real benchmark still needs the 20 real drawings and human
 * blinded scoring (see benchmark/README.md).
 *
 * Run:  npm run benchmark:dry-run   (run `npm run drawings` first)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const http = require("node:http");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const SHEET = path.join(ROOT, "benchmark", "scoring-sheet.csv");
const META = path.join(ROOT, "benchmark", "drawings-synthetic", "metadata.csv");
const OUT_CSV = path.join(ROOT, "benchmark", "dry-run-results.csv");
const OUT_MD = path.join(ROOT, "benchmark", "dry-run-report.md");

const REQUIRED_COLUMNS = [
  "drawing_id", "age_band", "subject", "dominant_colours", "description",
  "arm", "provider_model", "quality",
  "layout_fidelity_1_5", "colour_fidelity_1_5", "photorealism_1_5",
  "delight_1_5", "appropriate_yes_no", "latency_seconds",
  "billed_cost_usd", "failure_or_refusal", "error_type", "notes",
];

// Mock per-arm behaviour: latency (ms) and billed cost (USD/image).
const ARMS = {
  A: { provider: "fal-ai/flux-2-pro/edit", cost: 0.03, latencyMs: 7000 },
  B: { provider: "openai/gpt-image-2.5-sunburst", cost: 0.021, latencyMs: 27000 },
  C: { provider: "openai/gpt-image-2.5-sunburst", cost: 0.061, latencyMs: 41000 },
  D: { provider: "fal-ai/flux-2-pro/edit-fast", cost: 0.015, latencyMs: 4000 },
};

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",");
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    // Simple parser: fields are either plain or double-quoted.
    const fields = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(cur); cur = ""; }
      else cur += ch;
    }
    fields.push(cur);
    const row = {};
    header.forEach((h, i) => (row[h] = fields[i] !== undefined ? fields[i] : ""));
    rows.push(row);
  }
  return { header, rows };
}

function toCsvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Deterministic mock score 3-5 from a hash (NOT a real judgement).
function mockScore(seed, key) {
  const h = crypto.createHash("sha256").update(seed + ":" + key).digest();
  return 3 + (h[0] % 3); // 3, 4 or 5
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

async function main() {
  const failures = [];
  const fail = (m) => failures.push(m);

  // 1. Scoring sheet -------------------------------------------------------
  if (!fs.existsSync(SHEET)) fail("scoring-sheet.csv is missing");
  const sheet = parseCsv(fs.readFileSync(SHEET, "utf8"));
  for (const col of REQUIRED_COLUMNS) {
    if (!sheet.header.includes(col)) fail("scoring sheet missing column: " + col);
  }
  if (sheet.rows.length !== 80) fail("expected 80 rows (20 drawings x 4 arms), got " + sheet.rows.length);
  const drawings = [...new Set(sheet.rows.map((r) => r.drawing_id))];
  if (drawings.length !== 20) fail("expected 20 drawings, got " + drawings.length);
  for (const d of drawings) {
    const arms = sheet.rows.filter((r) => r.drawing_id === d).map((r) => r.arm).sort().join("");
    if (arms !== "ABCD") fail(d + " does not have arms A-D (has " + arms + ")");
  }

  // 2. Synthetic metadata ---------------------------------------------------
  if (!fs.existsSync(META)) fail("synthetic metadata.csv missing — run `npm run drawings` first");
  const meta = {};
  if (fs.existsSync(META)) {
    for (const row of parseCsv(fs.readFileSync(META, "utf8")).rows) meta[row.drawing_id] = row;
  }
  for (const d of drawings) {
    if (!meta[d]) fail("no synthetic metadata for " + d);
    const png = path.join(ROOT, "benchmark", "drawings-synthetic", d + ".png");
    if (!fs.existsSync(png)) fail("synthetic PNG missing: " + d + ".png");
  }
  if (failures.length) throw new Error("validation failed:\n- " + failures.join("\n- "));

  // 3. Mock providers (local HTTP, zero spend) ------------------------------
  const mock = http.createServer((req, res) => {
    const isFal = req.url.startsWith("/fal");
    const arm = isFal ? "fal" : "openai";
    const latency = arm === "fal" ? 120 : 250; // ms, simulated locally
    setTimeout(() => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ images: [{ url: "https://mock.invalid/" + arm + ".png" }] }));
    }, latency);
  });
  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const mockPort = mock.address().port;

  // 4. Run every row ---------------------------------------------------------
  const results = [];
  for (const row of sheet.rows) {
    const arm = ARMS[row.arm];
    const m = meta[row.drawing_id];
    const t0 = Date.now();
    const res = await fetch(`http://127.0.0.1:${mockPort}/${row.arm === "B" || row.arm === "C" ? "openai" : "fal"}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drawing: row.drawing_id, arm: row.arm }),
    });
    const data = await res.json();
    const localLatency = (Date.now() - t0) / 1000;
    // Reported latency = the arm's planning-figure latency (mock), plus
    // the real local round-trip, so the sheet carries realistic numbers.
    const latency = Number(((arm.latencyMs / 1000) + localLatency).toFixed(2));
    const seed = row.drawing_id + row.arm;
    results.push({
      ...row,
      subject: m.subject,
      dominant_colours: m.dominant_colours,
      description: m.description,
      layout_fidelity_1_5: mockScore(seed, "layout"),
      colour_fidelity_1_5: mockScore(seed, "colour"),
      photorealism_1_5: mockScore(seed, "photo"),
      delight_1_5: mockScore(seed, "delight"),
      appropriate_yes_no: "yes",
      latency_seconds: latency,
      billed_cost_usd: arm.cost.toFixed(3),
      failure_or_refusal: "no",
      error_type: "",
      notes: "DRY RUN — mock " + data.images[0].url + ", not a real generation",
    });
  }
  await new Promise((resolve) => mock.close(resolve));

  // 5. Validate outputs -------------------------------------------------------
  for (const r of results) {
    for (const k of ["layout_fidelity_1_5", "colour_fidelity_1_5", "photorealism_1_5", "delight_1_5"]) {
      if (!(r[k] >= 1 && r[k] <= 5)) fail(r.drawing_id + r.arm + " score out of range: " + k);
    }
    if (!["yes", "no"].includes(r.appropriate_yes_no)) fail(r.drawing_id + r.arm + " bad appropriate flag");
    if (!(r.latency_seconds > 0)) fail(r.drawing_id + r.arm + " bad latency");
  }

  // 6. Write outputs -----------------------------------------------------------
  const header = REQUIRED_COLUMNS;
  const csv = [header.join(",")]
    .concat(results.map((r) => header.map((h) => toCsvCell(r[h] !== undefined ? r[h] : "")).join(",")))
    .join("\n") + "\n";
  fs.writeFileSync(OUT_CSV, csv);

  const byArm = {};
  for (const arm of Object.keys(ARMS)) {
    const rows = results.filter((r) => r.arm === arm);
    const mean = (k) => rows.reduce((s, r) => s + Number(r[k]), 0) / rows.length;
    const lats = rows.map((r) => r.latency_seconds).sort((a, b) => a - b);
    byArm[arm] = {
      n: rows.length,
      layout: mean("layout_fidelity_1_5"),
      colour: mean("colour_fidelity_1_5"),
      photo: mean("photorealism_1_5"),
      delight: mean("delight_1_5"),
      p50: percentile(lats, 50),
      p95: percentile(lats, 95),
      cost: rows.reduce((s, r) => s + Number(r.billed_cost_usd), 0),
      failures: rows.filter((r) => r.failure_or_refusal === "yes").length,
    };
  }
  const totalCost = Object.values(byArm).reduce((s, a) => s + a.cost, 0);
  const fmt = (n) => Number(n).toFixed(2);
  const ruleLines = [];
  const gapLayout = byArm.A.layout - Math.max(byArm.B.layout, byArm.C.layout);
  if (Math.abs(gapLayout) <= 0.5 && byArm.A.photo >= 3.5) {
    ruleLines.push("- **Ship fal.ai (Arm A)** under the pre-registered rule: within 0.5 of Sunburst on layout (gap " + fmt(gapLayout) + ") and photorealism >= 3.5 (" + fmt(byArm.A.photo) + ").");
  } else if (Math.max(byArm.B.layout, byArm.C.layout) - byArm.A.layout > 0.5) {
    ruleLines.push("- **Ship OpenAI (Arm B/C)** under the pre-registered rule: beats fal.ai by > 0.5 on layout.");
  } else {
    ruleLines.push("- No arm wins under the pre-registered rule on these MOCK scores — decide on cost/latency/safety.");
  }
  const md = [
    "# Rabisco Mágico — Benchmark dry-run report (MOCK)",
    "",
    "**Generated:** " + new Date().toISOString(),
    "**Drawings:** 20 synthetic PNGs from `benchmark/drawings-synthetic/` (no real kids' drawings).",
    "**Generations:** 80 rows (20 drawings x 4 arms) against LOCAL mock fal.ai / OpenAI servers.",
    "**Scores are placeholders** (deterministic hash, 3-5) — this run only validates that the",
    "scoring sheet, the mock plumbing and the report math work end-to-end. It does NOT decide",
    "which provider to ship. The real benchmark needs real drawings + blinded human scoring.",
    "",
    "## Per-arm means (mock scores, 1-5)",
    "",
    "| Arm | Model | n | Layout | Colour | Photo | Delight | p50 latency (s) | p95 latency (s) | Mock cost (USD) | Failures |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...Object.entries(byArm).map(([arm, a]) =>
      `| ${arm} | ${ARMS[arm].provider} | ${a.n} | ${fmt(a.layout)} | ${fmt(a.colour)} | ${fmt(a.photo)} | ${fmt(a.delight)} | ${fmt(a.p50)} | ${fmt(a.p95)} | $${fmt(a.cost)} | ${a.failures} |`),
    "",
    "**Total mock cost:** $" + fmt(totalCost) + " for 80 generations.",
    "",
    "## Pre-registered decision rule — evaluated on MOCK scores only",
    "",
    ...ruleLines,
    "",
    "## Validation",
    "",
    "- 80 rows, 20 drawings x arms A-D: OK",
    "- All scores in 1-5, appropriate = yes/no, latencies > 0: OK",
    "- Results: `benchmark/dry-run-results.csv` (scoring-sheet format, filled)",
    "",
  ].join("\n");
  fs.writeFileSync(OUT_MD, md);

  if (failures.length) throw new Error("validation failed:\n- " + failures.join("\n- "));
  console.log("Dry run OK: 80 mock generations, 0 failures.");
  for (const [arm, a] of Object.entries(byArm)) {
    console.log(`  Arm ${arm}: layout ${fmt(a.layout)}, photo ${fmt(a.photo)}, p50 ${fmt(a.p50)}s, cost $${fmt(a.cost)}`);
  }
  console.log("  Total mock cost: $" + fmt(totalCost));
  console.log("Wrote " + OUT_CSV);
  console.log("Wrote " + OUT_MD);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
