# Collecting the 20 drawings for the benchmark

**Do not collect or use any child's drawing without the parent's
permission.** No drawing in this benchmark may be published, shared, or
used on the landing page without a separate, specific permission for
that image.

## What to ask for

20 drawings, made by children aged 4–10, exported as PNG 512×512 on a
white background (the same export the app produces). Aim for:

- Ages 4–5: 6 drawings
- Ages 6–8: 8 drawings
- Ages 9–10: 6 drawings
- Subjects: sun/sky, house, animal, person/family, vehicle, fantasy
  (dragon, castle) — and at least 3 very sparse drawings (few lines)

Record for each drawing: age band only (never a name or birthday),
subject, dominant colours, one-line description. Store drawings as
`benchmark/drawings/D01.png` … `D20.png` (folder not created yet —
it must never be committed to a public repo without permission; keep
it out of git with `.gitignore` if the drawings are real).

## Permission text (copy, adapt, and get a yes in writing)

> **PT:** Oi! Estamos a testar o Rabisco Mágico, um app que transforma
> o desenho das crianças numa imagem realista. Podemos usar o desenho
> do seu filho(a) para testar qual modelo de imagem funciona melhor?
> O desenho será usado só para esse teste, não será publicado e pode
> ser apagado a qualquer momento, é só pedir. Não precisamos do nome
> nem da idade exata da criança — só a faixa etária (4–5, 6–8 ou 9–10).
>
> **EN:** Hi! We're testing Rabisco Mágico, an app that turns children's
> drawings into realistic pictures. May we use your child's drawing to
> test which image model works best? The drawing will only be used for
> this test, won't be published, and can be deleted at any time — just
> ask. We don't need the child's name or exact age — just the age band
> (4–5, 6–8 or 9–10).

## Checklist

- [ ] 20 drawings collected (6 / 8 / 6 by age band)
- [ ] Permission received in writing for each one
- [ ] Age band, subject, colours and description recorded in
      `scoring-sheet.csv` (rows D01–D20)
- [ ] Drawings saved as `benchmark/drawings/D01.png` … `D20.png`
- [ ] No names, photos or birthdays stored anywhere
- [ ] Drawings folder excluded from git (add `benchmark/drawings/` to
      `.gitignore` before committing)
