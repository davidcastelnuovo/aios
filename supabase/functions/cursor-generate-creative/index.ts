// Dedicated Creative Cloud Agent — same Cursor runtime that made the
// premium Hebrew ads, separate from Carmen's coding sticky agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";
const CREATIVE_MARKER = "[CREATIVE AGENT]";

const sb = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function cursorAuthHeaders(apiKey: string, basic = false): Record<string, string> {
  return {
    Authorization: basic ? `Basic ${btoa(`${apiKey}:`)}` : `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "aios-cursor-creative/1.0",
  };
}

async function cursorFetch(apiKey: string, url: string, init: RequestInit): Promise<Response> {
  let resp = await fetch(url, { ...init, headers: { ...cursorAuthHeaders(apiKey, false), ...(init.headers || {}) } });
  if (resp.status === 401 || resp.status === 403) {
    resp = await fetch(url, { ...init, headers: { ...cursorAuthHeaders(apiKey, true), ...(init.headers || {}) } });
  }
  return resp;
}

function parseAgentResponse(raw: string): { url: string; id: string } {
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(raw); } catch { /* ignore */ }
  const agent = (data.agent && typeof data.agent === "object" ? data.agent : data) as Record<string, unknown>;
  const id = String(agent.id || data.id || "");
  const url = String(agent.url || data.url || (id ? `https://cursor.com/agents/${id}` : ""));
  return { url, id: id || url };
}

async function getCreativeStickyId(tenantId: string): Promise<string | null> {
  const { data } = await sb()
    .from("cursor_dispatches")
    .select("cursor_agent_id")
    .eq("tenant_id", tenantId)
    .like("request_text", `${CREATIVE_MARKER}%`)
    .not("cursor_agent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = String((data as { cursor_agent_id?: string } | null)?.cursor_agent_id || "");
  return id.startsWith("bc-") ? id : null;
}

async function followUp(apiKey: string, agentId: string, promptText: string) {
  const url = `https://api.cursor.com/v1/agents/${encodeURIComponent(agentId)}/runs`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const resp = await cursorFetch(apiKey, url, {
      method: "POST",
      body: JSON.stringify({ prompt: { text: promptText } }),
    });
    const raw = await resp.text();
    if (resp.ok) {
      const parsed = parseAgentResponse(raw);
      return { id: agentId, url: parsed.url.includes("/agents/") ? parsed.url : `https://cursor.com/agents/${agentId}` };
    }
    if (resp.status === 409) {
      await new Promise((resolve) => setTimeout(resolve, 2500 * attempt));
      continue;
    }
    if (resp.status === 404 || resp.status === 410 || resp.status === 400) return null;
    throw new Error(`Cursor follow-up ${resp.status}: ${raw.slice(0, 240)}`);
  }
  return { id: agentId, url: `https://cursor.com/agents/${agentId}` };
}

async function createCreativeAgent(apiKey: string, promptText: string, name: string) {
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  const modelId = Deno.env.get("CURSOR_MODEL_ID") || "";
  const body: Record<string, unknown> = {
    prompt: { text: promptText },
    autoCreatePR: false,
    name: name.slice(0, 100),
  };
  if (modelId) body.model = { id: modelId };
  if (envName) body.env = { type: "cloud", name: envName };
  else {
    body.repos = [{ url: Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO, startingRef: Deno.env.get("CURSOR_STARTING_REF") || "main" }];
  }
  const resp = await cursorFetch(apiKey, "https://api.cursor.com/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const raw = await resp.text();
  if (!resp.ok) throw new Error(`Cursor agent create ${resp.status}: ${raw.slice(0, 240)}`);
  return parseAgentResponse(raw);
}

function decodeImageBytes(imageBase64: string): Uint8Array {
  const trimmed = imageBase64.replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  const bin = atob(trimmed);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function patchPayload(
  itemId: string,
  tenantId: string,
  mutate: (payload: Record<string, unknown>) => Record<string, unknown>,
) {
  const { data, error } = await sb()
    .from("marketing_work_items")
    .select("payload")
    .eq("id", itemId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error || !data) throw new Error(error?.message || "item not found");
  const next = mutate({ ...((data.payload as Record<string, unknown> | null) ?? {}) });
  const { error: updateError } = await sb()
    .from("marketing_work_items")
    .update({ payload: next })
    .eq("id", itemId)
    .eq("tenant_id", tenantId);
  if (updateError) throw updateError;
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const action = String(body.action ?? "dispatch");
  const tenantId = String(body.tenant_id ?? "");
  const itemId = String(body.item_id ?? "");
  if (!tenantId || !itemId) return json({ error: "tenant_id and item_id are required" }, 400);

  try {
    if (action === "complete") {
      const jobId = String(body.job_id ?? "");
      const token = String(body.job_token ?? "");
      const imageBase64 = String(body.image_base64 ?? "");
      if (!jobId || !token || !imageBase64) return json({ error: "job_id, job_token, and image_base64 are required" }, 400);

      const { data: item, error } = await sb()
        .from("marketing_work_items")
        .select("payload")
        .eq("id", itemId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error || !item) return json({ error: "item not found" }, 404);
      const payload = { ...((item.payload as Record<string, unknown> | null) ?? {}) };
      const jobs = Array.isArray(payload.creative_jobs) ? [...payload.creative_jobs] as Array<Record<string, unknown>> : [];
      const job = jobs.find((row) => String(row.id) === jobId);
      if (!job || String(job.token) !== token) return json({ error: "invalid job token" }, 401);

      const bytes = decodeImageBytes(imageBase64);
      const path = `${tenantId}/creative/${itemId}/cursor/${jobId}.png`;
      const upload = await sb().storage.from("entity-attachments").upload(path, bytes, {
        contentType: "image/png",
        upsert: true,
      });
      if (upload.error) throw upload.error;
      const { data: pub } = sb().storage.from("entity-attachments").getPublicUrl(path);
      const imageUrl = pub.publicUrl;
      const variationMeta = (body.variation && typeof body.variation === "object" ? body.variation : {}) as Record<string, unknown>;
      const variationId = String(job.variation_id || variationMeta.id || crypto.randomUUID());

      await patchPayload(itemId, tenantId, (current) => {
        const list = Array.isArray(current.variations) ? [...current.variations] as Array<Record<string, unknown>> : [];
        const nextVariation = {
          id: variationId,
          name: String(variationMeta.name || job.variation_name || "וריאציה"),
          imageUrl,
          format: String(variationMeta.format || current.format || "1:1"),
          layers: [],
          comments: [],
          createdAt: new Date().toISOString(),
          source: "ai",
          copyKey: variationMeta.copy_key ?? job.copy_key,
          copyLabel: variationMeta.copy_label ?? job.copy_label,
          copyText: variationMeta.copy_text ?? job.copy_text,
          parentId: variationMeta.parent_id ?? job.parent_id,
        };
        const index = list.findIndex((row) => String(row.id) === variationId);
        if (index >= 0) list[index] = { ...list[index], ...nextVariation, imageUrl };
        else list.push(nextVariation);
        const nextJobs = (Array.isArray(current.creative_jobs) ? current.creative_jobs as Array<Record<string, unknown>> : []).map((row) =>
          String(row.id) === jobId ? { ...row, status: "completed", token: undefined } : row,
        );
        return {
          ...current,
          variations: list,
          image_url: imageUrl,
          creative_jobs: nextJobs,
          department: "creative",
        };
      });

      await sb().from("marketing_assets").insert({
        tenant_id: tenantId,
        item_id: itemId,
        type: "image",
        url: imageUrl,
        meta: { source: "cursor_creative_agent", variation_id: variationId, job_id: jobId },
      });

      return json({ ok: true, image_url: imageUrl, variation_id: variationId });
    }

    const auth = await requireAuth(req);
    if (!auth) return json({ error: "unauthorized" }, 401);

    if (action === "cancel") {
      const jobId = String(body.job_id ?? "");
      if (!jobId) return json({ error: "job_id required" }, 400);
      await patchPayload(itemId, tenantId, (current) => ({
        ...current,
        creative_jobs: (Array.isArray(current.creative_jobs) ? current.creative_jobs as Array<Record<string, unknown>> : []).map((row) =>
          String(row.id) === jobId ? { ...row, status: "cancelled" } : row,
        ),
      }));
      return json({ ok: true });
    }

    const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
    if (!apiKey) return json({ error: "CURSOR_API_KEY is not configured" }, 500);

    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) return json({ error: "prompt is required" }, 400);
    const variation = (body.variation && typeof body.variation === "object" ? body.variation : {}) as Record<string, unknown>;
    const variationId = String(variation.id || crypto.randomUUID());
    const jobId = crypto.randomUUID();
    const jobToken = crypto.randomUUID().replaceAll("-", "");

    await patchPayload(itemId, tenantId, (current) => ({
      ...current,
      creative_jobs: [
        ...(Array.isArray(current.creative_jobs) ? current.creative_jobs as Array<Record<string, unknown>> : []).slice(-8),
        {
          id: jobId,
          token: jobToken,
          status: "running",
          variation_id: variationId,
          variation_name: variation.name,
          copy_key: variation.copy_key,
          copy_label: variation.copy_label,
          copy_text: variation.copy_text,
          parent_id: variation.parent_id,
          created_at: new Date().toISOString(),
        },
      ],
      department: "creative",
    }));

    const callback = [
      `${CREATIVE_MARKER} job ${jobId}`,
      "When the PNG is ready, POST it back. Do not open a PR. Do not edit the repo.",
      `POST ${SUPABASE_URL}/functions/v1/cursor-generate-creative`,
      "Content-Type: application/json",
      `Body JSON: {"action":"complete","tenant_id":"${tenantId}","item_id":"${itemId}","job_id":"${jobId}","job_token":"${jobToken}","image_base64":"<png-base64>","variation":{"id":"${variationId}","name":${JSON.stringify(String(variation.name || "וריאציה"))},"format":${JSON.stringify(String(variation.format || "1:1"))},"copy_key":${JSON.stringify(variation.copy_key ?? null)},"copy_label":${JSON.stringify(variation.copy_label ?? null)},"copy_text":${JSON.stringify(String(variation.copy_text || "").slice(0, 400))},"parent_id":${JSON.stringify(variation.parent_id ?? null)}}}`,
    ].join("\n");

    const fullPrompt = `${prompt}\n\n--- WRITE BACK ---\n${callback}`;
    const sticky = await getCreativeStickyId(tenantId);
    let fired = sticky ? await followUp(apiKey, sticky, fullPrompt) : null;
    if (!fired) {
      fired = await createCreativeAgent(apiKey, fullPrompt, `Creative: ${String(variation.copy_label || variation.name || "ad").slice(0, 50)}`);
    }

    await sb().from("cursor_dispatches").insert({
      tenant_id: tenantId,
      tool: "ask_cursor",
      request_text: `${CREATIVE_MARKER} ${String(variation.copy_label || variation.name || itemId).slice(0, 180)}`,
      context: `item_id=${itemId} job_id=${jobId} variation_id=${variationId}`,
      session_url: fired.url,
      cursor_agent_id: fired.id,
      status: "dispatched",
    });

    await patchPayload(itemId, tenantId, (current) => ({
      ...current,
      creative_jobs: (Array.isArray(current.creative_jobs) ? current.creative_jobs as Array<Record<string, unknown>> : []).map((row) =>
        String(row.id) === jobId ? { ...row, agent_url: fired.url, cursor_agent_id: fired.id } : row,
      ),
    }));

    return json({ ok: true, job_id: jobId, agent_url: fired.url, cursor_agent_id: fired.id, variation_id: variationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cursor-generate-creative]", message);
    return json({ error: message }, 500);
  }
});
