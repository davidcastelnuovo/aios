// Copy allowlisted Edge Function secrets Production → Staging.
// Management API never returns plaintext; this runs ON the source project so
// Deno.env still has the values. Values are never logged.

import { corsHeaders } from "../_shared/cors.ts";
import {
  AGENT_EDGE_SECRET_ALLOWLIST,
  assertSafeTargetRef,
  projectRefFromSupabaseUrl,
  selectSecretsToCopy,
} from "../_shared/copy-edge-secrets.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callerCanManageProject(token: string, projectRef: string): Promise<boolean> {
  const resp = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "aios-copy-edge-secrets/1.0" },
  });
  return resp.ok;
}

async function probeCursorKey(apiKey: string): Promise<{ ok: boolean; status: number }> {
  if (!apiKey) return { ok: false, status: 0 };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
    "User-Agent": "aios-copy-edge-secrets/1.0",
  };
  let resp = await fetch("https://api.cursor.com/v1/models", { headers });
  if (resp.status === 401 || resp.status === 403) {
    resp = await fetch("https://api.cursor.com/v1/models", {
      headers: { ...headers, Authorization: `Basic ${btoa(`${apiKey}:`)}` },
    });
  }
  return { ok: resp.ok, status: resp.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "POST only" });

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "Unauthorized" });

  const sourceRef = projectRefFromSupabaseUrl(Deno.env.get("SUPABASE_URL"));
  if (!sourceRef) return json(500, { error: "SUPABASE_URL missing" });
  if (!(await callerCanManageProject(token, sourceRef))) return json(401, { error: "Unauthorized" });

  let body: { target_ref?: string; names?: string[] } = {};
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  let targetRef: string;
  try {
    targetRef = assertSafeTargetRef(String(body.target_ref || ""), sourceRef);
  } catch (e) {
    return json(400, { error: String((e as Error).message || e) });
  }

  const names = selectSecretsToCopy(body.names, AGENT_EDGE_SECRET_ALLOWLIST);
  const payload: { name: string; value: string }[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const value = Deno.env.get(name) || "";
    if (!value) missing.push(name);
    else payload.push({ name, value });
  }

  const cursorKey = Deno.env.get("CURSOR_API_KEY") || "";
  const cursorProbe = await probeCursorKey(cursorKey);

  const setResp = await fetch(`https://api.supabase.com/v1/projects/${targetRef}/secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "aios-copy-edge-secrets/1.0",
    },
    body: JSON.stringify(payload),
  });
  const setRaw = await setResp.text();
  if (!setResp.ok) {
    console.error("[copy-edge-secrets] set failed", setResp.status, setRaw.slice(0, 200));
    return json(502, { error: `staging secrets set ${setResp.status}`, copied: [], missing, cursor: cursorProbe });
  }

  return json(200, {
    ok: true,
    source: sourceRef,
    target: targetRef,
    copied: payload.map((s) => s.name),
    missing,
    cursor: cursorProbe,
  });
});
