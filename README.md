# Woodhill — clean JavaScript site

Static rebuild of [woodhill.co.il](https://www.woodhill.co.il/) without WordPress, Avada, or Revolution Slider.

## Stack

- Vite
- Vanilla ES modules (hash router)
- Content from the public WordPress REST API → `public/data/site-content.json`

## Local

```bash
npm install
npm run import:content   # refresh pages/posts from live site
npm run dev              # http://localhost:5174
npm run build
npm run preview
```

## Deploy (Vercel)

Import this repository as a **new Vercel project** (not AIOS). Framework preset: Vite. Build: `npm run build`, output: `dist`.

## Notes

- Contact form is front-end demo only (no server yet).
- Images load from the live woodhill CDN.
- Re-run `import:content` when WordPress content changes.
