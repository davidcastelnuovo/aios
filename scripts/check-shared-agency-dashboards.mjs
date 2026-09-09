#!/usr/bin/env node
/**
 * Guard against regressions that hide DMM-hosted dashboards from MarketingCaptain.
 *
 * Shared agencies (DMM-MC) store crm_dashboards on the agency home tenant (DMM).
 * The Dashboards tab and client Reports tab MUST use fetchAccessibleDashboards —
 * a plain `.eq('tenant_id', uiTenant)` query silently drops those rows.
 *
 * Regression history: PR #335 fixed this; merge of stale branch #333 / access-invite
 * into develop (31cb0a3e) restored the tenant-only query and wiped the fix.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

function mustInclude(rel, needle, why) {
  const src = read(rel);
  if (!src.includes(needle)) {
    failures.push(`${rel}: missing \`${needle}\` — ${why}`);
  }
}

function mustNotMatch(rel, re, why) {
  const src = read(rel);
  if (re.test(src)) {
    failures.push(`${rel}: matched ${re} — ${why}`);
  }
}

mustInclude(
  "src/pages/DynamicTables.tsx",
  "fetchAccessibleDashboards",
  "Dashboards tab must union own-tenant + shared-agency rows (DMM-MC under DMM)",
);

mustInclude(
  "src/components/clients/ClientTablesTab.tsx",
  "fetchAccessibleDashboards",
  "Client Reports → dashboards must use the shared-agency accessible union",
);

// Anti-pattern that caused the Aug/Sep 2026 regression: tenant-scoped list query.
mustNotMatch(
  "src/pages/DynamicTables.tsx",
  /from\(\s*['"]crm_dashboards['"]\s*\)[\s\S]{0,400}\.eq\(\s*['"]tenant_id['"]/,
  "do not query crm_dashboards with only UI tenant_id; use fetchAccessibleDashboards",
);

if (failures.length) {
  console.error("Shared-agency dashboard guard FAILED:\n");
  for (const f of failures) console.error(` - ${f}`);
  console.error(
    "\nSee docs/postmortems/2026-09-09-dmm-dashboards-regression.md and src/lib/crmDashboards.ts",
  );
  process.exit(1);
}

console.log("Shared-agency dashboard guard OK");
