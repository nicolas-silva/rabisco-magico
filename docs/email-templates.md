# Rabisco Mágico — Email templates (onboarding + winback)

Templates for parents, in pt-BR and English. **No email is sent
by the app in this build** — the magic-link sign-in is still a
stub (see `lib/accounts.js`), so these templates are copy to wire
into a real email provider later (e.g. Resend / Postmark /
Amazon SES). When wiring them up:

- Send only to the parent's email, never to a child. There are no
  child accounts and no child email addresses anywhere.
- One parent, one email at a time for the beta; no bulk sends
  until there is a real unsubscribe + consent record.
- Every email has a plain-text version (the body below) and an
  HTML version with the same words — do not add images of children
  or of any child's drawing.
- Variables are in `{{double braces}}`: `{{parent_name}}` (first
  name only, or "Olá" / "Hi" when unknown), `{{app_link}}`,
  `{{manage_link}}` (parent panel / unsubscribe), `{{code}}`
  (invite code), `{{days_inactive}}`.
- Keep the subject under 50 characters so it fits on a phone.
- Frequency cap: at most one marketing email per week per parent.
  Transactional emails (magic link, receipt, gallery-deletion
  confirmation) are separate and are not counted here.
- "From" name: Rabisco Mágico. Reply-to: the founder's email, so
  a parent's reply reaches a human.

Pricing referenced below (launch plan): 5 free transforms, then
Family A$7.99/month or A$54.99/year, or Magic Pack A$4.99 for 30.
Update the prices here if the launch plan changes.

---

## 1. Welcome after signup — pt-BR

**Assunto:** Bem-vindo(a) ao Rabisco Mágico! 🎨✨
**Pré-cabeçalho:** As 5 primeiras magias são grátis. É só desenhar e tocar em Transformar.

Olá, {{parent_name}}!

Obrigado por criar sua conta no **Rabisco Mágico** — o aplicativo
onde o desenho do seu filho(a) vira uma cena de verdade, como
mágica. ✨

**Para começar (2 minutos):**
1. Abra o aplicativo no celular: {{app_link}}
2. Deixe seu filho(a) desenhar com o dedo
3. Toque em **Transformar** e veja a mágica acontecer

As **5 primeiras transformações são grátis**, sem cartão e sem
compromisso. Depois, se quiser continuar, o Plano Família é
A$7,99/mês ou A$54,99/ano — ou o Pacote Mágico, A$4,99 por 30
transformações.

**Sua privacidade:** não pedimos nenhum dado da criança — nem
nome, nem foto, nem data de nascimento. Só o seu e-mail, para
gerenciar o plano e apagar a galeria quando quiser. Você pode
apagar tudo a qualquer momento na Área dos pais, dentro do app.

Dica: um sol no céu e um chão verdinho ajudam a mágica a entender
o desenho. Mas qualquer rabisco vale — o importante é se divertir!

Um abraço,
Nicolas — Rabisco Mágico

---
Não quer mais receber nossos e-mails? Cancele aqui: {{manage_link}}

## 1. Welcome after signup — English

**Subject:** Welcome to Rabisco Mágico! 🎨✨
**Preheader:** Your first 5 magic turns are free. Just draw and tap Transform.

Hi, {{parent_name}}!

Thank you for creating your account on **Rabisco Mágico** — the
app where your child's drawing turns into a real-looking scene,
like magic. ✨

**To get started (2 minutes):**
1. Open the app on your phone: {{app_link}}
2. Let your child draw with a finger
3. Tap **Transform** and watch the magic happen

Your **first 5 transformations are free** — no card, no
commitment. After that, if you'd like to keep going, the Family
plan is A$7.99/month or A$54.99/year — or the Magic Pack, A$4.99
for 30 transformations.

**Your privacy:** we ask for no data about your child — no name,
no photo, no birthday. Just your email, to manage the plan and
delete the gallery whenever you like. You can erase everything at
any time in the Parents' area, inside the app.

Tip: a sun in the sky and a green ground help the magic
understand the drawing. But any scribble counts — the point is
having fun!

Warm regards,
Nicolas — Rabisco Mágico

---
Don't want our emails any more? Unsubscribe here: {{manage_link}}

---

## 2. First-transform encouragement — pt-BR

**Quando enviar:** 1 dia depois do cadastro, se nenhuma
transformação foi feita ainda.
**Assunto:** A primeira magia está esperando 🎨
**Pré-cabeçalho:** Seu filho(a) já desenhou hoje?

Olá, {{parent_name}}!

Você criou sua conta no Rabisco Mágico, mas a primeira magia
ainda não aconteceu. Sem pressa — quando der, é só abrir o app
e deixar seu filho(a) desenhar. São 2 minutos e as 5 primeiras
são grátis.

**Uma ideia para hoje:** peça para ele(a) desenhar um sol, uma
casa e uma árvore. Depois toque em Transformar e veja o que
acontece. A reação das crianças nessa hora é a melhor parte. 😊

Abrir o aplicativo: {{app_link}}

Se tiver qualquer dúvida, é só responder este e-mail.

Um abraço,
Nicolas — Rabisco Mágico

---
Não quer mais receber nossos e-mails? Cancele aqui: {{manage_link}}

## 2. First-transform encouragement — English

**When to send:** 1 day after signup, if no transform has been
made yet.
**Subject:** The first magic is waiting 🎨
**Preheader:** Has your child drawn today?

Hi, {{parent_name}}!

You created your Rabisco Mágico account, but the first magic
hasn't happened yet. No rush — whenever you have a moment, just
open the app and let your child draw. It takes 2 minutes, and
the first 5 are free.

**An idea for today:** ask them to draw a sun, a house and a
tree. Then tap Transform and see what happens. Children's
reaction at that moment is the best part. 😊

Open the app: {{app_link}}

If you have any questions, just reply to this email.

Warm regards,
Nicolas — Rabisco Mágico

---
Don't want our emails any more? Unsubscribe here: {{manage_link}}

---

## 3. Winback after 14 days inactive — pt-BR

**Quando enviar:** 14 dias sem nenhuma transformação, para
contas que já transformaram pelo menos uma vez.
**Assunto:** Sentimos sua falta — tem desenho novo esperando? 🌈
**Pré-cabeçalho:** Uma ideia nova de desenho para esta semana.

Olá, {{parent_name}}!

Faz {{days_inactive}} dias que não vemos um desenho novo por
aqui — e sentimos falta da magia! Sem cobrança: a vida com
criança é corrida. Mas se der uma folguinha, que tal uma
sessão de desenho rapidinha?

**Ideia desta semana:** desenhe um foguete voando para a Lua
(tem mais ideias em cada mês do ano — é só abrir o app e
desenhar o que vier à cabeça).

Suas magias grátis restantes continuam valendo, e sua galeria
está guardada. Abrir o aplicativo: {{app_link}}

Se o app não funcionou bem para vocês, me conta respondendo
este e-mail — seu feedback ajuda muito mais do que você imagina.

Um abraço,
Nicolas — Rabisco Mágico

---
Não quer mais receber nossos e-mails? Cancele aqui: {{manage_link}}

## 3. Winback after 14 days inactive — English

**When to send:** 14 days with no transform, for accounts that
have transformed at least once.
**Subject:** We miss you — is there a new drawing waiting? 🌈
**Preheader:** A fresh drawing idea for this week.

Hi, {{parent_name}}!

It's been {{days_inactive}} days since we've seen a new drawing
around here — and we miss the magic! No pressure: life with
kids is busy. But if you get a spare moment, how about a quick
drawing session?

**This week's idea:** draw a rocket flying to the Moon (there
are more ideas for every month of the year — just open the app
and draw whatever comes to mind).

Your remaining free magic turns are still valid, and your
gallery is saved. Open the app: {{app_link}}

If the app didn't work well for you, tell me by replying to
this email — your feedback helps far more than you know.

Warm regards,
Nicolas — Rabisco Mágico

---
Don't want our emails any more? Unsubscribe here: {{manage_link}}

---

## 4. Upgrade nudge — pt-BR

**Quando enviar:** quando as 5 magias grátis acabarem (ou
quando restar 1), e nunca mais de uma vez por semana.
**Assunto:** Suas 5 magias grátis acabaram — quer continuar? ✨
**Pré-cabeçalho:** Família por A$7,99/mês ou Pacote Mágico por A$4,99.

Olá, {{parent_name}}!

Seu filho(a) já usou as 5 magias grátis — e a galeria deve estar
cheia de obras lindas. 🎨 Quer continuar transformando?

**Duas formas de continuar:**
- **Plano Família — A$7,99/mês ou A$54,99/ano:** magias à
  vontade para a família toda (limite justo de 300/mês)
- **Pacote Mágico — A$4,99:** 30 transformações, sem assinatura,
  usa quando quiser

Ver os planos: {{app_link}}

Sem pressão: a galeria continua guardada e você pode voltar
quando quiser. E se indicar o Rabisco Mágico para outra família,
vocês dois ganham uma magia extra — seu código de convite é
**{{code}}**.

Um abraço,
Nicolas — Rabisco Mágico

---
Não quer mais receber nossos e-mails? Cancele aqui: {{manage_link}}

## 4. Upgrade nudge — English

**When to send:** when the 5 free magic turns run out (or when
1 is left), and never more than once a week.
**Subject:** Your 5 free magic turns are used up — want to keep going? ✨
**Preheader:** Family at A$7.99/month or Magic Pack at A$4.99.

Hi, {{parent_name}}!

Your child has used up the 5 free magic turns — and the gallery
must be full of beautiful artworks. 🎨 Want to keep transforming?

**Two ways to continue:**
- **Family plan — A$7.99/month or A$54.99/year:** unlimited
  magic for the whole family (fair-use limit of 300/month)
- **Magic Pack — A$4.99:** 30 transformations, no subscription,
  use whenever you like

See the plans: {{app_link}}

No pressure: your gallery stays saved and you can come back
whenever you like. And if you recommend Rabisco Mágico to
another family, you both get an extra magic turn — your invite
code is **{{code}}**.

Warm regards,
Nicolas — Rabisco Mágico

---
Don't want our emails any more? Unsubscribe here: {{manage_link}}

---

## Sending checklist (before wiring any of these up)

- [ ] Email provider connected; sending domain verified (SPF/DKIM).
- [ ] Magic-link email exists (transactional, separate from these).
- [ ] Unsubscribe link works and is honoured within 48h.
- [ ] `{{parent_name}}` falls back to "Olá" / "Hi" when unknown —
      never "Dear customer" and never a child's name.
- [ ] Winback and upgrade emails stop the moment the parent
      transforms again or upgrades (check the flag at send time,
      not at schedule time).
- [ ] No child's drawing, title or phrase is ever included in an
      email — only counts ("your gallery", "5 free turns left").
- [ ] Spanish versions still to do — translate from the pt-BR
      original with a native speaker before sending to es
      families (see `locales/README.md`).
