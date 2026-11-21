# Rabisco Mágico — Deployment guide

Step-by-step for the two recommended hosts. Both run the same code:
an Express server (`server.js`) that serves the PWA from `public/` and
exposes the API. No build step, no database yet — parent accounts,
quota, metrics and the gallery are in-memory / local-disk stubs (see
README). Do the "Before you deploy" checklist first.

## Before you deploy (both hosts)

1. **Stripe test mode first.** In the Stripe dashboard (TEST mode):
   - Create 3 products/prices: Family monthly A$7.99, Family yearly
     A$54.99, Magic Pack A$4.99 (one-off, 30 transforms).
   - Copy the price ids (`price_...`) and the test secret key
     (`sk_test_...`) into the env vars below.
   - Create a webhook endpoint pointing at
     `https://<your-domain>/api/stripe/webhook`, listening for
     `checkout.session.completed` and `customer.subscription.deleted`,
     and copy its signing secret (`whsec_...`).
   - **Live mode is NOT wired in this build.** Do not paste a live
     secret key. Enabling live payments needs a real Stripe account,
     a live webhook, and a review of the webhook + refund flow first.
2. **fal.ai key.** Copy `FAL_KEY` from fal.ai (needs credits on the
   account before any real transform works).
3. **Vision (optional).** `VISION_API_KEY` + `VISION_PROVIDER`, or
   leave unset — the server starts and uses the generic fallback prompt.
4. **Admin token.** Pick a long random `ADMIN_TOKEN` for the cost
   dashboard. If you skip it, the dashboard returns 503.
5. **Domain.** Point your domain at the host (see below). The app is
   mobile-only; HTTPS is required for the PWA install prompt and the
   service worker.
6. **Privacy + legal.** `docs/privacy-policy-draft.md` is a DRAFT and
   needs lawyer sign-off before launch; `docs/support-refund-draft.md`
   needs owner sign-off.

## Environment variables (both hosts)

| Variable | Required | Notes |
|---|---|---|
| `FAL_KEY` | Yes, for transforms | fal.ai key; account needs credits |
| `VISION_API_KEY` / `VISION_PROVIDER` | No | Vision step; fallback if unset |
| `BASE_URL` | Yes | e.g. `https://rabisco.app` — Stripe links + magic links |
| `STRIPE_SECRET_KEY` | For payments | **Test key only** (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | For payments | `whsec_...` from the test webhook |
| `STRIPE_PRICE_FAMILY_MONTHLY` | For payments | `price_...` Family A$7.99/mo |
| `STRIPE_PRICE_FAMILY_YEARLY` | For payments | `price_...` Family A$54.99/yr |
| `STRIPE_PRICE_MAGIC_PACK` | For payments | `price_...` Magic Pack A$4.99 |
| `ADMIN_TOKEN` | For dashboard | Long random string |
| `DAILY_SPEND_ALERT_USD` | No | Default `5` |
| `KILL_SWITCH` | No | `1` pauses all transforms |
| `STORAGE_BACKEND` | No | `local` (dev) / `s3` (production stub) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | For S3 | Only when `STORAGE_BACKEND=s3` |
| `PORT` | No | Default `3000`; hosts usually set it |

Never put a `.env` file in the repo or the deployment bundle — set
these in the host's dashboard. Never commit a real key.

## Option A — Vercel

Best for: fastest setup, free tier covers the beta.

1. Push the repo to GitHub (do **not** push `.env`).
2. Vercel → Add New → Project → import `nicolas-silva/rabisco-magico`.
3. Framework preset: **Other**. Build command: none. Output: none.
   Root directory: repo root. (The server is plain Node + Express.)
4. **Important:** Vercel's default is serverless functions, but this
   app is a long-running Express server. Two ways to run it:
   - **Simplest (recommended for the beta):** deploy the frontend as a
     static site and run the API elsewhere (see Option B for the API),
     pointing the frontend at the API host. That needs a small change:
     set the API base URL in `public/app.js` (currently relative).
   - **Or:** use Vercel's Node runtime with `vercel.json` mapping all
     routes to `server.js` (a single serverless function). Cold starts
     add ~1–2 s to the first transform of a session; acceptable for the
     beta, but the in-memory quota/metrics reset on every cold start,
     so treat them as approximate until a database lands.
5. Set the env vars above in Vercel → Settings → Environment Variables
   (Production).
6. Domains → add your domain, follow the DNS instructions (CNAME).
7. Deploy. Smoke test: open the site on a phone, draw, transform
   (needs `FAL_KEY` + credits), check `GET /api/health`.

## Option B — Render (recommended for the API)

Best for: a real always-on Node service, no cold starts, persistent
disk for the local gallery.

1. Render → New → Web Service → connect the GitHub repo.
2. Runtime: **Node**. Build command: `npm install`. Start command:
   `npm start`. Plan: **Starter** (~US$7/month) is enough for the beta.
3. Set the env vars above in Environment (use "Add from .env" only
   with a local file you then delete — never commit it).
4. Persistent disk (optional, for the local gallery): add a disk
   mounted at `/opt/render/project/src/data` (1 GB, ~US$0.25/GB/month).
   Without it, `data/gallery/` is wiped on every deploy/restart —
   acceptable for the beta, but gallery works are lost.
5. Custom domain: Settings → Custom Domain → add it, follow the DNS
   (CNAME to `<service>.onrender.com`). HTTPS is automatic.
6. Static frontend option: the same service already serves `public/`,
   so no separate static site is needed. If you prefer, use Render
   Static Site for `public/` + the Web Service for the API, and point
   the frontend at the API host.
7. Deploy. Smoke test as in Option A, plus: `GET /api/admin/dashboard`
   with `x-admin-token` (expect the mock-labelled figures).

## Cost notes (~US$25–50/month fixed, before AI spend)

| Item | Estimate |
|---|---|
| Render Starter web service | ~US$7/mo |
| Render persistent disk 1 GB | ~US$0.25/mo |
| Domain (.com/.app) | ~US$10–15/year |
| Vercel (if used for the frontend) | US$0 on Hobby for the beta |
| **Fixed total** | **~US$10–25/mo** (budget US$25–50/mo for headroom) |
| AI per transform | ~US$0.045 (fal.ai $0.03 + vision) |
| 20 beta families × ~10 transforms | ~US$9 one-off AI spend |

## After deploy — smoke test checklist

- [ ] `GET /api/health` returns `{"ok": true, ...}`
- [ ] Phone: draw → Transformar → realistic image returns
- [ ] Parental gate (🔒) asks a maths question; parent panel opens
- [ ] Parent signup → magic link (stub: link is logged server-side
      until email is wired — check the host logs)
- [ ] Stripe test checkout opens (test card `4242 4242 4242 4242`)
      and the webhook grants the plan (check the host logs)
- [ ] `GET /api/admin/dashboard` with the admin token shows figures
- [ ] Kill switch: set `KILL_SWITCH=1`, transform returns 503
      "disabled", then unset it
- [ ] Install prompt: "Add to Home Screen" works on the phone

## Rollback

Both hosts keep every deploy: Vercel → Deployments → ⋯ → Promote to
Production; Render → Deploys → Rollback. If transforms break, set
`KILL_SWITCH=1` first (pauses spend instantly), then roll back.
