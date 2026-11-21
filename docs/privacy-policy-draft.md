# Privacy Policy — DRAFT

> **DRAFT — needs lawyer sign-off before use.** This is a plain-language
> draft written for the Rabisco Mágico paid web beta. It is general
> information, not legal advice. Before the beta launches, a lawyer must
> check it against the laws where the app is sold (Australia — Privacy Act
> and the OAIC Children's Online Privacy Code, final code due 10 December
> 2026; the US — COPPA; the EU — GDPR-K if sold there), and the final
> version must be published on the landing page before anyone pays.

Last updated: 20 November 2026 (draft).

## 1. Who we are

Rabisco Mágico is a mobile web app for children aged about 4–10. A child
draws with a finger and receives a realistic AI transformation of the
drawing. The app is run by [LEGAL ENTITY NAME — to be filled in], based in
[LOCATION — to be filled in]. Contact: [SUPPORT EMAIL — to be filled in].

## 2. Parents are the customers; children are the users

- **Only parents (or legal guardians) create accounts.** There are no
  accounts for children.
- We never ask for a child's name, photo, birthday, school, address or
  any other personal information.
- Signup, consent, payment and settings sit behind a parental gate. The
  drawing screen itself is icon-led and word-light so a pre-reader can
  use it, but nothing on it collects personal data.

## 3. What we collect — and what we don't

We collect only what is strictly necessary to run the service:

| Data | Why | How long we keep it |
|---|---|---|
| Parent's email and account details | To run the account, send receipts, and let you sign in | Until you close the account |
| Payment details | Handled by Stripe, our payment provider — card numbers are never stored by us | Per Stripe's terms |
| The child's drawing (PNG) and the generated image | To show the result, keep the gallery, and let you download/share it | Until you delete it, or the account is closed |
| Title and phrase generated for the drawing | Part of the artwork | Same as the drawing |
| Language preference | To show the app and the title/phrase in your child's language | Until you change it or close the account |
| Counts of transforms, failures and retention (on the parent account, in aggregate) | To run the service, fix bugs, and know what it costs us | Aggregated; no child-level profiling |

We do **not** collect: a child's name, photo, birthday, location,
contacts, or device identifiers for advertising. We do not sell data.
We do not run ads.

## 4. Drawings: consent, storage and deletion

- A child's drawing is stored **only with the parent's consent**, given
  when the parent creates the account.
- Drawings and generated images are stored in cloud object storage; the
  child's device keeps only links to them.
- **Deletion actually deletes.** A parent can delete any work from the
  gallery, wipe the whole gallery, and close the account — from the app,
  without emailing anyone. Deleting removes the drawing and the generated
  image from our storage. Backups (if any) are overwritten within [30
  days — to be confirmed with the hosting provider].
- We will never publish a child's drawing or a before/after example
  without the parent's explicit permission for that specific image.

## 5. How the AI works, and safety filtering

- When a child taps Transformar, the drawing is sent to our backend
  (never directly from the phone to an AI provider — API keys never
  appear in the browser).
- A vision model reads the drawing and writes a title, a kind phrase,
  and a detailed image description. A second model (fal.ai FLUX.2 Pro
  Edit) generates the realistic scene, conditioned on the drawing so the
  layout, colours and elements are respected.
- **Safety filtering is on for every generation:** the provider's safety
  filters, a child-safe system prompt, a blocklist check on the title
  and phrase, and a second vision check on the output image before it
  is shown. If anything is in doubt, the child sees a friendly failure
  message, the drawing is kept, and no quota is charged.
- The generated title, phrase and image are checked for child
  appropriateness before display; no generated content is shown
  unfiltered.

## 6. No ads, no third-party tracking

- No advertising in the app, ever — including no ads aimed at children.
- No third-party trackers, no behavioural analytics on children, and no
  profiling of children.
- We measure our own product in aggregate on the parent account
  (transforms, failures, retention). We use no cross-site tracking.

## 7. Payments

Payments are processed by Stripe. Our prices are: 5 transforms free per
account; Family A$7.99/month or A$54.99/year (fair-use cap 300
transforms/month); Magic Pack A$4.99 for 30 transforms. Prices include
GST (to be confirmed with the accountant). Stripe charges are subject to
Stripe's own terms and privacy policy.

## 8. Your rights

As the parent you can, at any time: see what we hold for your account;
correct your account details; delete any drawing or the whole gallery;
export your gallery (download); close your account and have the data
deleted. To do any of this, use the settings in the app, or email
[SUPPORT EMAIL]. We aim to answer within [2 business days — to be
confirmed].

If you believe we have handled your or your child's information wrongly,
you can complain to us first, and then to your local privacy regulator
(in Australia: the Office of the Australian Information Commissioner).

## 9. Changes to this policy

If we change this policy, we will tell you in the app and by email
before the change takes effect, in plain language. We will not weaken
the protections for children's data without your consent.

## 10. Children's version (short, read it with your child)

> **For kids:** Rabisco Mágico is a drawing game. You draw, and the
> magic turns your drawing into a real picture. We don't ask for your
> name or your photo. Your drawings belong to your family — a grown-up
> can erase them whenever they want. There are no ads and no strangers
> here. If something on the screen feels weird or scary, show a
> grown-up. Have fun drawing!
>
> **Para crianças:** O Rabisco Mágico é um jogo de desenho. Você
> desenha, e a mágica transforma o seu desenho numa imagem de verdade.
> A gente não pergunta o seu nome nem a sua foto. Os seus desenhos são
> da sua família — um adulto pode apagar quando quiser. Não tem anúncio
> nem estranhos aqui. Se alguma coisa na tela parecer esquisita ou
> assustadora, mostre para um adulto. Divirta-se desenhando!

---

**Open items before this draft can be used (lawyer / owner):**
- [ ] Legal entity name, location, support email
- [ ] Confirm backup retention period (currently "[30 days]")
- [ ] Confirm support response time (currently "[2 business days]")
- [ ] Confirm GST wording with accountant
- [ ] Check against OAIC Children's Online Privacy Code (final, due 10 Dec 2026)
- [ ] COPPA / GDPR-K sections if selling into the US or EU
- [ ] Publish the final version on the landing page before the first paid signup
