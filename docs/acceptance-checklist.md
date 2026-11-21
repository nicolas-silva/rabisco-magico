# Acceptance Checklist — Rabisco Mágico

Test on a **real phone** (not a desktop browser), in portrait, on the
production build. Tick each item only after seeing it pass with your
own eyes. Anything that fails goes back to the backlog as a P0.

## The briefing's 10 acceptance criteria

### 1. Drawing doesn't scroll or zoom; the stroke follows the finger without perceptible lag
**How to test:** Draw fast circles and long lines with one finger.
The page must not scroll, the browser must not zoom, and the line must
appear under your fingertip with no visible delay. Try it with a second
finger touching the screen mid-stroke — the second finger must be ignored.
**Pass:** no scroll, no zoom, no lag you can feel.

### 2. Colour, brush and eraser switching mid-drawing works; undo removes one stroke at a time, down to empty
**How to test:** Draw a red line, switch to blue mid-drawing, switch to
the thick brush, then the eraser, and erase part of it. Tap Undo
repeatedly — each tap must remove exactly one stroke, until the board is
empty and the hint ("Desenhe com o dedo!") comes back.
**Pass:** colours/sizes/eraser change immediately; undo is one stroke
per tap, to empty.

### 3. Rotating / resizing doesn't erase or distort the drawing
**How to test:** Draw a house, rotate the phone to landscape and back
to portrait, then resize the browser window on desktop. The drawing must
still be there, in the same proportions.
**Pass:** nothing lost, nothing stretched.

### 4. Transform on an empty board shows the warning and does not call the AI
**How to test:** With an empty board, tap Transformar. Then check the
server/fal.ai usage for that minute.
**Pass:** friendly warning ("Desenhe alguma coisa primeiro!"), no AI
call, no quota consumed, no charge.

### 5. The generated image keeps the elements, colours and general positions
**How to test:** Draw a yellow circle top-left, a house in the middle,
green scribbles at the bottom. Transform it. Repeat with 3 different
drawings.
**Pass:** sun top-left, house centre, grass at the bottom — in every
result. Nothing important missing, added or moved.

### 6. The result screen shows title, phrase, image and the original thumbnail
**How to test:** After a transform, look at the result screen.
**Pass:** a short title (≤ 5 words), a kind phrase (≤ 18 words) in the
child's language, the generated image, and the original drawing as a
small tilted thumbnail in the bottom-right corner.

### 7. Downloaded and shared files contain the original drawing visibly
**How to test:** Tap Baixar and open the file (should be 1024×1024,
named after the title). Tap Compartilhar and open the share card
(1080×1350, blue background, title on top, phrase below, "Feito com
Rabisco Mágico" footer).
**Pass:** the original drawing thumbnail is visible in both files.

### 8. Works appear in the gallery after closing and reopening on the same device
**How to test:** Transform 2–3 drawings, close the app completely
(swipe it away), reopen it, open the gallery.
**Pass:** all works are there, most recent first, max 8, each with its
title; tapping one opens its result screen.

### 9. Failures show a friendly message and let the child retry without losing the drawing
**How to test:** Turn on airplane mode and tap Transformar. Also test
with the fal.ai key removed on a staging build.
**Pass:** a friendly, non-scary message ("Ops, a mágica falhou. Tente
de novo!"), the drawing is still on the board, and tapping Transformar
again retries. No technical error text on screen, no quota consumed.

### 10. No API key exposed in browser code
**How to test:** In the phone browser, open the page source / devtools
and search the downloaded JavaScript and HTML for `FAL_KEY`, `sk-`,
and any long random token. Also check the network tab: the phone must
only call our own backend (`/api/transform`), never `fal.run`
directly.
**Pass:** no key anywhere in client code or network traffic. (See also
check 11.)

## Extra checks (from the launch plan)

### 11. No API key in the browser — server-side only (explicit re-check)
**How to test:** Same as 10, plus: grep the built client bundle in the
repo (`public/`) for `FAL_KEY` and for the real key value. Check
`.env` is in `.gitignore` and is not in the git repo.
**Pass:** the key exists only in the server environment, never in the
browser, never in git, never in a URL, never in a log.

### 12. Quota blocks the 51st transform
**How to test:** On a test account with the free tier (5 free) the
equivalent check is the 6th transform; on a Family account the cap is
300/month, so the full 51st-transform check applies to the free-tier
path only if the free allowance is ever raised. For the beta: use a
test account, run 5 transforms, then attempt a 6th.
**Pass:** the 6th (free tier) is blocked with the friendly quota
message ("Suas 5 magias grátis acabaram!…"), no AI call is made, and
no charge is incurred. For Family accounts, verify the 300/month
fair-use cap the same way on a staging account with a lowered cap.

## Sign-off

| Item | Pass / Fail | Tested by | Date | Notes |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |
| 8 | | | | |
| 9 | | | | |
| 10 | | | | |
| 11 | | | | |
| 12 | | | | |

**Beta gate:** all 12 must pass before the first paying family is
invited. A single failure is a launch blocker.
