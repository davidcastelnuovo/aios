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

## Own repository (recommended)

This project is **not part of AIOS**. On GitHub it currently lives on branch `woodhill-site` in the `aios` repo only as a staging area.

To move it to a dedicated repo:

```bash
git clone --single-branch --branch woodhill-site https://github.com/davidcastelnuovo/aios.git woodhill-web
cd woodhill-web
git remote remove origin
# Create an empty repo on GitHub, then:
git remote add origin git@github.com:YOU/woodhill-web.git
git push -u origin main
```

Then in Vercel: **Add New Project** → import that repository (framework: Vite).

## Deploy (Vercel)

Import this repository as a **new Vercel project** (not AIOS). Framework preset: Vite. Build: `npm run build`, output: `dist`.

## Notes

- Contact form is front-end demo only (no server yet).
- Images load from the live woodhill CDN.
- Re-run `import:content` when WordPress content changes.
