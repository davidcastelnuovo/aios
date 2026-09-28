# Woodhill — rebuild (clean JavaScript)

Static rebuild of [woodhill.co.il](https://www.woodhill.co.il/) without WordPress, Avada, or Revolution Slider.

## Stack

- Vite
- Vanilla ES modules (hash router, no React)
- Content imported from the public WordPress REST API into `public/data/site-content.json`

## Commands

```bash
cd woodhill-site
npm install
npm run import:content   # refresh pages/posts from live site
npm run dev              # http://localhost:5174
npm run build
npm run preview
```

## Notes

- Contact form is a front-end demo only (no server endpoint yet).
- Images load from the original site CDN URLs.
- Re-run `import:content` when the WordPress site changes.
