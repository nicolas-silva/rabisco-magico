# Kids / Families store-compliance checklist — Rabisco Mágico

> **What this document is, and what it is not.**
> This is a **store-submission checklist** — a working list of what
> Apple and Google require of a kids' app listing, mapped against
> what Rabisco Mágico does today. It is **not legal advice** and it is
> **not a legal opinion**. Store policies change, and the stores
> decide each submission on its own merits; nothing here guarantees
> approval. **A lawyer must sign off on the privacy policy, the age
> approach, the consent flow, and both store listings before anything
> is submitted** (same open item as in `docs/privacy-policy-draft.md`
> and `docs/kids-compliance-checklist.md`). If this checklist and a
> lawyer — or a store reviewer — disagree, the lawyer / reviewer wins;
> update this file to match.
>
> Status: draft, 20 November 2026. Owner: Nicolas. This file is about
> **store policy** (Apple App Store Review Guidelines, Google Play
> Families policies). The **law** underneath it (COPPA, GDPR-K,
> Australian Privacy Act / OAIC Children's Online Privacy Code) is
> covered in `docs/kids-compliance-checklist.md` — read both before
> submission. There is no native build and no store account yet
> (`capacitor.config.draft.json`), so every "verify in the build" item
> below is still open by definition.

## Where we stand today (honest baseline)

- **Parents are the customers; children are the users.** Only parents
  create accounts (email + magic link). There are no child accounts.
- **No ads, no third-party trackers, no behavioural analytics on
  children, no profiling of children** — by design, in the web app
  today. There is no ad SDK and no analytics SDK in the build at all.
- **Parental gate** (maths question) guards signup, payment, settings
  and gallery deletion in the PWA.
- **Open gaps that block submission:** the output-image safety check
  is a stub (`lib/output-safety.js`); the privacy policy is a DRAFT;
  no lawyer sign-off; no native build to verify against; the finished
  app icon is still a placeholder (`public/icon.svg`); the magic-link
  email flow is a stub (no email sent). None of these is fixed by
  writing a listing.

## 1. Apple — Kids category (App Store Review Guidelines 1.3 + 5.1)

Applies if the app is listed in the Kids category. Apple rejects
rather than fines — a rejection costs a review cycle, so verify each
item in the actual native build, not from memory of the web app.

| # | Check | What it means for Rabisco Mágico | Status |
|---|---|---|---|
| 1.1 | **Age bands.** Pick the Kids age band(s) the app genuinely serves (5 and under, 6–8, 9–12) and design for the youngest in the band. | Audience is 4–10, so the honest declaration spans 5 and under + 6–8 + 9–12. Confirm with the lawyer at listing time; do not narrow the bands to dodge a requirement. | ☐ At listing time |
| 1.2 | **No third-party advertising — anywhere.** Kids apps may not contain third-party ads. | There are no ads at all, including no house ads for other products and no "watch an ad for a free transform". Verify no ad SDK is bundled in the native build (check the built bundle / Podfile / Gradle deps, not just the source). | ☑ By design; ☐ verify build |
| 1.3 | **No third-party analytics.** Kids apps may not contain third-party analytics that track children. | There is no analytics SDK in the app at all — no Firebase Analytics, no Mixpanel, nothing. Our own aggregate counts (transforms, failures) are server-side, on the parent account, and are not an SDK in the app. Keep it that way: do not add an analytics SDK to "measure the launch" without a kids-compliance review first. | ☑ By design; ☐ verify build |
| 1.4 | **No tracking, no IDFA.** Do not collect the advertising identifier or track children across apps/websites. | The app collects no device identifiers for advertising and shows no App Tracking Transparency prompt — because there is nothing to ask permission for. If a future SDK ever needs tracking, that is a redesign, not a prompt. | ☑ By design; ☐ verify build |
| 1.5 | **No links out of the app that a child can tap.** No external links, no social sharing buttons reachable by the child, no web views that lead out. | Sharing goes through the parent's own share sheet, behind the parental gate. Verify in the native build that *every* exit from the child flow — including the landing page links and any "rate us" / support link — sits behind the gate or does not exist for the child. | ☐ Verify in the app |
| 1.6 | **No in-app purchase prompts shown to children.** Prices and the paywall live in the parent panel only. | The Transform screen must never show prices, "buy more", or a locked feature teasing a purchase to the child. The quota message a child sees ("Your 5 free magic turns are used up! Ask a grown-up to continue.") must not name a price or a product. Verify the exact strings in the native build. | ☐ Verify in the app |
| 1.7 | **Parental gate for any non-child section.** Account, payment, settings, support links, gallery deletion. | The maths gate exists in the PWA — verify it is actually in front of *every* exit from the child flow in the native build, including the landing page and the install prompt, and that it cannot be bypassed by deep link or by going back. | ☐ Verify in the app |
| 1.8 | **No account creation by children.** Children must not be able to create an account, and the app must not ask a child for personal data. | Only parents create accounts (email + magic link); the app never asks the child for a name, photo, birthday or anything else. No age screen asks the child anything — see the neutral age-screen design in `docs/kids-compliance-checklist.md` §5. | ☑ By design |
| 1.9 | **Privacy policy link + privacy nutrition labels.** A privacy policy link in the listing and in the app (parent panel), plus Apple privacy labels that match the policy. | Policy is a DRAFT (`docs/privacy-policy-draft.md`). Labels must declare: parent email (account), drawing + generated image (user content), and *no* data used for tracking or third-party advertising. Labels and policy must agree word for word — fill the labels from the final policy, not from memory. | ☐ Policy is draft; labels at listing time |
| 1.10 | **Guideline 5.1 (Privacy) + COPPA.** Apple requires a privacy policy and forbids collecting children's data without parental consent, same as COPPA. | Consent flow: parent creates the account and consents *before* the child draws anything; drawings are stored only with that consent. Ask the lawyer to sign off on Apple + COPPA + GDPR-K in one pass, explicitly. | ☐ Lawyer to confirm |
| 1.11 | **Content: age-appropriate, no manipulative design.** No content that frightens, shames, or pressures a child; no dark patterns pushing purchases or engagement. | Friendly failure messages, no streaks, no "don't stop now", no ads, no loot-box-style mechanics. The generated image itself is the risk — the output-safety check must be live (not the stub) before submission. | ☐ Output safety is a stub — MUST before launch |
| 1.12 | **Screenshots must show the real app.** No splash-screen-only, logo-only or login-only screenshots. | See `docs/store-screenshots.md` §3 — the shot list is real screens only, and every generated image in a screenshot is adult-reviewed. | ☐ At capture time |

## 2. Google Play — Families (Designed for Families + Families policies)

Applies if the app is listed under the Families program — which an
app for ages 4–10 almost certainly should be. **Store policy, not
law** — Google can remove the app for breaching it, including after
approval, so the checks below are ongoing, not one-off.

| # | Check | What it means for Rabisco Mágico | Status |
|---|---|---|---|
| 2.1 | **Declare the target audience as children** in Play Console, with the correct age groups. | Audience 4–10 → declare the matching groups (ages 5 and under, 6–8, 9–12 as applicable). Answer the content-rating questionnaire (IARC) honestly; do not under-declare the youngest age to get an easier rating. | ☐ At listing time |
| 2.2 | **Families Ads Policy: no ads at all.** No ads in the app — including no house ads, no "watch an ad for a free transform", and no ad SDKs in the build. | Same as Apple §1.2, and just as strict. Verify no ad SDK is bundled before submission. | ☑ By design; ☐ verify build |
| 2.3 | **Certified ad SDKs only — not applicable, by design.** Google's Families policy allows *only* Google Play-certified ad SDKs *if* an app shows ads at all, and never personalised ads to children. | We show no ads, so no ad SDK is needed and none is included. This row is recorded so a future "let's monetise with ads" idea meets the rule on arrival: it would need a certified SDK, no personalised ads, and a full re-review — and it would contradict the "no ads" promise in the listing and the privacy policy. | ☑ N/A by design |
| 2.4 | **No personalised ads, no ad tracking.** No advertising ID collection, no profiling for ads. | No ads, no ad SDK, no advertising ID. Check the built bundle for any SDK that collects the ad ID (including an analytics SDK that does so quietly). | ☐ Verify build |
| 2.5 | **Analytics and SDKs: declare everything.** Play Console's Data safety section and the Families declaration must list every SDK in the app and what it collects. | Today: no third-party SDKs in the app at all (Capacitor core + the web shell only, once the native project exists). The server-side processors (fal.ai receives the drawing; Stripe receives the parent's payment data) must be named in the privacy policy and the Data safety section. Re-check the SDK list on every release — a new dependency can silently add one. | ☐ At listing time; re-check per release |
| 2.6 | **In-app purchases behind the parental gate, never marketed to children.** | Purchases live in the parent panel only; the child never sees a price, a product name, or a "buy more" prompt. The Family subscription and Magic Pack are parent-panel only (see `lib/stripe.js` — test mode today; live mode is a separate decision). | ☐ Verify in the app |
| 2.7 | **No user-generated content that exposes children to strangers.** No chat, no public gallery, no sharing to strangers, no comments. | There is no chat and no public gallery. Sharing is to the parent's own share sheet only. Gallery search is local to the family's own works. | ☑ By design |
| 2.8 | **Permissions: ask for nothing the app does not need.** No location, contacts, microphone, or similar. | The app needs no permissions at all (drawing is touch input; download/share use the system share sheet). Verify the native manifest requests none — Capacitor plugins can add permissions silently, so check after every plugin is added. | ☑ By design; ☐ verify build |
| 2.9 | **Data safety section must match the privacy policy.** Declare exactly what is collected (parent email, drawing, generated image) and that it is not shared for advertising. | Fill the Data safety section from the *final* lawyer-signed policy, not from this checklist. Any mismatch between the section, the policy and the app's actual behaviour is a removal risk. | ☐ At listing time |
| 2.10 | **Content rating + Families content rules.** Age-appropriate content, no violence, no scary content, no manipulative design, no content that pressures a child. | The generated image is the risk again: output-safety check must be live before submission (§1.11). The blocklist (`lib/blocklist.js`) is a starter list — a native speaker of each language reviews it before launch. | ☐ Output safety stub; ☐ blocklist review |
| 2.11 | **Teacher Approved (optional, valuable).** Google's Teacher Approved badge is awarded by teachers against quality, age-appropriateness and ad-free criteria; apps cannot apply for it directly in the usual way — eligibility is assessed by Google. | Do not claim "Teacher Approved" anywhere (listing, screenshots, website) until Google awards it. Worth pursuing once the beta is stable: it is the strongest trust signal in the Families program. Record the decision, not the claim. | ☐ After beta; never claim early |
| 2.12 | **Designed for Families badge.** The program badge follows from meeting the Families policies and the target-audience declaration — it is not a separate application. | Same discipline as §2.11: the listing copy (`docs/store-metadata.md`) does not present the badge as already held. | ☐ At listing time |

## 3. Cross-store — data practices both stores will check

| # | Check | Status |
|---|---|---|
| 3.1 | **What is collected, in one sentence both stores can use:** parent email (account + receipts); the child's drawing and generated image + title/phrase (the artwork, stored only with parental consent); language preference; aggregate transform/failure counts on the parent account. Nothing else. No child name, photo, birthday, location, contacts, or device identifiers for advertising. | ☑ By design; ☐ lawyer confirms wording |
| 3.2 | **Who the data is shared with:** fal.ai receives the drawing (image generation); Stripe receives the parent's payment data. No one else. No data sold, no data shared for advertising. Get fal.ai's and Stripe's data-processing terms on file, and confirm fal.ai does not train on submitted images. | ☐ Terms on file; ☐ fal.ai training confirmation |
| 3.3 | **Parental consent before any child data is stored:** parent creates the account and consents before the child draws; no drawing is stored without that consent. (Same flow as COPPA §1.1 in `docs/kids-compliance-checklist.md`.) | ☐ Lawyer to confirm magic-link counts as verifiable consent |
| 3.4 | **Parent rights from inside the app:** review, delete any work, delete the whole gallery, close the account — without emailing anyone. Gallery delete exists; in-app account closure is still a support request (see `docs/data-retention.md` §2). | ☐ Account closure in-app still to build |
| 3.5 | **Retention honoured in the stores' eyes:** anonymous works auto-purge at 90 days; audit logs 12 months; backups must not keep deleted drawings past 30 days (`docs/data-retention.md`, `docs/backup-restore.md`). The listing and policy must state the honest retention story, including the unconfirmed fal.ai retention. | ☐ fal.ai retention unconfirmed |
| 3.6 | **No dark patterns, no manipulative design, no pressure to buy or to keep playing.** No streaks, no countdowns, no "only today", no shaming a child for stopping, no paywall teasing locked features at the child. | ☑ By design; ☐ verify in the native build |
| 3.7 | **Incident plan before submission, not after an incident.** If an inappropriate image is ever shown to a child — who is told, how fast, what is deleted, what is logged. The kill switch (`KILL_SWITCH=1`) is the first step, not the whole plan. | ☐ Not written |
| 3.8 | **Re-verify on every release that touches data, payments, sharing, SDKs, or AI providers.** A new Capacitor plugin, a new SDK, or a new provider can silently break §1.2–1.4 / §2.2–2.5. The release checklist (`docs/release-checklist.md`) is the place this re-check lives. | ☐ Add store re-check to release process |

## 4. Submission order (so nothing is submitted half-ready)

1. Lawyer signs off the privacy policy, the consent flow, the age
   approach, and both listings (this file + `docs/store-metadata.md`).
2. Output-safety check wired to a real provider (`OUTPUT_SAFETY_CHECK=live`);
   the stub never ships to a store.
3. Native build exists; the "verify in the build" rows above are
   checked against the *built* bundle (no ad/analytics SDK, no
   unneeded permissions, gate in front of every exit, no prices
   visible to the child).
4. Finished 1024×1024 icon; screenshots captured per
   `docs/store-screenshots.md` with the kid-safe rules applied.
5. Apple first (Kids category, age bands, privacy labels), then
   Google Play (Families declaration, age groups, Data safety
   section). Do not submit to one store with copy the other has not
   seen — the two listings must agree with each other and with the
   privacy policy.
6. After approval, keep this file live: re-read it before every
   release that touches data, payments, sharing, SDKs, or AI
   providers, and whenever Apple or Google changes a Families/Kids
   policy.

## 5. Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Lawyer (privacy policy + consent + age + both listings) | | | Must cover AU + COPPA + GDPR-K if sold in US/EU; must explicitly cover Apple Kids + Google Play Families |
| Owner / product (this checklist) | Nicolas | | |
| Native-speaker review (blocklist + store copy, pt/en/es) | | | One reviewer per language |
| Store listings (Apple Kids + Google Play Families) | | | At submission time, after §4 steps 1–4 |
