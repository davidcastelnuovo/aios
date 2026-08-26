// Dedicated Creative Cloud Agent — same Cursor runtime that made the
// premium Hebrew ads, separate from Carmen's coding sticky agent.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";
import {
  isInvalidCursorModelError,
  pickCreativeModelFromCatalog,
  resolveCreativeCursorModel,
} from "../_shared/cursorCreativeModel.ts";
import { upsertPointer } from "../_shared/carmen-memory.ts";
import { CREATIVE_DIRECT_SKIN, CREATIVE_DIRECT_SKIN_SLUG } from "../_shared/creativeDirectStanding.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DEFAULT_REPO = "https://github.com/davidcastelnuovo/aios";
const CREATIVE_MARKER = "[CREATIVE AGENT]";
const CREATIVE_DIRECT_NAME = "AIOS Creative Direct";
const CREATIVE_DIRECT_OPEN_MARKER = "[CREATIVE AGENT] opened Creative Direct";
const CREATIVE_DIRECT_IDENTITY = [
  "You are קריאייטיב דיירקט (AIOS Creative Direct) — the dedicated image chat of מחלקת קריאייטיב.",
  "Carmen and the creative department send jobs into THIS conversation as follow-ups. Stay in this thread.",
  "Do NOT edit the repository. Do NOT open a pull request. Do NOT write code.",
  "For each job: GenerateImage ONE finished Hebrew advertising still, POST the PNG back with action=complete, then stop.",
  "The photograph is the approved concept. Headline/CTA are TYPE only — never restage the copy as a new scene.",
].join(" ");

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

async function getCreativeSticky(tenantId: string): Promise<{ id: string; url: string } | null> {
  const forced = Deno.env.get("CURSOR_CREATIVE_STICKY_AGENT_ID") || "";
  if (forced.startsWith("bc-")) {
    return { id: forced, url: `https://cursor.com/agents/${forced}` };
  }
  const { data } = await sb()
    .from("cursor_dispatches")
    .select("cursor_agent_id, session_url")
    .eq("tenant_id", tenantId)
    .like("request_text", `${CREATIVE_DIRECT_OPEN_MARKER}%`)
    .not("cursor_agent_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const id = String((data as { cursor_agent_id?: string } | null)?.cursor_agent_id || "");
  if (!id.startsWith("bc-")) return null;
  const url = String((data as { session_url?: string } | null)?.session_url || "")
    || `https://cursor.com/agents/${id}`;
  return { id, url };
}

async function loadCreativeSkinText(tenantId: string): Promise<string> {
  await ensureCreativeDirectSkin(tenantId);
  const { data: tenant } = await sb()
    .from("ai_skills")
    .select("goal,constraints,system_prompt,steps")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  const row = tenant ?? (await sb()
    .from("ai_skills")
    .select("goal,constraints,system_prompt,steps")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("scope", "global")
    .eq("is_active", true)
    .maybeSingle()).data;
  if (!row) {
    return [CREATIVE_DIRECT_SKIN.goal, CREATIVE_DIRECT_SKIN.constraints, CREATIVE_DIRECT_SKIN.system_prompt, CREATIVE_DIRECT_SKIN.steps].join("\n");
  }
  return [row.goal, row.constraints, row.system_prompt, row.steps].filter(Boolean).join("\n");
}

async function loadTasteLessons(tenantId: string): Promise<string> {
  const { data } = await sb()
    .from("carmen_memory_pointers")
    .select("summary,title,created_at")
    .eq("tenant_id", tenantId)
    .eq("entity_id", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("category", "creative")
    .order("created_at", { ascending: false })
    .limit(12);
  const lines = (data ?? [])
    .map((row) => String((row as { summary?: string }).summary || "").trim())
    .filter(Boolean);
  return lines.map((line) => `- ${line}`).join("\n");
}

async function ensureCreativeDirectSkin(tenantId: string) {
  const { data: tenant } = await sb()
    .from("ai_skills")
    .select("id")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();
  if (tenant) return;
  const { data: global } = await sb()
    .from("ai_skills")
    .select("id")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("scope", "global")
    .eq("is_active", true)
    .maybeSingle();
  if (global) return;
  await sb().from("ai_skills").insert({
    slug: CREATIVE_DIRECT_SKIN.slug,
    scope: "tenant",
    tenant_id: tenantId,
    name: CREATIVE_DIRECT_SKIN.name,
    description: CREATIVE_DIRECT_SKIN.description,
    goal: CREATIVE_DIRECT_SKIN.goal,
    constraints: CREATIVE_DIRECT_SKIN.constraints,
    system_prompt: CREATIVE_DIRECT_SKIN.system_prompt,
    steps: CREATIVE_DIRECT_SKIN.steps,
    allowed_tools: CREATIVE_DIRECT_SKIN.allowed_tools,
    triggers: CREATIVE_DIRECT_SKIN.triggers,
    handoff_slugs: CREATIVE_DIRECT_SKIN.handoff_slugs,
    is_active: true,
    created_by_agent: true,
  });
}

async function rememberCreativeLesson(tenantId: string, itemId: string, lesson: string) {
  const text = lesson.trim().slice(0, 500);
  if (!text) return;
  const id = crypto.randomUUID();
  await upsertPointer(sb(), {
    tenant_id: tenantId,
    category: "creative",
    subcategory: "direct_taste",
    path: `creative/direct/lessons/${id}`,
    entity_type: "skill",
    entity_id: CREATIVE_DIRECT_SKIN_SLUG,
    title: "טעם מקריאייטיב דיירקט",
    summary: text,
    importance: 72,
    metadata: { item_id: itemId },
    withEmbedding: true,
  });
  await ensureCreativeDirectSkin(tenantId);
  const { data: tenant } = await sb()
    .from("ai_skills")
    .select("id,steps")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  const stamp = new Date().toISOString().slice(0, 10);
  const bullet = `- ${stamp}: ${text}`;
  if (tenant?.id) {
    const previous = String(tenant.steps || CREATIVE_DIRECT_SKIN.steps);
    const lines = previous.split("\n").map((line) => line.trim()).filter(Boolean);
    const kept = [...lines.filter((line) => line !== bullet), bullet].slice(-24);
    await sb().from("ai_skills").update({ steps: kept.join("\n") }).eq("id", tenant.id);
    return;
  }
  const { data: global } = await sb()
    .from("ai_skills")
    .select("goal,constraints,system_prompt,steps,description,name")
    .eq("slug", CREATIVE_DIRECT_SKIN_SLUG)
    .eq("scope", "global")
    .maybeSingle();
  await sb().from("ai_skills").insert({
    slug: CREATIVE_DIRECT_SKIN.slug,
    scope: "tenant",
    tenant_id: tenantId,
    name: global?.name || CREATIVE_DIRECT_SKIN.name,
    description: global?.description || CREATIVE_DIRECT_SKIN.description,
    goal: global?.goal || CREATIVE_DIRECT_SKIN.goal,
    constraints: global?.constraints || CREATIVE_DIRECT_SKIN.constraints,
    system_prompt: global?.system_prompt || CREATIVE_DIRECT_SKIN.system_prompt,
    steps: [String(global?.steps || CREATIVE_DIRECT_SKIN.steps), "טעם שנצבר מריג׳קטים:", bullet].filter(Boolean).join("\n"),
    allowed_tools: CREATIVE_DIRECT_SKIN.allowed_tools,
    triggers: CREATIVE_DIRECT_SKIN.triggers,
    handoff_slugs: CREATIVE_DIRECT_SKIN.handoff_slugs,
    is_active: true,
    created_by_agent: true,
  });
}

async function buildOpenPrompt(tenantId: string): Promise<string> {
  const skin = await loadCreativeSkinText(tenantId);
  const taste = await loadTasteLessons(tenantId);
  return [
    CREATIVE_DIRECT_IDENTITY,
    "STANDING SKILL — read once, keep forever: .cursor/skills/creative-direct/SKILL.md",
    "Also read .cursor/skills/create-premium-hebrew-ads/SKILL.md.",
    "Later messages are JOBS only. Do not ask to be re-briefed.",
    `CARMEN איש קריאייטיב SKIN (ai_skills.${CREATIVE_DIRECT_SKIN_SLUG}) — this evolves from rejects:\n${skin}`,
    taste && `TASTE MEMORY:\n${taste}`,
    "Reply that קריאייטיב דיירקט is open and waiting for jobs, then wait.",
  ].filter(Boolean).join("\n\n");
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
    let detail = raw.slice(0, 240);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
      const nested = typeof parsed.error === "object" ? parsed.error?.message : parsed.error;
      detail = String(nested || parsed.message || detail);
    } catch { /* keep */ }
    if (resp.status === 402 || resp.status === 429 || /credit|spend|on-demand|usage limit|insufficient|billing|quota/i.test(detail)) {
      throw new Error(
        `Cursor follow-up ${resp.status}: Cloud Agent spend/credits (not Pro+ desktop). Enable on-demand at cursor.com/dashboard/spending. ${detail.slice(0, 160)}`,
      );
    }
    throw new Error(`Cursor follow-up ${resp.status}: ${detail}`);
  }
  return { id: agentId, url: `https://cursor.com/agents/${agentId}` };
}

function parseCursorError(raw: string): string {
  let detail = raw.slice(0, 240);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    const nested = typeof parsed.error === "object" ? parsed.error?.message : parsed.error;
    detail = String(nested || parsed.message || detail);
  } catch { /* keep */ }
  return detail;
}

async function resolveLiveCreativeModel(apiKey: string) {
  const preferred = resolveCreativeCursorModel(Deno.env.get("CURSOR_CREATIVE_MODEL_ID"));
  try {
    const resp = await cursorFetch(apiKey, "https://api.cursor.com/v1/models", { method: "GET" });
    if (!resp.ok) return preferred;
    const data = await resp.json() as {
      items?: Array<{ id?: string; aliases?: string[]; parameters?: Array<{ id?: string; values?: Array<{ value?: string }> }> }>;
    };
    return pickCreativeModelFromCatalog(data.items, preferred);
  } catch {
    return preferred;
  }
}

async function createCreativeAgent(apiKey: string, promptText: string, name: string) {
  const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
  // Valid id is composer-2.5 + params.fast — not the alias composer-2.5-fast.
  // Do not inherit CURSOR_MODEL_ID from the coding agent.
  const model = await resolveLiveCreativeModel(apiKey);
  const body: Record<string, unknown> = {
    prompt: { text: promptText },
    autoCreatePR: false,
    name: name.slice(0, 100),
    model,
  };
  if (envName) body.env = { type: "cloud", name: envName };
  else {
    body.repos = [{ url: Deno.env.get("CURSOR_REPO_URL") || DEFAULT_REPO, startingRef: Deno.env.get("CURSOR_STARTING_REF") || "main" }];
  }

  const post = () => cursorFetch(apiKey, "https://api.cursor.com/v1/agents", {
    method: "POST",
    body: JSON.stringify(body),
  });

  let resp = await post();
  let raw = await resp.text();
  if (!resp.ok && resp.status === 400 && isInvalidCursorModelError(parseCursorError(raw))) {
    delete body.model;
    resp = await post();
    raw = await resp.text();
  }
  if (!resp.ok) {
    const detail = parseCursorError(raw);
    if (resp.status === 402 || resp.status === 429 || /credit|spend|on-demand|usage limit|insufficient|billing|quota/i.test(detail)) {
      throw new Error(
        `Cursor agent create ${resp.status}: Cloud Agent spend/credits (not Pro+ desktop). Enable on-demand at cursor.com/dashboard/spending. ${detail.slice(0, 160)}`,
      );
    }
    throw new Error(`Cursor agent create ${resp.status}: ${detail}`);
  }
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
  if (!tenantId) return json({ error: "tenant_id is required" }, 400);
  if (action !== "status" && action !== "ensure" && action !== "learn" && !itemId) {
    return json({ error: "tenant_id and item_id are required" }, 400);
  }

  try {
    if (action === "status" || action === "ensure") {
      const auth = await requireAuth(req);
      if (!auth) return json({ error: "unauthorized" }, 401);
      const apiKey = Deno.env.get("CURSOR_API_KEY") || "";
      if (!apiKey) return json({ error: "CURSOR_API_KEY is not configured" }, 500);
      const existing = await getCreativeSticky(tenantId);
      if (action === "status" || (action === "ensure" && existing)) {
        return json({
          ok: true,
          open: Boolean(existing),
          agent_url: existing?.url ?? "",
          cursor_agent_id: existing?.id ?? "",
          reused: Boolean(existing),
        });
      }
      const openPrompt = await buildOpenPrompt(tenantId);
      const fired = await createCreativeAgent(apiKey, openPrompt, CREATIVE_DIRECT_NAME);
      await sb().from("cursor_dispatches").insert({
        tenant_id: tenantId,
        tool: "ask_cursor",
        request_text: `${CREATIVE_DIRECT_OPEN_MARKER} chat`,
        context: "ensure",
        session_url: fired.url,
        cursor_agent_id: fired.id,
        status: "dispatched",
      });
      return json({
        ok: true,
        open: true,
        agent_url: fired.url,
        cursor_agent_id: fired.id,
        reused: false,
      });
    }

    if (action === "learn") {
      const auth = await requireAuth(req);
      if (!auth) return json({ error: "unauthorized" }, 401);
      const lesson = String(body.lesson ?? "").trim();
      if (!lesson) return json({ error: "lesson is required" }, 400);
      await rememberCreativeLesson(tenantId, itemId || "none", lesson);
      return json({ ok: true });
    }

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
          conceptId: variationMeta.concept_id ?? job.concept_id,
          conceptName: variationMeta.concept_name ?? job.concept_name,
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
          concept_id: variation.concept_id,
          concept_name: variation.concept_name,
          created_at: new Date().toISOString(),
        },
      ],
      department: "creative",
    }));

    const lesson = String(body.lesson ?? "").trim();
    if (lesson) await rememberCreativeLesson(tenantId, itemId, lesson);

    const callback = [
      `${CREATIVE_MARKER} job ${jobId}`,
      "You are already in the Creative Direct chat. This is one job.",
      "When the PNG is ready, POST it back. Do not open a PR. Do not edit the repo.",
      `POST ${SUPABASE_URL}/functions/v1/cursor-generate-creative`,
      "Content-Type: application/json",
      `Body JSON: {"action":"complete","tenant_id":"${tenantId}","item_id":"${itemId}","job_id":"${jobId}","job_token":"${jobToken}","image_base64":"<png-base64>","variation":{"id":"${variationId}","name":${JSON.stringify(String(variation.name || "וריאציה"))},"format":${JSON.stringify(String(variation.format || "1:1"))},"copy_key":${JSON.stringify(variation.copy_key ?? null)},"copy_label":${JSON.stringify(variation.copy_label ?? null)},"copy_text":${JSON.stringify(String(variation.copy_text || "").slice(0, 400))},"parent_id":${JSON.stringify(variation.parent_id ?? null)}}}`,
    ].join("\n");

    const taste = await loadTasteLessons(tenantId);
    const sticky = await getCreativeSticky(tenantId);
    let reused = false;
    const jobPrompt = [
      "JOB only. Follow standing skill (.cursor/skills/creative-direct and ai_skills.creative_direct). Do not ask to be re-briefed.",
      taste && `TASTE MEMORY:\n${taste}`,
      prompt,
      "--- WRITE BACK ---",
      callback,
    ].filter(Boolean).join("\n\n");
    let fired = sticky ? await followUp(apiKey, sticky.id, jobPrompt) : null;
    if (fired) reused = true;
    if (!fired) {
      const first = `${await buildOpenPrompt(tenantId)}\n\nThis message also contains the first job.\n\n${jobPrompt}`;
      fired = await createCreativeAgent(apiKey, first, CREATIVE_DIRECT_NAME);
    }
    const label = String(variation.copy_label || variation.name || itemId).slice(0, 180);

    await sb().from("cursor_dispatches").insert({
      tenant_id: tenantId,
      tool: "ask_cursor",
      request_text: reused
        ? `${CREATIVE_MARKER} ${label}`
        : `${CREATIVE_DIRECT_OPEN_MARKER} · ${label}`,
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
