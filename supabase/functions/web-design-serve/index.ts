import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const BUCKET = "web-design-sites";

const sb = () => createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

const contentType = (path: string) => {
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "text/html; charset=utf-8";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get("tenant_slug") || url.searchParams.get("tenant") || "";
    const projectSlug = url.searchParams.get("project_slug") || url.searchParams.get("project") || "";
    let file = url.searchParams.get("file") || "index.html";
    if (file.includes("..")) return new Response("Not found", { status: 404, headers: corsHeaders });
    const previewToken = url.searchParams.get("preview_token") || "";

    if (!tenantSlug || !projectSlug) {
      return new Response("tenant_slug and project_slug required", { status: 400, headers: corsHeaders });
    }

    const { data: tenant } = await sb().from("tenants").select("id").eq("slug", tenantSlug).maybeSingle();
    if (!tenant?.id) return new Response("Not found", { status: 404, headers: corsHeaders });

    const { data: project } = await sb()
      .from("web_design_projects")
      .select("id,status,storage_prefix,preview_token")
      .eq("tenant_id", tenant.id)
      .eq("slug", projectSlug)
      .maybeSingle();

    if (!project?.storage_prefix) return new Response("Not found", { status: 404, headers: corsHeaders });

    const allowed =
      project.status === "published" ||
      (project.status === "preview" && previewToken && previewToken === project.preview_token);
    if (!allowed) return new Response("Not found", { status: 404, headers: corsHeaders });

    const objectPath = `${project.storage_prefix}/${file}`;
    const { data, error } = await sb().storage.from(BUCKET).download(objectPath);
    if (error || !data) return new Response("Not found", { status: 404, headers: corsHeaders });

    const bytes = new Uint8Array(await data.arrayBuffer());
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType(file),
        "Cache-Control": project.status === "published" ? "public, max-age=120" : "no-store",
      },
    });
  } catch (error) {
    console.error("[web-design-serve]", error);
    return new Response("Error", { status: 500, headers: corsHeaders });
  }
});
