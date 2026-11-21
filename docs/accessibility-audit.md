# Accessibility audit — Rabisco Mágico PWA

Audit date: 20 November 2026. Scope: `public/index.html`,
`public/styles.css`, `public/app.js` (the child-facing drawing app).
Method: manual code review + WCAG 2.2 AA contrast ratios computed from
the exact hex values in `styles.css` (relative-luminance formula, not
eyeballing). No automated checker was run and no real users were
involved — this is a code audit, not a user test. `public/landing.html`
(parent-facing marketing page) was **not** audited; see §6.

Standard: WCAG 2.2 AA — normal text ≥ 4.5:1, large text (≥ 18.66 px
bold / ≥ 24 px) ≥ 3:1, non-text UI components ≥ 3:1, touch targets
≥ 24×24 px (AA) — this app targets the stricter 44×44 px from the
Apple/Google mobile guidance, since the users are 4–10 years old.

## 1. Contrast — findings and fixes

| Text / surface | Before | Ratio | Verdict | Fix applied |
|---|---|---|---|---|
| White body text (18 px) on bright sky `#2b9be0` | `#fff` on `#2b9be0` | 3.06:1 | **Fail** (needs 4.5:1) | App background is now `--sky-deep` `#1770a8` — white on it is **5.36:1**. Bright sky stays only as a decorative backdrop. |
| White on coral (Compartilhar / Apagar buttons) | `#fff` on `#ff6b5b` | 2.80:1 | **Fail** | Buttons now use `--coral-deep` `#c93a2c` — white on it is **5.09:1**. |
| Hint text on the white canvas | `#7a8a96` on `#fff` | 3.56:1 | **Fail** for normal text | Hint is now `#54616d` — **6.35:1**. |
| Error / parent-note text | `#ffe08a` on `#2b9be0` | 2.37:1 | **Fail** | Errors are now ink text on a pale-yellow banner (`#10324a` on `#ffe08a`, **10.32:1**), which also gives them a visible shape. Same treatment for `.parent-note`. |
| Sun-yellow first letter / gate question on sky | `#ffc93c` on `#2b9be0` | 1.99:1 | **Fail** as normal text | On `--sky-deep` sun is 3.49:1 — acceptable **only** because both uses are large bold text (26 px heading, 40 px question), which needs just 3:1. Sun yellow must never be used for normal-size text. |
| Ink on sun (Transformar / primary buttons) | `#10324a` on `#ffc93c` | 8.67:1 | Pass | No change. |
| Ink on white (canvas, buttons, fields) | `#10324a` on `#fff` | 13.32:1 | Pass | No change. |
| Desktop "Feito para celular" note | `#fff` on `#2b9be0` | 3.06:1 | **Fail** | Now ink text on a white pill (`#10324a` on `#fff`, 13.32:1). |

## 2. Touch targets (≥ 44 px)

| Control | Before | After |
|---|---|---|
| Colour swatches (`.swatch`) | 40×40 px — **fail** | **44×44 px** (active swatch 48 px, unchanged) |
| Icon buttons, language picker, brush buttons, gallery star | 44 px min — pass | No change |
| Transform / action buttons | 52 px min-height — pass | No change |
| Gate answer buttons | 84 px wide, 52 px tall via `.btn` — pass | No change |
| Gallery tiles | Whole tile is the target — pass | No change |

## 3. Screen-reader labels and semantics

Findings fixed in this batch:

- **Palette swatches** announced their hex code (`aria-label="#ff3b30"`).
  They now announce a human colour name (`"Cor Vermelho"`, …) and carry
  `aria-pressed` for the selected colour.
- **Brush buttons and eraser** had no pressed state. They now carry
  `aria-pressed`, kept in sync in `app.js`.
- **Canvas** had only `aria-label`. It now has `role="img"` plus
  `aria-describedby="hint"`, so the hint ("Desenhe com o dedo!…") is
  read as its description.
- **Loading screen** gave no announcement while the magic ran. It is
  now `role="status" aria-live="polite"`.
- **Error messages** (`#result-error`, `#gate-error`, `#parent-error`)
  were plain `<p>` elements. They are now `role="alert"`.
- **Gate answers** were an unlabelled `<div>`. They are now
  `role="group" aria-label="Respostas"`.
- **Gallery tiles** were clickable `<figure>` elements with no keyboard
  path. They are now `tabindex="0" role="button"` with an
  `aria-label` ("Ver \<title\>") and an Enter/Space key handler
  (`openResult()` in `app.js`, shared with the click handler).
- **Result images** had a static `alt`. `app.js` now sets the main
  image's `alt` to the work's title and the thumbnail's to
  "\<title\> — desenho original".
- **Transform button** now sets `aria-busy="true"` and `disabled`
  while a transform is in flight, and clears both in `finally`.
- **Skip link** added at the top of the page ("Ir para Transformar"),
  visible on keyboard focus, jumping to the Transform button.

## 4. Focus and motion

- **Focus visible: was missing entirely** — no `:focus-visible` rule
  existed, so keyboard and switch users had no visible focus.
  Added a global rule: 3 px ink outline + sun halo
  (`box-shadow: 0 0 0 6px var(--sun)`), which reads on both the white
  canvas and the deep-sky background.
- **Reduced motion: was partial** — only the wand animation was
  disabled under `prefers-reduced-motion`. The rule now also zeroes
  every animation/transition duration app-wide (the wand rule stays).

## 5. Known limits (not fixed — deliberate or follow-ups)

- **Drawing itself has no keyboard equivalent.** A canvas finger-drawing
  app cannot be made fully keyboard-operable without a different input
  mode (e.g. a stamp/shape placer). That is a real limitation for motor-
  impaired children; it is a product decision, not an oversight, and
  should be revisited if a keyboard/stamp mode is ever built.
- **Colour names are Portuguese-only** in the swatch labels, even when
  the UI language is English/Spanish. The palette is visual-first, so
  this is minor, but localising `COLOR_NAMES` is an easy follow-up.
- **Multiple `<h1>` elements** exist (one per hidden screen). Only one
  screen is visible at a time, so this is acceptable, but a heading
  audit should be redone if screens are ever shown together.
- **Emoji-only buttons** (↩️ 🗑️ 🖼️ 🔒 🧽) rely on `aria-label`, which
  is present on all of them. If an `aria-label` is ever dropped, the
  button becomes meaningless to a screen reader — keep the labels.
- **No automated a11y test** (axe / Lighthouse) is wired into
  `npm test` yet. Re-run this audit by hand after any visual change,
  and add an automated check before launch.

## 6. Out of scope

`public/landing.html` (parent-facing marketing page) was not audited
in this batch. It shares the palette, so the contrast fixes above
probably apply to it too — audit it separately before launch.
