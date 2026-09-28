import { readFileSync } from "node:fs";
import { findContent, normalizePath } from "../src/router.js";

const data = JSON.parse(
  readFileSync(new URL("../public/data/site-content.json", import.meta.url), "utf8"),
);

const paths = [
  "/",
  "/%d7%a6%d7%99%d7%95%d7%93-%d7%9c%d7%9e%d7%9b%d7%91%d7%a1%d7%95%d7%aa",
  "/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d",
  "/%d7%a6%d7%95%d7%a8-%d7%a7%d7%a9%d7%a8",
  ...data.navigation.map((n) => n.path),
  ...(data.navigation.flatMap((n) => n.children?.map((c) => c.path) || [])),
];

let missing = 0;
for (const path of paths) {
  if (path === "/" || normalizePath(path) === normalizePath("/%d7%9e%d7%90%d7%9e%d7%a8%d7%99%d7%9d")) continue;
  const hit = findContent(data, path);
  if (!hit) {
    console.log("MISSING", path);
    missing += 1;
  }
}

console.log(`Checked ${paths.length} routes, missing ${missing}`);
process.exit(missing ? 1 : 0);
