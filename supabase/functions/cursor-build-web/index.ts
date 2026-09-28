import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { requireAuth } from "../_shared/security.ts";
import {
  cursorApiKey,
  cursorFetch,
  followUpCloudAgent,
  parseAgentResponse,
} from "../_shared/agent-channel/cursor-api.ts";
import { webDesignPublicUrl } from "../_shared/webDesignPublicUrl.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "web-design-sites";
const MARKER = "[WEB BUILD AGENT]";
const AGENT_NAME = "AIOS Web Landing Builder";

const sb = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type ProjectRow = {
  id: string;
  tenant_id: string;
  client_id: string | null;
  slug: string;
  title: string;
  kind: string;
  status: string;
  reference_url: string | null;
  copy_snapshot: string | null;
  intake_notes: string | null;
  reference_image_paths: string[] | null;
  build_token: string | null;
  build_version: number;
  cursor_agent_id: string | null;
  preview_token: string | null;
};

async function loadProject(projectId: string, tenantId: string): Promise<ProjectRow | null> {
  const { data } = await sb()
    .from("web_design_projects")
    .select(
      "id,tenant_id,client_id,slug,title,kind,status,reference_url,copy_snapshot,intake_notes,reference_image_paths,build_token,build_version,cursor_agent_id,preview_token",
    )
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return data as ProjectRow | null;
}

async function tenantSlug(tenantId: string): Promise<string> {
  const { data } = await sb().from("tenants").select("slug").eq("id", tenantId).maybeSingle();
  return String(data?.slug || tenantId);
}

async function signedRefUrls(tenantId: string, paths: string[]): Promise<string[]> {
  const admin = sb();
  const out: string[] = [];
  for (const path of paths.slice(0, 12)) {
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}

function buildJobPrompt(project: ProjectRow, tenantSlugValue: string, refUrls: string[], buildToken: string, version: number) {
  const callback = [
    `${MARKER} project ${project.id} build v${version}`,
    "When the landing page is ready, POST the static site back. Do NOT open a PR. Do NOT edit the main AIOS CRM repository.",
    `POST ${SUPABASE_URL}/functions/v1/cursor-build-web`,
    "Content-Type: application/json",
    `Body JSON shape: {"action":"complete","tenant_id":"${project.tenant_id}","project_id":"${project.id}","build_token":"${buildToken}","files":[{"path":"index.html","content_base64":"<base64>"},{"path":"assets/style.css","content_base64":"..."}]}`,
    "Include at least index.html. Use relative asset paths. RTL Hebrew landing page, mobile-first, accessible.",
  ].join("\n");

  return [
    "JOB: Build a single Hebrew RTL landing page (static HTML + CSS; optional JS).",
    `Project: ${project.title} (${project.kind})`,
    `Tenant slug: ${tenantSlugValue} · project slug: ${project.slug}`,
    project.reference_url ? `Reference URL (structure/mood only, do not clone): ${project.reference_url}` : "",
    project.copy_snapshot ? `COPY (use exactly unless marked as draft):\n${project.copy_snapshot.slice(0, 12000)}` : "",
    project.intake_notes ? `Notes:\n${project.intake_notes.slice(0, 4000)}` : "",
    refUrls.length ? `Reference images:\n${refUrls.join("\n")}` : "",
    "--- WRITE BACK ---",
    callback,
  ].filter(Boolean).join("\n\n");
}

async function openAgentPrompt(): Promise<string> {
  return [
    `You are ${AGENT_NAME}.`,
    "You build static landing pages for AIOS marketing clients.",
    "Each follow-up is one job. Output files via the complete webhook in the job instructions.",
    "Do not edit the AIOS monorepo. Do not create pull requests.",
    "Reply that the web landing builder is ready for jobs, then wait.",
  ].join("\n");
}

async function dispatchBuild(project: ProjectRow) {
  const apiKey = cursorApiKey();
  if (!apiKey) throw new Error("CURSOR_API_KEY is not configured");

  const buildToken = project.build_token || crypto.randomUUID().replaceAll("-", "");
  const version = (project.build_version || 0) + 1;
  const previewToken = project.preview_token || crypto.randomUUID().replaceAll("-", "");

  await sb()
    .from("web_design_projects")
    .update({
      status: "building",
      build_token: buildToken,
      build_version: version,
      preview_token: previewToken,
      last_build_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id)
    .eq("tenant_id", project.tenant_id);

  const slug = await tenantSlug(project.tenant_id);
  const refUrls = await signedRefUrls(project.tenant_id, project.reference_image_paths || []);
  const jobPrompt = buildJobPrompt(
    { ...project, build_token: buildToken, build_version: version },
    slug,
    refUrls,
    buildToken,
    version,
  );

  let agentId = project.cursor_agent_id || "";
  let sessionUrl = "";
  let reused = false;

  if (agentId.startsWith("bc-")) {
    const follow = await followUpCloudAgent(apiKey, agentId, jobPrompt);
    if (follow.kind === "ok" || follow.kind === "busy") {
      sessionUrl = follow.url;
      reused = follow.kind === "ok";
    } else {
      agentId = "";
    }
  }

  if (!agentId.startsWith("bc-")) {
    const first = `${await openAgentPrompt()}\n\nFirst job:\n\n${jobPrompt}`;
    const envName = Deno.env.get("CURSOR_CLOUD_ENV_NAME") || "";
    const createBody: Record<string, unknown> = {
      prompt: { text: first },
      autoCreatePR: false,
      name: AGENT_NAME.slice(0, 100),
    };
    if (envName) createBody.env = { type: "cloud", name: envName };
    else {
      createBody.repos = [{
        url: Deno.env.get("CURSOR_REPO_URL") || "https://github.com/davidcastelnuovo/aios",
        startingRef: Deno.env.get("CURSOR_STARTING_REF") || "main",
      }];
    }
    const resp = await cursorFetch(apiKey, "https://api.cursor.com/v1/agents", {
      method: "POST",
      body: JSON.stringify(createBody),
    });
    const raw = await resp.text();
    if (!resp.ok) throw new Error(`Cursor agent create ${resp.status}: ${raw.slice(0, 240)}`);
    const parsed = parseAgentResponse(raw);
    agentId = parsed.id;
    sessionUrl = parsed.url;
  }

  await sb().from("cursor_dispatches").insert({
    tenant_id: project.tenant_id,
    tool: "ask_cursor",
    request_text: `${MARKER} ${project.title}`.slice(0, 200),
    context: `web_design_project_id=${project.id} v=${version}`,
    session_url: sessionUrl,
    cursor_agent_id: agentId,
    status: "dispatched",
  });

  await sb()
    .from("web_design_projects")
    .update({
      cursor_agent_id: agentId,
      cursor_session_url: sessionUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", project.id);

  return { agent_url: sessionUrl, cursor_agent_id: agentId, build_version: version, reused };
}

async function handleComplete(body: Record<string, unknown>) {
  const tenantId = String(body.tenant_id || "");
  const projectId = String(body.project_id || "");
  const token = String(body.build_token || "");
  const files = Array.isArray(body.files) ? body.files : [];
  if (!tenantId || !projectId || !token || files.length === 0) {
    return json({ error: "tenant_id, project_id, build_token, files required" }, 400);
  }

  const project = await loadProject(projectId, tenantId);
  if (!project || project.build_token !== token) {
    return json({ error: "invalid build token" }, 403);
  }

  const version = project.build_version || 1;
  const prefix = `${tenantId}/${projectId}/v${version}`;
  const admin = sb();

  for (const entry of files) {
    if (!entry || typeof entry !== "object") continue;
    const path = String((entry as { path?: string }).path || "").replace(/^\/+/, "");
    const b64 = String((entry as { content_base64?: string }).content_base64 || "");
    if (!path || !b64 || path.includes("..")) continue;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const { error } = await admin.storage.from(BUCKET).upload(`${prefix}/${path}`, bytes, {
      upsert: true,
      contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html",
    });
    if (error) throw error;
  }

  const slug = await tenantSlug(tenantId);
  const publicUrl = webDesignPublicUrl(slug, project.slug);

  await admin
    .from("web_design_projects")
    .update({
      status: "preview",
      storage_prefix: prefix,
      public_url: publicUrl || null,
      last_build_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  return json({ ok: true, storage_prefix: prefix, preview_status: "preview", public_url: publicUrl });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || "build");

    if (action === "complete") {
      return await handleComplete(body as Record<string, unknown>);
    }

    if (action === "publish") {
      const auth = await requireAuth(req);
      if (!auth) return json({ error: "unauthorized" }, 401);
      const projectId = String(body.project_id || "");
      const tenantId = String(body.tenant_id || "");
      const project = await loadProject(projectId, tenantId);
      if (!project) return json({ error: "project not found" }, 404);
      if (project.status !== "preview" && project.status !== "published") {
        return json({ error: "publish only after preview build" }, 400);
      }
      const slug = await tenantSlug(tenantId);
      const publicUrl = webDesignPublicUrl(slug, project.slug);
      await sb()
        .from("web_design_projects")
        .update({
          status: "published",
          public_url: publicUrl || project.public_url,
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      return json({ ok: true, public_url: publicUrl });
    }

    const auth = await requireAuth(req);
    if (!auth) return json({ error: "unauthorized" }, 401);
    const projectId = String(body.project_id || "");
    const tenantId = String(body.tenant_id || "");
    if (!projectId || !tenantId) return json({ error: "project_id and tenant_id required" }, 400);

    const project = await loadProject(projectId, tenantId);
    if (!project) return json({ error: "project not found" }, 404);

    const result = await dispatchBuild(project);
    return json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cursor-build-web]", message);
    return json({ error: message }, 500);
  }
});
