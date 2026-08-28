#!/usr/bin/env node
/**
 * Create/update Vercel Preview env vars for Staging.
 * Never prints secret values. Never patches Production-targeted rows. Never deletes.
 *
 * Required env: VERCEL_TOKEN, VERCEL_PROJECT_ID,
 *   SUPABASE_STAGING_URL, SUPABASE_STAGING_ANON_KEY, SUPABASE_STAGING_SERVICE_ROLE_KEY
 * Optional: VERCEL_ORG_ID or VERCEL_TEAM_ID, SUPABASE_STAGING_PROJECT_ID,
 *   PREVIEW_GIT_BRANCH (default develop)
 */
const DRY_RUN = process.argv.includes("--dry-run");

function required(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

const token = required("VERCEL_TOKEN");
const projectId = required("VERCEL_PROJECT_ID");
const stagingUrl = required("SUPABASE_STAGING_URL");
const stagingAnon = required("SUPABASE_STAGING_ANON_KEY");
const stagingService = required("SUPABASE_STAGING_SERVICE_ROLE_KEY");
const gitBranch = process.env.PREVIEW_GIT_BRANCH || "develop";
const teamId = process.env.VERCEL_ORG_ID || process.env.VERCEL_TEAM_ID || "";
const stagingProjectId = process.env.SUPABASE_STAGING_PROJECT_ID || "";

const desired = [
  ["VITE_SUPABASE_URL", stagingUrl],
  ["VITE_SUPABASE_ANON_KEY", stagingAnon],
  ["VITE_SUPABASE_PUBLISHABLE_KEY", stagingAnon],
  ["SUPABASE_URL", stagingUrl],
  ["SUPABASE_ANON_KEY", stagingAnon],
  ["SUPABASE_SERVICE_ROLE_KEY", stagingService],
  ["APP_ENV", "staging"],
  ["STAGING_SAFE_MODE", "true"],
];
if (stagingProjectId) {
  desired.push(["VITE_SUPABASE_PROJECT_ID", stagingProjectId]);
}

function apiUrl(path) {
  const u = new URL(`https://api.vercel.com${path}`);
  if (teamId) u.searchParams.set("teamId", teamId);
  return u;
}

async function vercel(method, path, body) {
  const url = apiUrl(path);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: "[non-json]" };
  }
  if (!res.ok) {
    const err = json?.error?.code || json?.error?.message || res.status;
    throw new Error(`${method} ${path} failed: ${err}`);
  }
  return json;
}

function targetsOf(entry) {
  return Array.isArray(entry.target) ? entry.target : [];
}

function isPreviewDevelop(entry) {
  const targets = targetsOf(entry);
  const onlyPreview = targets.length === 1 && targets[0] === "preview";
  const branch = entry.gitBranch || "";
  return onlyPreview && branch === gitBranch;
}

function touchesProduction(entry) {
  return targetsOf(entry).includes("production");
}

async function main() {
  const listed = await vercel("GET", `/v10/projects/${encodeURIComponent(projectId)}/env`);
  const existing = listed.envs || listed || [];
  if (!Array.isArray(existing)) {
    throw new Error("unexpected env list response");
  }

  console.log(`project ok; existing env rows: ${existing.length}; branch=${gitBranch}; dryRun=${DRY_RUN}`);

  for (const [key, value] of desired) {
    const rows = existing.filter((e) => e.key === key);
    const prodRows = rows.filter(touchesProduction);
    const previewDev = rows.find(isPreviewDevelop);

    if (prodRows.length) {
      console.log(`${key}: leaving ${prodRows.length} Production row(s) unchanged`);
    }

    if (previewDev) {
      console.log(`${key}: ${DRY_RUN ? "would update" : "updating"} existing Preview+${gitBranch} row`);
      if (!DRY_RUN) {
        await vercel("PATCH", `/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(previewDev.id)}`, {
          value,
          type: "encrypted",
          target: ["preview"],
          gitBranch,
        });
      }
      continue;
    }

    console.log(`${key}: ${DRY_RUN ? "would create" : "creating"} Preview+${gitBranch} row`);
    if (!DRY_RUN) {
      await vercel("POST", `/v10/projects/${encodeURIComponent(projectId)}/env`, {
        key,
        value,
        type: "encrypted",
        target: ["preview"],
        gitBranch,
        comment: "Staging Preview; do not copy onto Production",
      });
    }
  }

  console.log("done; no Production rows modified; values not printed");
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exit(1);
});
