# Web-first launch plan — summary

Recommendation: launch a **paid web beta in 4–6 weeks**. Keep the exact
drawing experience, add a small backend, real image generation, parent
accounts and Stripe subscriptions. Charge from day one — even to a small
beta group — so you learn whether parents will pay before spending on
app stores.

## What success looks like at the end of the beta

- 100–300 families have used it, at least 30 of them paying.
- Cost per transform is measured, not guessed, and stays under A$0.10.
- No safety incidents; every generated image passes child-safety filtering.
- A clear yes/no on store launch, based on real retention — not enthusiasm.

## Four phases

1. **Weeks 1–2 — Harden.** Backend, two-step AI pipeline, parent
   accounts, quotas, safety filters, language files (pt-BR + EN), cloud
   gallery. Exit test: all 10 acceptance criteria from the briefing pass
   on a real phone, plus "no API key in the browser" and "quota blocks
   the 51st transform".
2. **Weeks 3–4 — Paid beta.** Stripe subscriptions live, landing page,
   invite 100–300 families from your own networks and local parent
   groups. Charge the real price; discount with a beta code if you like,
   but take a card. Exit test: at least 30 paying families and a measured
   cost per transform.
3. **Weeks 5–6 — Public web launch.** Open signup, share-card growth
   loop on, support and refund process written down, status and cost
   alerts on. Exit test: week-4 retention of paying families above
   roughly 40%, and support load you can actually handle.
4. **Later — App stores, only if the web proves it.** Wrap the same web
   app with Capacitor rather than rebuilding natively. Budget Apple
   Developer US$99/year and Google Play US$25 one-off, plus review time
   and the stricter Kids Category / Families rules.

## Pricing

| Offer | Price | What it includes |
|---|---|---|
| Free | $0 | 5 transforms in total per account, full quality, download + share included |
| Family — monthly | A$7.99/mo | Unlimited* transforms, cloud gallery, all languages (*fair-use cap 300/mo) |
| Family — yearly | A$54.99/yr | Same as monthly, about 43% cheaper |
| Magic Pack | A$4.99 | 30 transforms, no subscription |

No ads. No selling data. No in-app tricks aimed at children.
Stripe Australia: 1.65% + A$0.30 per domestic card payment, no monthly fee.

## Costs

- All-in per transform: about **US$0.04 (~A$0.06)** — vision ~$0.002–0.006,
  image generation $0.025 (dev-class) to $0.04 (pro-class), safety check
  and storage ~$0.003.
- Fixed costs: roughly **US$25–50/month** (hosting + database + domain).
- Modelled unit economics (assumptions: A$0.06/transform, A$60/mo fixed,
  paying family averages 40 transforms/mo): 30 paying families ≈ A$70/mo
  left over; 300 ≈ A$1,310/mo; 2,000 ≈ A$9,600/mo. Modelled estimates,
  not forecasts.

## Trust and safety (non-negotiable before charging anyone)

- Parent accounts only. No names, photos, birthdays or accounts for children.
- Parental consent and a plain-language privacy policy, plus a
  child-friendly version. Build to Australia's draft Children's Online
  Privacy Code (final due 10 Dec 2026); US/EU add COPPA and GDPR-K duties.
- No ads, no third-party tracking, no behavioural analytics on children.
- Deletion that actually deletes: a parent can wipe the gallery and
  drawings and close the account without emailing anyone.
- Safety filtering on every generation, with friendly failure messages
  for the child and a clear log for you.

## Risks

- **AI bill blowout:** quotas, fair-use cap, one job at a time, daily
  spend alert, no auto-retry loops, kill-switch in the backend.
- **Unsafe or off-brief image:** two-stage pipeline with output check;
  on any doubt, friendly failure, drawing kept, no quota charged.
- **Parents love it free, will not pay:** that is what the paid beta is
  for. If 300 families will not produce 30 payers, pivot the offer
  (packs, school licence) before building more features.
- **Churn after the first wow:** gallery, seasonal prompts, easy
  "draw another" flow. Watch week-4 retention, not downloads.
- **Store rejection later:** web first means revenue does not depend on it.
