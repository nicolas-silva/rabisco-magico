# Screenshot checklist — Rabisco Mágico

> **DRAFT — 20 November 2026. No screenshots have been taken and
> nothing has been submitted.** Sizes below were checked against
> Apple's screenshot specifications and Google's Play Console help on
> preview assets (via published 2026 guides, November 2026) — but
> both stores change these numbers when new devices ship, so
> **re-check the exact sizes in App Store Connect and Play Console on
> the day of submission** and update this file if they moved. If this
> file and the store disagree on the day, the store wins.
>
> The app is portrait-only and mobile-only (see `README.md`: designed
> for portrait, 360–480 px wide). There is no landscape set to shoot
> and no Apple Watch / TV / Mac set. The native wrapper does not exist
> yet (`capacitor.config.draft.json`) — screenshots come from the
> native build on real devices, not from a desktop browser window,
> once that build exists.

## 1. Apple App Store — required sizes

Apple accepts PNG or JPEG, sRGB, **no transparency**. 1–10 screenshots
per device size, per localisation. Portrait is what we shoot (the app
is portrait-only); landscape sizes are the same pair swapped.

| Device size | Portrait (px) | Status | Notes |
|---|---|---|---|
| iPhone with Dynamic Island, medium display (iPhone 14 Pro / 15 / 15 Pro / 16 / 16 Pro / 17) | 1206 × 2622 or 1179 × 2556 | **Required** — at least one screenshot in this slot | This is the slot App Store Connect asks for first. Some older guides still name the 6.9″ size as required; Apple's current spec names this one. |
| iPhone with Dynamic Island, large display (iPhone 14 Pro Max / 15 Pro Max / 16 Pro Max / 17 Pro Max) | 1290 × 2796 or 1320 × 2868 | Recommended — shoot this set too | Sharpest on the biggest screens; App Store Connect scales it down for smaller phones if the medium set is missing. Shooting both removes all doubt. |
| iPhone 6.5″ (iPhone 14 Plus / 13 Pro Max / 12 Pro Max / 11 Pro Max) | 1242 × 2688 or 1284 × 2778 | Fallback only | Only needed if neither of the sets above is uploaded. Do not shoot a third set unless App Store Connect asks for it. |
| iPad 13″ (iPad Pro 13″ M4 / iPad Air 13″) | 2048 × 2732 or 2064 × 2752 | **Required if the app runs on iPad** | **Open decision:** iPad is the natural device for a kids' drawing app, so plan to support iPad and shoot this set. If the native build is deliberately iPhone-only, this set is not needed — but that decision must be made consciously, not by accident. |

**Shoot plan (Apple):** one set at 1206 × 2622, one set at
1290 × 2796, and (if iPad is supported) one set at 2048 × 2732.
Same 6–8 shots in each set (§3), in PT and in EN — that is 2
localisations × up to 3 sizes × 6–8 shots. Do not upscale a smaller
screenshot to fit a larger slot; capture at native resolution on the
device (or export at exactly the slot size from a native-resolution
capture).

Apple also rejects screenshots that show only a splash screen, a
logo, or a login page — every shot must show the real app in use.

## 2. Google Play — required sizes

Google Play accepts JPEG or 24-bit PNG, **no alpha channel**, up to
8 MB per file. It sets ranges, not fixed sizes like Apple.

| Asset | Size | Count | Notes |
|---|---|---|---|
| Phone screenshots | Each side 320–3840 px, long side at most 2× the short side | **At least 2 to publish; up to 8 per device type** | **Shoot at 1080 × 1920 portrait** — that is the recommended size, and 4+ shots at 1080 px or wider make the app eligible for Google's large screenshot-based recommendation formats. |
| 7″ / 10″ tablet + Chromebook screenshots | Each side 1080–7680 px, 16:9 landscape or 9:16 portrait | At least 4 recommended | Only if the app is listed for tablets/Chromebooks. Same shots as the phone set, re-captured at tablet size — do not stretch phone shots. |
| Feature graphic | **1024 × 500** exactly, JPEG or 24-bit PNG, no alpha | 1, **required to publish** | No ranking/price words ("Best", "#1", "Sale"), no "Download now". Title + simple art only; it is also used as the cover of any preview video. |
| App icon | **512 × 512**, 32-bit PNG with alpha, max 1024 KB | 1, **required** | Google applies its own rounded mask — fill the whole square. This is the finished icon, not the SVG placeholder (`public/icon.svg`). |

**Shoot plan (Google Play):** at least 4 phone shots at
1080 × 1920 (same shots as §3), the 1024 × 500 feature graphic, and
the 512 × 512 icon. Tablet shots only if the listing targets tablets.
No Wear OS, TV, Automotive or XR assets — the app does not run there.

## 3. Which screens to capture (same story on both stores)

Shoot in order, so the listing reads like a parent watching a child
use the app. Use the same shot list for PT and EN (change the
language in the app's language picker, re-capture).

| # | Screen | What must be visible | Notes |
|---|---|---|---|
| 1 | Drawing board, mid-drawing | Blank-ish board with a half-finished drawing, colour palette, brush sizes, big Transformar button | The hero shot. A finished-looking drawing, not an empty board. |
| 2 | Drawing board, finished drawing | A complete simple drawing (e.g. sun + house + tree) before Transform | Shows what a 4–10-year-old actually draws. |
| 3 | Loading ("Fazendo mágica…") | The wand + loading line | Keep it — parents want to know the wait is friendly, not a spinner of doom. |
| 4 | Result screen | Generated realistic image + title + phrase + original drawing as the small tilted thumbnail | The payoff. The generated image must be a good one (see §5). |
| 5 | Result actions / share | Download + Share buttons visible (or the 1080×1350 share card itself) | Shows the keep-and-share loop. |
| 6 | Gallery | Grid with several works, one starred as favourite, search box visible | Shows the gallery, favourites and search. |
| 7 | Parental gate | The maths-question gate ("Só para adultos") | Parent-facing proof that purchases and settings sit behind an adult check. Do not show a solved answer. |
| 8 | Parent panel (optional) | Plan area without a visible price in the screenshot if possible; if a price is visible, it must match the live price exactly | Only include if the price shown is current on the day of submission. A stale price in a screenshot is a rejection risk and a parent-trust risk. |

Minimum viable set if time is short: shots 1, 3, 4 and 6 (Apple
needs at least 1 per required size; Google Play needs at least 2 to
publish and 4+ for recommendation formats — 4 is the real minimum).

## 4. Other graphics needed before submission

| Asset | Size / format | Status |
|---|---|---|
| Finished app icon | 1024 × 1024 PNG (Apple) — Google Play uses 512 × 512 from the same artwork | **Not done** — `public/icon.svg` is a placeholder (see `docs/release-checklist.md` §4). One finished artwork, exported at both sizes. |
| Splash / launch screen | Generated with `@capacitor/assets` from the icon artwork once the native project exists | Not done — needs the native project (`capacitor.config.draft.json`). |
| App preview video (optional) | Apple: up to 30 seconds, portrait; Google Play: YouTube link | Optional. Only if there is a good real-device recording; never a slideshow of screenshots. |

## 5. Kid-safe content rules for every screenshot — non-negotiable

These apply to screenshots, the feature graphic, the icon, and any
preview video. A breach here is a store rejection at best and a
child-safety failure at worst.

- [ ] **Only synthetic / test drawings.** Use the synthetic drawings
      from `benchmark/drawings-synthetic/` (or new drawings made by an
      adult for this purpose). **Never use a real child's drawing** in
      a store asset unless that child's parent gave explicit written
      permission for that specific image, for store use — the same
      rule as `docs/privacy-policy-draft.md` §4 and the permission
      template in `benchmark/`. When in doubt, use a synthetic one.
- [ ] **No real child in any asset.** No photo of a child, no child's
      name, no handwriting with a name, no school, no location.
- [ ] **No personal data visible.** No real parent email, no real
      account name, no real magic-link code, no real device owner
      name. Use a test account (`test@example.com` style) or crop the
      field out. The parental-gate shot must not show a solved answer.
- [ ] **Every generated image checked by an adult before it ships.**
      The result-screen shot (shot 4) must be reviewed like a real
      output-safety check: appropriate, no scary / violent / sexual
      content, no text the child did not draw. If the generated image
      is even slightly off, regenerate it — do not ship a mediocre
      one as the store's first impression.
- [ ] **Screenshots show the real app.** No mockups, no redesigned
      screens, no features that do not exist yet. Apple and Google
      both reject listings whose screenshots do not match the app.
- [ ] **No prices aimed at children, no pressure.** Prices appear
      only in the parent panel (shot 8, optional) and in the store
      description — never on the drawing board, the result screen,
      or the feature graphic. No countdowns, no "only today", no
      "don't miss out".
- [ ] **No ranking / superlative words on Google graphics.** No
      "Best", "#1", "Top", "New", "Discount", "Sale", "Million
      Downloads" — and no "Download now" / "Install now" / "Play now"
      calls to action (Google Play rules; see `docs/store-metadata.md` §4).
- [ ] **Clean device chrome.** Status bar set to 9:41, full battery,
      full signal, no notifications, no low-battery warning, no
      personal wallpaper behind anything. Same device, same OS
      version, same app version across a set.
- [ ] **Localised properly.** PT set uses the PT UI (language picker
      set to PT), EN set uses the EN UI. No mixed-language screens,
      no untranslated strings, no placeholder text.
- [ ] **Accessibility is visible.** The shots should show the app as
      it ships: 44 px touch targets, readable contrast (see
      `docs/accessibility-audit.md`). Do not retouch a screenshot to
      hide a contrast or layout problem — fix the app instead.
- [ ] **File hygiene.** PNG/JPEG only, sRGB, no transparency
      (except the Google Play 512 × 512 icon, which uses alpha),
      each file ≤ 8 MB on Google Play, exact pixel sizes from §1–§2
      (no off-by-a-few-pixels exports — the stores reject those).

## 6. Capture checklist (on the day)

- [ ] Native build installed on the capture devices (real iPhone +
      real Android phone, + iPad if supported). App version = the
      version being submitted. Language set, test account signed in
      as a parent, quota / plan state as a new parent would see it.
- [ ] Synthetic drawings loaded; generated results pre-made and
      reviewed (§5) so capture is not waiting on the AI.
- [ ] Capture each shot in §3 at native resolution; export to the
      exact slot sizes in §1–§2; verify every file's pixel size with
      `file` / `identify` before upload (do not trust the editor's
      export preset).
- [ ] Upload order: Apple first (it is pickier about sizes), then
      Google Play. Keep the exported files in the repo? No — store
      assets are not committed; keep them in the submission working
      folder and note their location in the release notes.
- [ ] After upload, open the listing preview on a real phone on each
      store and read every screenshot caption as a parent would.
      Fix anything that reads as a promise the app does not keep.
