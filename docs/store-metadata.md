# App-store metadata — DRAFT — Rabisco Mágico

> **DRAFT — 20 November 2026. Nothing here has been submitted to any
> store.** This is copy for the App Store and Google Play listings,
> written from the product as it exists today (see `README.md` and
> `docs/privacy-policy-draft.md`). Before submission: a native speaker
> checks the Portuguese and English child-facing lines, the owner
> confirms the prices and the legal entity, the privacy-policy URL and
> support URL are filled in (§5), and a lawyer signs off the listing
> together with the privacy policy (see `docs/store-kids-compliance.md`).
> Character counts were verified against the limits in §1 — every
> limited field below carries its count as `N/limit characters`, and
> `test/store-prep.test.js` re-checks those counts.

## 1. Character limits used

| Field | Apple App Store | Google Play |
|---|---|---|
| App name / title | 30 characters | 50 characters |
| Subtitle / short description | 30 characters (subtitle) | 80 characters (short description) |
| Description | 4,000 characters | 4,000 characters |
| Keywords | 100 characters | — (Google has no keywords field; keywords live in the description) |
| Promotional text | 170 characters (Apple only, editable without a new version) | — |

Rules followed while writing: no superlatives ("best", "#1"), no
"free" without the honest qualifier (only the first 5 transforms are
free), no price in the child-facing copy, no claim we cannot prove
yet (no "Teacher Approved" — not applied for; no "ad-free" as a
slogan without the plain statement that there are no ads at all).

## 2. Apple App Store (Portuguese — primary listing)

- **Name:** "Rabisco Mágico" — 14/30 characters
- **Subtitle (PT):** "Desenhe e veja virar arte" — 25/30 characters
- **Keywords (PT):** "desenho,criança,magia,arte,rabisco,pintar,criativo,infantil,família,imaginação,colorir,desenhar" — 95/100 characters
- **Promotional text (PT):** "Seu desenho vira uma imagem de verdade! 5 magias grátis, sem anúncios e sem dados de crianças. Só diversão para desenhar." — 121/170 characters

### Full description (PT)

```text
Rabisco Mágico é um jogo de desenho para crianças de 4 a 10 anos.

A criança desenha com o dedo e toca em Transformar. A mágica
transforma o desenho numa imagem de verdade — um cenário realista que
respeita os objetos, as cores e o lugar de cada coisa que ela desenhou.
Cada obra ganha um título e uma frase carinhosa, e o desenho original
aparece em miniatura no cantinho da imagem.

Depois é só guardar: baixe a imagem, compartilhe com a família ou
guarde na galeria, com favoritos e busca pelo título.

Feito para os pais ficarem tranquilos:
• Sem anúncios — nenhum anúncio, nunca, nem de outros produtos.
• Sem dados de crianças — não pedimos nome, foto, idade nem
  aniversário. Só os pais criam conta, com e-mail.
• Área dos pais protegida — compras, plano e configurações ficam
  atrás de uma pergunta só para adultos.
• A criança nunca vê preços nem ofertas. O plano fica só na área
  dos pais.

Como funciona:
• As 5 primeiras magias são grátis, por conta.
• Família: A$7,99 por mês ou A$54,99 por ano — magias ilimitadas
  dentro do uso justo (até 300 por mês). A assinatura renova
  automaticamente e pode ser cancelada quando quiser.
• Pacote Mágico: A$4,99 por 30 magias, sem assinatura.

Em português, inglês e espanhol. Feito para o celular, em modo
retrato. Desenhe, transforme, guarde e compartilhe — sem estranhos,
sem anúncios e sem complicação.
```

## 3. Apple App Store (English)

- **Name:** "Rabisco Mágico" — 14/30 characters
- **Subtitle (EN):** "Draw it, watch it come alive" — 28/30 characters
- **Keywords (EN):** "drawing,kids,magic,art,doodle,coloring,creative,children,family,imagination,paint,sketch" — 88/100 characters
- **Promotional text (EN):** "Your drawing becomes a real picture! 5 free magic turns, no ads, no child data. Just drawing fun for ages 4–10." — 111/170 characters

### Full description (EN)

```text
Rabisco Mágico is a drawing game for children aged 4 to 10.

Your child draws with a finger and taps Transform. The magic turns
the drawing into a real picture — a realistic scene that keeps the
objects, colours and layout of what they drew. Every artwork gets a
title and a kind phrase, and the original drawing appears as a small
thumbnail in the corner of the image.

Then keep it: download the picture, share it with family, or save it
in the gallery, with favourites and search by title.

Made so parents can relax:
• No ads — no advertising at all, ever, not even for other products.
• No child data — we never ask for a name, photo, age or birthday.
  Only parents create an account, with an email address.
• Parent area behind a gate — purchases, the plan and settings sit
  behind a question only an adult can answer.
• Your child never sees prices or offers. The plan lives in the
  parent area only.

How it works:
• The first 5 magic turns are free, per account.
• Family: A$7.99 a month or A$54.99 a year — unlimited magic turns
  within fair use (up to 300 a month). The subscription renews
  automatically and can be cancelled anytime.
• Magic Pack: A$4.99 for 30 magic turns, no subscription.

In Portuguese, English and Spanish. Made for phones, in portrait.
Draw, transform, keep and share — no strangers, no ads, no fuss.
```

## 4. Google Play (uses the same descriptions as §2–§3)

Google Play has no subtitle, keywords or promotional-text field, so
the Apple copy above is reused where it fits and the short description
carries the pitch.

- **Title (PT):** "Rabisco Mágico" — 14/50 characters
- **Title (EN):** "Rabisco Mágico" — 14/50 characters
- **Short description (PT):** "O desenho vira uma imagem de verdade. 5 magias grátis, sem anúncios." — 68/80 characters
- **Short description (EN):** "Your child’s drawing becomes a real picture. 5 free magic turns, no ads." — 72/80 characters
- **Full description (PT):** same text as §2 (under 4,000 characters).
- **Full description (EN):** same text as §3 (under 4,000 characters).

Google Play notes: do not put "Best", "#1", "Top", "New", "Discount"
or "Sale" in the listing graphics or description, and do not use
"Download now" / "Install now" calls to action. The store listing
must declare the target audience as children (see
`docs/store-kids-compliance.md` §3) and the Data safety section must
match the privacy policy word for word.

## 5. Placeholders — fill in before submission, do not guess

| Item | Value today | Needed before submission |
|---|---|---|
| Privacy policy URL | `docs/privacy-policy-draft.md` is a DRAFT | Final policy, published on the web, lawyer-signed-off |
| Support URL / email | Not set | Support email + support page |
| Legal entity name | Not set | Registered entity that owns the developer accounts |
| App category (Apple) | Proposed: Kids, age bands 5 and under + 6–8 + 9–12 (audience is 4–10) | Confirm bands with the lawyer at listing time |
| App category (Google Play) | Proposed: Designed for Families | Confirm category + age groups in Play Console |
| Spanish (ES) listing | Not written | ES copy + native-speaker check (locales already exist in `locales/es.json`; the ES child-facing phrases still need a native-speaker check — see `locales/README.md`) |
| App icon | `public/icon.svg` is a placeholder | Finished 1024×1024 PNG icon (see `docs/store-screenshots.md` §4) |

## 6. What this copy deliberately does not say

- It does not call the app "Teacher Approved" or "Designed for
  Families" as a badge — those are store decisions, not marketing
  words, until the stores grant them.
- It does not promise the gallery, sharing or languages beyond what
  the app does today (gallery: last 8 works on device, favourites,
  title search; languages: PT/EN/ES).
- It does not mention fal.ai, Stripe, or any provider by name — those
  belong in the privacy policy, not in the pitch to parents.
- It does not say "free app" without the qualifier: only the first 5
  transforms are free; the Family plan and Magic Pack are paid, and
  the description says so.
