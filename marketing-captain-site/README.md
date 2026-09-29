# marketing-captain.co.il (mirror + Carmen layer)

Static mirror of Marketing Captain, deployed to Vercel project **marketing-captain-site**.

## Carmen overlay (additive)

- `overlay/carmen/` — CSS, JS, Carmen Marketing OS logo + MC-style visuals (does **not** replace Elementor pages).
- `patch-html.mjs` — adds `<link>` + `<script>` to each `index.html`.
- `carmen.js` inserts the hero / intro **after** the existing header.

## Deploy (manual)

```bash
# 1) Refresh mirror (optional)
rm -rf src && mkdir src && cd src
wget -mk -np -nH -e robots=off https://marketing-captain-site.vercel.app/

# 2) Fix wget filenames + apply overlay (required before every deploy)
cd ..
node fix-mirror.mjs src
cp -r overlay/carmen src/carmen
node patch-html.mjs src

# 3) Production deploy
cd src && npx vercel deploy --prod --yes --scope aios-crm
```

Production URL: https://marketing-captain-site.vercel.app/
