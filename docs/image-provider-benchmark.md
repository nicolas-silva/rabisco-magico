# Image-provider benchmark — summary

Researched 20 Nov 2026. For Rabisco Mágico: a child aged 4–10 draws a
simple sketch (512×512 PNG, white background); the backend must generate
a photorealistic 1024×1024 scene that respects the sketch's objects,
colours, positions and layout — sketch-conditioned / img2img generation,
not text-only.

## Recommendation

**Start with fal.ai, FLUX.2 Pro Edit** (`fal-ai/flux-2-pro/edit`).
Benchmark it against **OpenAI GPT-Image-2.5 Sunburst** on 20 real kids'
drawings before the beta. Keep **Replicate only as a reserve** — it sells
the identical FLUX.2 Pro model, so fal-vs-Replicate is a platform
comparison, not a model one. Do not build on gpt-image-1.5 (deprecated,
shuts down 1 Dec 2026).

## Comparison

| | fal.ai — FLUX.2 Pro Edit | OpenAI — GPT-Image-2.5 Sunburst | Replicate — FLUX.2 Pro |
|---|---|---|---|
| Price / 1024×1024 image | $0.03 | ~$0.021 medium / ~$0.061 high | $0.03 (same model) |
| Price / 1,000 images | $30 | ~$21 / ~$61 | $30 |
| Latency | ~6–9 s, async queue + webhooks | 27–41 s (Sunburst), sync by default | ~6–9 s warm; cold starts 30–120 s for community models |
| Sketch conditioning | Image input (`image_urls`); no true ControlNet/strength slider on the pro model | Text + image input, up to 14 refs | Same model as fal.ai; explicit edge conditioning only via FLUX.1 Dev + ControlNet (canny) |
| Quality (Artificial Analysis T2I v2.1) | FLUX 3 Elo 1117 (rank 13) | Sunburst Elo 1222 (#1) | Same as fal.ai |
| Safety | NCMEC+Thorn hash-matching, StopNCII, OpenAI Omni moderation, safety checker on by default | Strongest: prompt + output blocking, CSAM classifiers, minors safeguards, under-13 prohibited | Weakest default: safety checker can be disabled via API |
| Integration | No minimum, prepaid 365 days, server errors never billed | $5 minimum purchase to Build tier; base64 return, no hosted storage | No minimum, prepaid 1 year non-refundable, API outputs deleted after 1 hour (must save) |

Notes:

- **Budget $0.045 per fal.ai image until the first invoice.** fal's
  model page lists $0.03 for the first megapixel of output plus $0.015
  per extra megapixel of input/output; the exact price with a 512 px
  sketch input could not be confirmed.
- Prices move within days (FLUX 3 was $0.024 on Replicate on 5 Nov,
  $0.048 on 12 Nov 2026).
- No sketch-to-photo benchmark was found for any provider — the
  Artificial Analysis scores above are text-to-image / editing, not
  sketch conditioning. That is why the live 20-drawing test matters.
- Weaknesses: FLUX drifts / adds objects, no negative prompts; GPT
  over-interprets, and sparse sketches give all models little to anchor on.
- Vision step if separate: GPT-5 mini ~<$0.001–0.002 per sketch.

## Live-test protocol (20 real kids' drawings)

- Stratify by age 4–5 / 6–8 / 9–10; mix subjects, colours and layouts.
- Freeze one pt/en/es prompt template. Arms: (A) fal FLUX.2 Pro Edit,
  (B) OpenAI 2.5 Sunburst medium, (C) Sunburst high, (D) fal Klein Edit,
  (E, optional) Replicate FLUX.1 Dev + ControlNet canny, (F, optional)
  OpenAI 2.6 Flare medium. Same 20 drawings × same prompt, random order,
  1 retry only on technical failure, blinded 2-rater scoring.
- Measure: layout fidelity (missing/added/moved objects, 1–5), colour
  fidelity, photorealism (lines visible yes/no), delight/appropriateness,
  latency p50/p95 (client-measured), billed cost per kept image,
  failure/refusal rate by error type.
- Pre-registered decision rule: ship fal.ai if within 0.5 pts layout of
  Sunburst and photorealism ≥3.5; ship OpenAI only if >0.5 pts layout or
  >1.0 photorealism better at ≤5% failure; revisit architecture if
  ControlNet beats both by >0.5 layout. n=20 can only detect ~0.7 pt
  differences — a smaller gap is a tie, decided on cost/latency/safety.
