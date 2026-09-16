#!/usr/bin/env node
/**
 * Permission persona guard — catches RLS / scope regressions before merge.
 *
 * 1) Static (always): hybrid-SEO wiring in migrations + frontend + edge function.
 * 2) Live (when SUPABASE_ACCESS_TOKEN + staging project ref): SQL golden personas.
 *
 * See docs/postmortems/2026-09-09-hybrid-seo-report-access-regression.md
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = resolve(dirname(fileURLToPath(import.meta.url)), "permission-personas.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const failures = [];
const warnings = [];

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8");
}

function mustInclude(rel, needle, why) {
  if (!read(rel).includes(needle)) {
    failures.push(`${rel}: missing \`${needle}\` — ${why}`);
  }
}

// ── Static ─────────────────────────────────────────────────────────────────

mustInclude(
  "supabase/migrations/20260909140000_fix_hybrid_seo_report_access.sql",
  "user_has_seo_scope",
  "hybrid SEO scope function must exist in migrations",
);

mustInclude(
  "supabase/migrations/20260909140000_fix_hybrid_seo_report_access.sql",
  "user_has_seo_scope(_user_id)",
  "client scope helpers must delegate SEO to user_has_seo_scope",
);

const hybridMigration = read("supabase/migrations/20260909140000_fix_hybrid_seo_report_access.sql");
if (hybridMigration.includes("user_can_view_client") && !hybridMigration.includes("user_has_seo_scope(uid)")) {
  failures.push(
    "20260909140000: user_can_view_client patch must call user_has_seo_scope(uid)",
  );
}

mustInclude(
  "src/hooks/useUserRole.ts",
  "isSeoTaggedCampaigner",
  "frontend isSeo must honor campaigner.role SEO tag",
);

mustInclude(
  "supabase/functions/crm-tables/index.ts",
  "user_has_seo_scope",
  "crm-tables must resolve SEO scope via user_has_seo_scope",
);

const optimizeRls = read("supabase/migrations/20260909120000_optimize_clients_tasks_rls_scope.sql");
if (
  optimizeRls.includes("user_can_view_client") &&
  optimizeRls.includes("is_seo_staff(uid)") &&
  !optimizeRls.includes("user_has_seo_scope")
) {
  warnings.push(
    "optimize_clients_tasks_rls migration uses is_seo_staff-only SEO path — " +
      "hybrid migration 20260909140000 must be applied after it on every DB",
  );
}

// ── Live (Staging) ─────────────────────────────────────────────────────────

async function queryDb(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref =
    process.env.SUPABASE_STAGING_PROJECT_ID ||
    process.env.PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return null;

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Staging query failed HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

function resolveRef(map, key) {
  const v = map?.[key];
  if (!v) throw new Error(`Unknown fixture key: ${key}`);
  return v;
}

async function runLiveChecks() {
  for (const sig of config.required_functions || []) {
    const proc = `public.${sig}`;
    const rows = await queryDb(`SELECT to_regprocedure('${proc}') IS NOT NULL AS ok`);
    if (!rows?.[0]?.ok) {
      failures.push(`Staging DB: missing required function ${proc}`);
    }
  }

  for (const persona of config.personas) {
    const uid = persona.user_id;
    const label = persona.label || persona.key;
    const checks = persona.checks || {};

    for (const [fn, expected] of Object.entries(checks)) {
      if (fn === "user_manages_agency") {
        for (const agencyKey of expected) {
          const agencyId = resolveRef(config.agencies, agencyKey);
          const rows = await queryDb(
            `SELECT public.user_manages_agency('${uid}'::uuid, '${agencyId}'::uuid) AS v`,
          );
          if (rows?.[0]?.v !== true) {
            failures.push(`${label}: user_manages_agency(${agencyKey}) expected true`);
          }
        }
        continue;
      }

      if (fn === "user_can_access_client") {
        for (const clientKey of expected) {
          const clientId = resolveRef(config.clients, clientKey);
          const rows = await queryDb(
            `SELECT public.user_can_access_client('${uid}'::uuid, '${clientId}'::uuid) AS v`,
          );
          if (rows?.[0]?.v !== true) {
            failures.push(`${label}: user_can_access_client(${clientKey}) expected true`);
          }
        }
        continue;
      }

      if (fn === "seo_clients_in_get_user_client_ids") {
        const rows = await queryDb(`SELECT public.get_user_client_ids('${uid}'::uuid) AS ids`);
        const ids = rows?.[0]?.ids || [];
        for (const clientKey of expected) {
          const clientId = resolveRef(config.clients, clientKey);
          if (!ids.includes(clientId)) {
            failures.push(`${label}: get_user_client_ids missing ${clientKey}`);
          }
        }
        continue;
      }

      if (typeof expected === "boolean") {
        const rows = await queryDb(`SELECT public.${fn}('${uid}'::uuid) AS v`);
        if (rows?.[0]?.v !== expected) {
          failures.push(`${label}: ${fn} expected ${expected}, got ${rows?.[0]?.v}`);
        }
        continue;
      }

      failures.push(`Unknown check ${fn} for persona ${persona.key}`);
    }

    for (const clientKey of checks.user_can_access_client || []) {
      const clientId = resolveRef(config.clients, clientKey);
      const tables = await queryDb(
        `SELECT id FROM public.crm_tables WHERE client_id = '${clientId}'::uuid AND integration_type = 'ahrefs' LIMIT 1`,
      );
      const tableId = tables?.[0]?.id;
      if (!tableId) {
        warnings.push(`${label}: no ahrefs table on staging for ${clientKey} — skipped crm_table check`);
        continue;
      }
      const access = await queryDb(
        `SELECT public.user_can_access_crm_table('${uid}'::uuid, '${tableId}'::uuid) AS v`,
      );
      if (access?.[0]?.v !== true) {
        failures.push(`${label}: user_can_access_crm_table(${clientKey}) expected true`);
      }
    }
  }
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref =
    process.env.SUPABASE_STAGING_PROJECT_ID ||
    process.env.PROJECT_REF ||
    process.env.SUPABASE_PROJECT_REF;

  if (token && ref) {
    try {
      await runLiveChecks();
      console.log("Permission persona live checks OK (staging)");
    } catch (err) {
      failures.push(`Live check error: ${err.message}`);
    }
  } else {
    warnings.push(
      "Skipping live Staging SQL checks (set SUPABASE_ACCESS_TOKEN + SUPABASE_STAGING_PROJECT_ID)",
    );
  }

  if (warnings.length) {
    console.warn("Permission persona warnings:");
    for (const w of warnings) console.warn(` - ${w}`);
  }

  if (failures.length) {
    console.error("Permission persona guard FAILED:\n");
    for (const f of failures) console.error(` - ${f}`);
    console.error(
      "\nSee docs/postmortems/2026-09-09-hybrid-seo-report-access-regression.md",
    );
    process.exit(1);
  }

  console.log("Permission persona guard OK (static" + (token && ref ? " + live" : "") + ")");
}

main();
