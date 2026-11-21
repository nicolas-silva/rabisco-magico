# Language audit — Rabisco Mágico

Every UI string, error message and child-facing phrase in the app lives
in one of these three files. The app code (`public/app.js`,
`server.js`, `public/landing.html`) must use these keys — no hard-coded
strings in components.

## Files

- `pt-BR.json` — source language. The product was written in Brazilian
  Portuguese first.
- `en.json` — English.
- `es.json` — Spanish.

## Consistency check

Run this to confirm all three files have exactly the same keys:

```bash
node -e "
const fs=require('fs');
const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v!==null&&!Array.isArray(v)?keys(v,p+k+'.'):[p+k]);
const a=keys(JSON.parse(fs.readFileSync('locales/pt-BR.json')));
const b=keys(JSON.parse(fs.readFileSync('locales/en.json')));
const c=keys(JSON.parse(fs.readFileSync('locales/es.json')));
const missing=(x,y)=>x.filter(k=>!y.includes(k));
console.log('en missing:',missing(a,b)); console.log('es missing:',missing(a,c));
console.log('en extra:',missing(b,a)); console.log('es extra:',missing(c,a));
"
```

The `_meta` key is excluded from the comparison in practice (it differs
by design); the check above includes it, so expect `_meta.language`
and `_meta.note` to show as "different" — they are meant to differ.

## Needs a native-speaker check

Each file has a `needsNativeCheck` array listing the keys a native
speaker must review before launch. The rule from the launch plan:
machine-translate the first draft if you must, but have a native speaker
check the child-facing phrases — a phrase that is technically correct
and emotionally flat will show up in every single result a family sees.

- **pt-BR:** no phrases flagged (native source), but any new phrase
  added later must be reviewed before release.
- **en:** `loading`, `errors.quota`, `errors.busy`, `fallback.phrase`,
  `landing.subheadline`.
- **es:** all child-facing phrases — the whole Spanish file was
  translated from pt-BR and has not had a native-speaker pass yet.
  Flagged: `app.hint`, `loading`, `errors.empty`, `errors.rateLimit`,
  `errors.quota`, `errors.busy`, `errors.notConfigured`,
  `fallback.phrase`, `landing.headline`, `landing.subheadline`.

## Rules for adding strings

1. Add the key to `pt-BR.json` first, then `en.json`, then `es.json`.
2. Keep child-facing phrases short (title ≤ 5 words, phrase ≤ 18 words).
3. Never put a child's name or personal data in a string.
4. Re-run the consistency check and update `needsNativeCheck`.
