# Kids-compliance checklist — Rabisco Mágico

> **What this document is, and what it is not.**
> This is a **product checklist** — a working list of things to verify,
> decide, and get signed off before launch. It is **not legal advice**
> and it is **not a legal opinion**. The summaries of COPPA, GDPR-K,
> Google Play Families, Apple Kids, and the Australian rules below are
> plain-language pointers to help the team ask a lawyer the right
> questions, not a substitute for that lawyer. **A lawyer must sign off
> on the privacy policy, the age screen, the consent flow, and the store
> listings before the paid beta launches** (same open item as in
> `docs/privacy-policy-draft.md`). If this checklist and a lawyer
> disagree, the lawyer wins — update this file to match.
>
> Status: draft, 20 November 2026. Owner: Nicolas. Review before launch
> and again whenever a store policy or a privacy law changes.

## Where we stand today (honest baseline)

- **Parents are the customers; children are the users.** Only parents
  create accounts (email + magic link). There are no child accounts.
- **We collect no child personal data by design:** no name, photo,
  birthday, school, address, location, contacts, or device identifiers
  for advertising. The only child-originated content is the drawing
  itself and the generated image/title/phrase.
- **No ads, no third-party trackers, no behavioural analytics on
  children, no profiling of children.**
- **Safety layers in the product:** fal.ai safety checker on, vision
  title/phrase blocklist (`lib/blocklist.js`), output-image safety
  check — currently a **stub** (`lib/output-safety.js`, must be wired
  to a real provider before launch), friendly failures that keep the
  drawing and charge no quota, parental gate (maths question) in front
  of signup / payment / settings / gallery deletion.
- **Gaps still open (do not launch with these unresolved):** the output
  safety check is a stub; the privacy policy is a draft; no lawyer
  sign-off yet; no age screen in the app yet (see §5); the store
  listings do not exist yet; backup retention and fal.ai's retention of
  generated images are unconfirmed (see `docs/data-retention.md`).

## 1. COPPA — USA (Children's Online Privacy Protection Act, FTC)

Applies if the app is offered to children under 13 in the US. Even
though we collect almost nothing, COPPA still applies to the service
as a whole because it is directed to children.

| # | Check | Status |
|---|---|---|
| 1.1 | **Verifiable parental consent** before collecting any personal information from a child. Our model: the parent creates the account and consents *before* the child draws anything; the drawing is stored only with that consent. Confirm with the lawyer that magic-link email sign-in counts as verifiable consent for our data (drawing + generated image), or whether a stronger step is needed. | ☐ Lawyer to confirm |
| 1.2 | **Privacy policy** that names what is collected from children, why, who it is shared with (fal.ai, Stripe), and the parent's rights — published and linked *before* the first signup. | ☐ Draft only (`docs/privacy-policy-draft.md`) |
| 1.3 | **Data minimisation:** collect only what the service needs. We do — but audit every field again at launch: is the drawing thumbnail needed, or could the gallery keep the generated image only? | ☐ Review at launch |
| 1.4 | **No conditioning participation on handing over more data** than needed. Free transforms never ask the child for anything. | ☑ By design |
| 1.5 | **Parent rights:** review, correct, and delete the child's information, and refuse further collection — all from the app, without emailing anyone. Gallery delete exists; account closure is still a support request (see `docs/data-retention.md` §2). | ☐ Account closure in-app still to build |
| 1.6 | **No behavioural advertising to children, no selling children's data.** | ☑ By design — no ads, no trackers |
| 1.7 | **Reasonable security** for the data we hold (server-side keys, no keys in the browser, hashed audit ids). | ☑ In code; ☐ review at launch |
| 1.8 | **Third parties:** fal.ai receives the drawing; Stripe receives the parent's payment data. COPPA requires us to be able to say what they do with it. Get fal.ai's and Stripe's data-processing terms on file, and confirm fal.ai does not train on submitted images. | ☐ Get terms on file |
| 1.9 | **Age 13 boundary:** COPPA covers under-13s. Our audience is 4–10, so the whole service is in scope — there is no "over-13" path to hide behind. | ☑ Acknowledged |

## 2. GDPR-K — EU/UK (GDPR, children's data)

Applies if the app is sold in the EU/UK. The age of digital consent
varies by member state (13–16); our audience (4–10) is below every
threshold, so **parental consent is required everywhere in the EU/UK**.

| # | Check | Status |
|---|---|---|
| 2.1 | **Lawful basis + parental consent:** consent from the holder of parental responsibility, obtained *before* processing the child's drawing. Same flow as COPPA §1.1 — one consent flow must satisfy both; the lawyer confirms the wording. | ☐ Lawyer to confirm |
| 2.2 | **Age-appropriate transparency:** privacy information a child (and parent) can understand. The privacy policy already has a "Children's version" (§10) — have it read by a teacher of 4–10-year-olds, not just a lawyer. | ☐ Test with a teacher |
| 2.3 | **Data Protection Impact Assessment (DPIA):** processing children's data with AI is high-risk processing. Do a DPIA before launch and keep it on file. | ☐ Not started |
| 2.4 | **Data minimisation & storage limitation:** same as COPPA §1.3; retention periods are in `docs/data-retention.md`. | ☑ Documented; ☐ lawyer confirms periods |
| 2.5 | **No profiling / automated decisions with legal effect on children.** We do not profile; the AI generates an image, it does not judge the child. State that explicitly in the policy. | ☐ Add explicit sentence |
| 2.6 | **International transfers:** drawings go to fal.ai (US infrastructure) and payments to Stripe. Record the transfer mechanism (e.g. Standard Contractual Clauses / adequacy) for each processor. | ☐ Get on file |
| 2.7 | **Parent/child rights:** access, correction, deletion, portability, objection — from the app where possible (see §1.5). | ☐ Same gap as §1.5 |
| 2.8 | **UK Age Appropriate Design Code (ICO):** if sold in the UK — default to the highest privacy settings, no dark patterns, no tracking by default, age-appropriate design. Our defaults already match; verify against the Code's 15 standards at launch. | ☐ Verify at launch |

## 3. Google Play Families (Designed for Families / teacher-approved)

Applies if the app is listed on Google Play under the Families program
(which a 4–10 app almost certainly should be). **This is a store
policy, not a law** — Google can remove the app for breaching it.

| # | Check | Status |
|---|---|---|
| 3.1 | **Declare the target audience as children** in Play Console, with the correct age groups (ages 5 and under, 6–8, 9–12 as applicable). The content rating questionnaire must be answered honestly. | ☐ At listing time |
| 3.2 | **Families Ads Policy:** no ads at all in the app — including no house ads for other products, no "watch an ad for a free transform", and no ad SDKs in the build. Verify no ad SDK is bundled before submission. | ☑ By design; ☐ verify build |
| 3.3 | **No personalised ads, no ad tracking.** (Covered by §3.2 — but check the analytics SDK too: any SDK that collects the advertising ID must go.) | ☐ Verify build |
| 3.4 | **In-app purchases:** purchases must sit behind the parental gate and must not be marketed to children. The Transform screen must never show prices or "buy more" to the child; the paywall lives in the parent panel only. | ☐ Verify in the app |
| 3.5 | **Content:** no user-generated content that can expose children to strangers — there is no chat, no sharing to strangers, no public gallery. Sharing is to the parent's own share sheet only. | ☑ By design |
| 3.6 | **Permissions:** do not request location, contacts, microphone, or any permission the app does not need. The app needs none of these. | ☑ By design |
| 3.7 | **Teacher Approved eligibility (optional, valuable):** content quality, no manipulative design, age-appropriate language. Worth applying for once the beta is stable. | ☐ After beta |
| 3.8 | **Data safety section:** declare exactly what is collected (parent email, drawing, generated image) and that it is not shared for advertising. Must match the privacy policy word for word. | ☐ At listing time |

## 4. Apple Kids category (App Store)

Applies if the app is listed in the Kids category on the App Store.
**Store policy, not law** — Apple rejects rather than fines.

| # | Check | Status |
|---|---|---|
| 4.1 | **Kids category age bands (5 and under, 6–8, 9–12):** pick the band(s) the app genuinely serves and design for the youngest in the band. | ☐ At listing time |
| 4.2 | **No third-party advertising or analytics in Kids apps.** No ad SDKs, no analytics that track children. (Same verification as §3.2 — check the built bundle, not just the source.) | ☐ Verify build |
| 4.3 | **No links out of the app that a child can tap** — no external links, no social sharing buttons reachable by the child. Sharing goes through the parent's share sheet, behind the parental gate. | ☐ Verify in the app |
| 4.4 | **No in-app purchase prompts shown to children.** Prices and the paywall live in the parent panel only; the child never sees a price. | ☐ Verify in the app |
| 4.5 | **Parental gate for any non-child section** (account, payment, settings, support links). The maths gate exists — verify it is actually in front of *every* exit from the child flow, including the landing page links. | ☐ Verify in the app |
| 4.6 | **Privacy policy link** in the App Store listing and in the app (parent panel), plus a privacy nutrition label that matches the policy. | ☐ At listing time |
| 4.7 | **Guideline 1.3 (Kids) + 5.1 (Privacy):** Apple requires a privacy policy and forbids collecting children's data without parental consent, same as COPPA. The lawyer's sign-off covers both stores at once if asked explicitly. | ☐ Ask lawyer explicitly |

## 5. Age screen — design note (neutral, no birthdate collected)

**The problem:** stores and regulators want to know the user is a child
(so the child protections apply) and that a parent consented — but
asking for a birthdate *creates* the very child personal data we are
trying not to collect, and a birthdate is exactly the field that
triggers the strictest storage and breach obligations.

**The design we use: don't ask the child's age at all.**

1. **The app is declared for ages 4–10 everywhere** (store listings,
   landing page, privacy policy). By opening it, the user is in a
   child-directed service — there is no adult mode to sort users into.
2. **The first thing that needs an adult is gated, not age-screened:**
   signup, payment, settings, and gallery deletion sit behind the
   parental gate (a maths question a small child cannot answer, e.g.
   "7 + 8 = ?"). The gate proves *an adult is present*, which is what
   consent actually needs — it never asks how old anyone is.
3. **If a store or a regulator ever requires an explicit age check**
   (it does not today for our model), use a **neutral age gate**: ask
   the *parent* (behind the parental gate, in the parent panel) to
   confirm a range, never a birthdate — e.g. "Is your child under 13?
   Yes / No" — and store only the *answer to the range question*
   ("parent confirmed child is under 13: yes"), never a date of birth,
   never an exact age. If the answer is "No", the app should not
   collect the child's data at all until the flow is redesigned — do
   not quietly treat the user as an adult.
4. **Never ask the child directly** ("How old are you?", "When is your
   birthday?"). Any age question is a parent-panel question, in adult
   language, behind the gate.
5. **Do not infer age from behaviour** (drawing style, vocabulary) and
   do not store an inferred age. Inference is personal data too, and
   it is unreliable.

**Why this is safe to say in the policy:** "We do not ask children for
their age or date of birth. Our service is designed for children aged
4–10, and a parent's consent is required before any drawing is stored."
— have the lawyer confirm that sentence.

## 6. Cross-cutting checks (all regimes)

| # | Check | Status |
|---|---|---|
| 6.1 | **Output safety check is a stub** (`lib/output-safety.js`). Wire a real provider (or accept fal.ai's safety checker as the second check and document that decision) **before launch**. The stub must never ship as the only check. | ☐ MUST before launch |
| 6.2 | **Blocklist is a starter list** (`lib/blocklist.js`). A native speaker of each language reviews it before launch; the owner records who reviewed it and when. | ☐ Review before launch |
| 6.3 | **Audit logs contain no child data** (`docs/audit-log-schema.md`). Re-verify after every change to `lib/audit.js` or its call sites. | ☑ By design; ☐ re-verify at launch |
| 6.4 | **Retention periods are documented and honoured** (`docs/data-retention.md`): anonymous works auto-purge at 90 days; audit logs deleted at 12 months; backups confirmed with the host. | ☑ Documented; ☐ backups unconfirmed |
| 6.5 | **fal.ai retention:** confirm how long fal.ai keeps generated images and whether a delete API exists; write the honest answer into the privacy policy. | ☐ Unconfirmed |
| 6.6 | **Incident plan:** if an inappropriate image is ever shown to a child — who is told, how fast, what is deleted, what is logged. Write the one-page plan before launch; the kill switch (`KILL_SWITCH=1`) is the first step, not the whole plan. | ☐ Not written |
| 6.7 | **Australia — OAIC Children's Online Privacy Code:** the final code is due 10 December 2026. Check the final code before launch; it may add requirements on top of the Privacy Act for apps directed at children. | ☐ Check after 10 Dec 2026 |
| 6.8 | **Re-review cadence:** this checklist is re-read before every release that touches data collection, age, payments, sharing, or AI providers — and at least once a year. | ☐ Calendar reminder |

## 7. Sign-off

| Role | Name | Date | Notes |
|---|---|---|---|
| Lawyer (privacy policy + consent + age screen) | | | Must cover AU + COPPA + GDPR-K if sold in US/EU |
| Owner / product (this checklist, blocklist review) | Nicolas | | |
| Native-speaker review (blocklist, pt/en/es) | | | One reviewer per language |
| Store listings (Google Play Families + Apple Kids) | | | At submission time |
