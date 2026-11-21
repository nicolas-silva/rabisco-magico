# Rabisco Mágico — 20-Drawing Live Benchmark

**Purpose:** decide, on real kids' drawings, whether to ship fal.ai
FLUX.2 Pro Edit or OpenAI GPT-Image-2.5 Sunburst for the beta — and
whether a sketch-conditioned (ControlNet) arm beats both.

**Status:** harness ready. No drawings collected yet, no generations run.
Do not run this benchmark until the 20 drawings are collected with
parental permission (see `drawing-collection-template.md`).

## The arms

| Arm | Provider / model | Quality setting |
|---|---|---|
| A | fal.ai — FLUX.2 Pro Edit (`fal-ai/flux-2-pro/edit`) | default (1024×1024) |
| B | OpenAI — GPT-Image-2.5 Sunburst (`gpt-image-2.5-sunburst`) | medium |
| C | OpenAI — GPT-Image-2.5 Sunburst | high |
| D | fal.ai — FLUX.2 Pro Edit, fast draft (FLUX Klein class) | default |
| E *(optional)* | Replicate — FLUX.1 Dev + ControlNet (canny, strength ~0.7) | 10 drawings only |
| F *(optional)* | OpenAI — GPT-Image-2.6 Flare | medium |

Arms A–D are the core comparison. E and F are optional extras; run them
only if time and budget allow.

## The drawings (20)

Stratify by age, and mix subjects, colours and layouts — messy real
drawings, not perfect ones:

- Ages 4–5: 6 drawings
- Ages 6–8: 8 drawings
- Ages 9–10: 6 drawings

Include: sun/sky scenes, houses, animals, people/family, vehicles,
fantasy (dragons, castles), and at least 3 very sparse drawings (few
lines) — sparse sketches are where models drift most. Record each
drawing's age band, subject, dominant colours and a one-line description
in `scoring-sheet.csv` before generating anything.

## Method (freeze before running)

1. **Freeze one prompt template** (PT/EN/ES as in production: vision step
   returns title + phrase + detailed English image prompt; the image
   prompt is identical for every arm for the same drawing).
2. **Same 20 drawings × same prompt in every arm.** Same order,
   randomised per drawing.
3. **One retry only**, and only on a technical failure (timeout, 5xx).
   A bad-looking image is a result, not a retry.
4. **Blinded scoring:** two raters score without knowing which arm
   produced the image. Score each image on the scales below.
5. **Record everything** in `scoring-sheet.csv`: latency (client-measured,
   p50/p95 per arm), billed cost per kept image, failure/refusal rate by
   error type.

## Scoring scales (1–5, 5 = best)

- **Layout fidelity:** are all the child's elements present, in the
  right places, with nothing important added or moved?
- **Colour fidelity:** do the colours match the drawing?
- **Photorealism:** does it look like a real photo/scene, with no
  cartoon outlines or visible sketch lines left in?
- **Delight / appropriateness:** would a child love it, and is it
  child-appropriate? (Yes/No for appropriateness; 1–5 for delight.)

## Pre-registered decision rule

Decide **before** looking at the scores, and do not move the goalposts:

- **Ship fal.ai (Arm A)** if it is within **0.5 points** of Sunburst
  (Arm B/C) on layout fidelity **and** photorealism is **≥ 3.5**.
- **Ship OpenAI (Arm B or C)** only if it beats fal.ai by **> 0.5
  points** on layout fidelity **or > 1.0 points** on photorealism,
  at a failure rate of **≤ 5%**.
- **Revisit the architecture** if the ControlNet arm (E) beats both by
  **> 0.5 points** on layout fidelity — that means explicit edge
  conditioning matters more than the model choice.
- **n = 20 can only detect differences of ~0.7 points.** A smaller gap
  is a tie — decide it on cost, latency and safety, not on the score.

## Costs (planning figures, Nov 2026 — confirm on the first invoice)

- fal.ai FLUX.2 Pro Edit: $0.03/image (budget $0.045 until confirmed)
- OpenAI Sunburst medium: ~$0.021/image; high: ~$0.061/image
- Vision step: ~$0.002–0.006/image (separate, same for all arms)

A full run (20 drawings × 4 core arms) is about 80 generations:
roughly $2.40–$4.90 for fal.ai arms, $1.70–$4.90 for OpenAI arms.
Budget ~$10–$15 for the whole benchmark including retries.

## Files

- `scoring-sheet.csv` — one row per drawing × arm, with all scores,
  latency, cost and failure columns.
- `drawing-collection-template.md` — permission form and collection
  checklist for the 20 drawings.

## Synthetic drawings + dry run (no real drawings, no real API calls)

Before the real benchmark, the harness itself can be validated with
program-generated kid-style scribbles:

```bash
npm run drawings          # 20 synthetic PNGs -> benchmark/drawings-synthetic/
npm run benchmark:dry-run # 80 mock generations -> dry-run-results.csv + dry-run-report.md
```

- `scripts/generate-synthetic-drawings.js` — pure Node, no dependencies,
  seeded RNG (deterministic). 20 scenes matching the stratification
  (4–5: 6, 6–8: 8, 9–10: 6), including 2 very sparse drawings (D19, D20).
  Writes `benchmark/drawings-synthetic/D01.png` … `D20.png` plus
  `metadata.csv` (subject, colours, description). Gitignored.
- `scripts/benchmark-dry-run.js` — reads the real `scoring-sheet.csv`,
  fills the drawing metadata, "generates" all 80 rows against **local
  mock** fal.ai / OpenAI servers (real HTTP to localhost, fake image
  URLs, zero spend), assigns deterministic placeholder scores, and
  writes `dry-run-results.csv` + `dry-run-report.md` with per-arm
  means, latency p50/p95, mock cost and the decision-rule check.
  It exits non-zero if the sheet is malformed.

**Note:** the dry run caught a real bug in the sheet (rows had 16 fields
against an 18-column header, so `arm` landed in the wrong column). The
sheet was rewritten with exactly 18 fields per row on 20 Nov 2026 —
re-run the dry run if you ever edit the sheet by hand.

The mock scores are placeholders (a hash, 3–5). Nothing in the dry run
decides which provider to ship — the real benchmark still needs the 20
real drawings and blinded human scoring.
