#!/usr/bin/env node
/**
 * Additive Carmen layer hooks — inserts link/script before </head> if missing.
 * Does not modify body HTML (Carmen UI is injected by carmen.js after header).
 */
import fs from "fs";
import path from "path";

const siteRoot = process.argv[2] || path.join(import.meta.dirname, "src");
const inject = `
<link rel="stylesheet" href="/carmen/carmen.css" />
<script src="/carmen/carmen.js" defer></script>
`;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === "index.html") out.push(full);
  }
  return out;
}

let patched = 0;
for (const file of walk(siteRoot)) {
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("/carmen/carmen.css")) continue;
  if (!html.includes("</head>")) continue;
  html = html.replace("</head>", `${inject}</head>`);
  fs.writeFileSync(file, html);
  patched++;
  console.log("patched", path.relative(siteRoot, file));
}
console.log(`done: ${patched} files`);
