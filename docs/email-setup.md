# Parent magic-link email — setup

## Access model — sign-in is the front door

The drawing page is only available after a parent creates an account
and signs in. There is no anonymous drawing: `POST /api/transform`
and `GET /api/quota` both return 401 without a parent session, and the
5 free transforms are enforced per parent account. When they run out,
the app shows a parent-facing upgrade gate pointing at the Family plan
(A$7.99/mo or A$54.99/yr) and the Magic Pack (A$4.99 for 30).

**Current blocker — read this before relying on sign-in:** until the
steps below are done, sign-in still relies on the paste-the-code
workaround (the parent copies a token instead of tapping an emailed
link) and on in-memory accounts (a magic link can land on a Vercel
instance that never saw the token). Gating the whole app on sign-in
makes those two gaps load-bearing: Resend (steps 1–3) and the KV store
(step 4) are now required before the app works reliably for real
parents, not just nice to have.

## 1. Create a Resend account

1. Go to https://resend.com and sign up (free tier: 100 emails/day,
   3,000/month at the time of writing — check the pricing page).
2. In the Resend dashboard, go to **API Keys → Create API Key**.
   Give it a name like `rabisco-magico`, leave the permission as
   "Sending access", copy the key (`re_...`). You only see it once.

## 2. Set the key in Vercel

In the Vercel dashboard, open the `rabisco-magico` project →
**Settings → Environment Variables**, and add (Production + Preview):

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | the `re_...` key from step 1 (mark it **Sensitive**) |
| `EMAIL_FROM` | see step 3 |
| `APP_BASE_URL` | `https://rabisco-magico.vercel.app` |

Then redeploy (any new push to `main` does it, or Deployments →
⋯ → Redeploy). Environment variables only apply to new deployments.

## 3. Sender address — test vs production

- **To test right away:** Resend gives every account a test sender
  (`onboarding@resend.dev`). Set `EMAIL_FROM` to that and the email
  will only deliver to the address you signed up to Resend with.
  That is enough to prove the flow works end to end.
- **For real parents:** verify a domain you own in Resend
  (**Domains → Add Domain**, then add the DNS records it shows at
  your domain registrar), and set `EMAIL_FROM` to an address on it,
  e.g. `Rabisco Mágico <noreply@rabisco-magico.app>`. Until the domain
  is verified, Resend will not send from it.

## 4. Make magic links reliable — connect a KV store

Email alone is not enough on Vercel: accounts and magic tokens
currently live in server memory, and a parent clicking the emailed
link can land on a serverless instance that never saw their token.

1. In Vercel: **Storage → Create → Upstash KV** (free tier), name it
   e.g. `rabisco-accounts`.
2. Connect it to the `rabisco-magico` project. Vercel adds
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars to the project.
3. Add these env vars (Production + Preview):

   | Variable | Value |
   | --- | --- |
   | `ACCOUNTS_BACKEND` | `kv` |
   | `ACCOUNTS_KV_REST_API_URL` | copy from `KV_REST_API_URL` |
   | `ACCOUNTS_KV_REST_API_TOKEN` | copy from `KV_REST_API_TOKEN` |

4. Redeploy. Until this is done, magic links work only when the
   click lands on the same instance that created the token — fine on
   a local server, unreliable on Vercel.

Local dev alternative: `ACCOUNTS_BACKEND=file` keeps accounts in
`data/accounts.json` (gitignored). It survives restarts on your own
machine but does not work on Vercel.

## How to test it

1. With no key set: sign up in the parents' area — the app says email
   isn't set up yet and `emailSent` is `false`. Nothing is sent.
2. With the key set: sign up with your own email, open the inbox,
   tap the link — the app opens signed in as the parent, and the
   `?token=...` disappears from the address bar.
3. Check `GET /api/parent/me` with the session: it returns the parent
   account and remaining free transforms.

## Notes

- Magic-link tokens last 15 minutes and work once; sessions last
  30 days. Tokens and emails are never logged.
- Resend's free tier is enough for a beta (a few hundred parents).
  If signups grow past it, Resend's paid plans start at $20/month
  for 50,000 emails — far above what a beta needs.

<!-- Production deploy note: EMAIL_FROM now onboarding@resend.dev (test sender) until a domain is verified. -->
