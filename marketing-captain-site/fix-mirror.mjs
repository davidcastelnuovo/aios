#!/usr/bin/env node
/**
 * Fix wget mirror for Vercel static hosting:
 * - Rename files that contain "?" in the filename (strip query suffix)
 * - Use root-absolute asset paths in HTML so /about/ etc. work on mobile
 */
import fs from "fs";
import path from "path";

const siteRoot = process.argv[2] || path.join(import.meta.dirname, "src");

function walkFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

let renamed = 0;
for (const file of walkFiles(siteRoot)) {
  const base = path.basename(file);
  if (!base.includes("?")) continue;
  const cleanBase = base.split("?")[0];
  const dest = path.join(path.dirname(file), cleanBase);
  if (file === dest) continue;
  if (fs.existsSync(dest)) fs.unlinkSync(file);
  else fs.renameSync(file, dest);
  renamed++;
}
console.log(`renamed ${renamed} files with ? in filename`);

const htmlFiles = walkFiles(siteRoot).filter((f) => path.basename(f) === "index.html");
let htmlFixed = 0;
for (const file of htmlFiles) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(/(\s(?:href|src)=['"])wp-/g, "$1/wp-");
  html = html.replace(/(\s(?:href|src)=['"])\/wp-content\/plugins\/elementor\//g, "$1/wp-content/plugins/elementor/");
  if (html !== before) {
    fs.writeFileSync(file, html);
    htmlFixed++;
  }
}
console.log(`fixed root paths in ${htmlFixed} html files`);
