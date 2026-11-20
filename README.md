# Rabisco Mágico

A mobile-only web app for children aged about 4–10. A child draws with a
finger, taps **Transformar**, and gets back a realistic AI scene that
interprets the drawing — with the original drawing shown as a small tilted
thumbnail in the corner. Then they can download or share the result.

## How it works: Draw → Transform → Share

1. **Draw** — The child draws with a finger on a white canvas. 12 colours,
   3 brush sizes, an eraser, undo, and clear-all (double-tap to confirm).
   The drawing is stored as stroke data, so undo and resizing never lose work.
2. **Transform** — The phone sends the drawing (512×512 PNG) to the backend.
   The backend runs two AI steps, server-side only:
   - **Step 1 — Interpret (vision):** returns a short title (max 5 words),
     a caring phrase for the child (max 18 words), and a detailed English
     image prompt listing every element, its colour and its position.
   - **Step 2 — Generate (image):** fal.ai FLUX.2 Pro Edit
     (`fal-ai/flux-2-pro/edit`) receives the prompt **and** the drawing as
     conditioning, so the realistic scene keeps the child's objects, colours
     and layout.
3. **Share** — The result screen shows the title, phrase, generated image
   and the original drawing thumbnail. **Baixar** downloads a 1024×1024
   image with the original thumbnail inset; **Compartilhar** shares a
   1080×1350 card. **Desenhar outro** clears the board;
   **Continuar** goes back to the drawing without clearing it.
   The gallery keeps the last 8 works on the device.

## Tech stack

- Front-end: plain HTML/CSS/JS, no framework, installable PWA
  (`public/manifest.json`). Fredoka font, sky `#2b9be0`, sun `#ffc93c`,
  coral `#ff6b5b`, ink `#10324a`.
- Back-end: Node 20+, Express (`server.js`). One endpoint,
  `POST /api/transform`, plus static hosting of `public/`.
- Image generation: fal.ai FLUX.2 Pro Edit.
- Vision interpretation: provider-agnostic — see `server.js`
  (`interpretDrawing`). If no vision key is set, the server still starts
  and uses a clearly-marked generic fallback prompt.

## Run locally

```bash
cp .env.example .env   # then fill in FAL_KEY (never commit .env)
npm install
npm run dev            # or: npm start
```

Open http://localhost:3000 on your phone (or a narrow browser window).
The app is designed for portrait, 360–480 px wide; on desktop (≥700 px)
it appears centred in a phone frame.

## Deploy

Any small Node host works (Vercel, Render, Fly.io, a VPS). Set the
environment variables on the host — do **not** copy `.env` into the repo
or the deployment bundle:

- `FAL_KEY` — fal.ai API key (required for real transforms)
- `VISION_API_KEY` — optional, for the vision step (see `server.js`)
- `PORT` — optional, defaults to 3000

## Pricing / cost notes

- Image generation: fal.ai FLUX.2 Pro Edit, about **US$0.03 per image**
  (1024×1024). Budget **US$0.045 per image until the first invoice** —
  the exact price with a 512 px sketch input was not confirmed.
- All-in cost per transform (vision + image + storage): about
  **US$0.04 (~A$0.06)**. Fixed hosting costs: roughly **US$25–50/month**.
- Product pricing (launch plan): Free = 5 transforms in total per
  account; Family = **A$7.99/month** or **A$54.99/year** (fair-use cap
  300/month); Magic Pack = **A$4.99 for 30 transforms**.
- The server enforces a 5-free-transform quota stub per account and
  one transform in flight at a time. It never auto-retries in a loop.

## Safety

- API keys live **server-side only**, in `.env` / host environment
  variables. The browser never sees `FAL_KEY`.
- fal.ai safety checker is on (`enable_safety_checker: true`,
  `safety_tolerance: "2"`).
- No child names, photos, birthdays or accounts are collected. Original
  drawings are stored only with parent consent and are deletable.
- Any generation failure shows a friendly message, keeps the drawing,
  and does not charge quota.

## Docs

- `docs/launch-plan.md` — web-first launch plan summary
- `docs/image-provider-benchmark.md` — image-provider benchmark summary
