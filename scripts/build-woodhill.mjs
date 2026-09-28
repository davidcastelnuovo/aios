import { cpSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = join(root, "woodhill-site");
const outDir = join(root, "public", "woodhill");

if (!existsSync(join(siteDir, "package.json"))) {
  console.log("woodhill-site missing, skipping woodhill build");
  process.exit(0);
}

execSync("npm ci", { cwd: siteDir, stdio: "inherit" });
execSync("npm run build", {
  cwd: siteDir,
  stdio: "inherit",
  env: { ...process.env, WOODHILL_BASE: "/woodhill/" },
});

rmSync(outDir, { recursive: true, force: true });
cpSync(join(siteDir, "dist"), outDir, { recursive: true });
console.log(`Woodhill static site → public/woodhill/`);
