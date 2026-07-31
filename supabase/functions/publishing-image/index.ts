import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  ENTITY_ATTACHMENTS_BUCKET,
  type MagazineImageKind,
  publishingImageStoragePath,
} from "../_shared/publishing-images.ts";

/**
 * Streams a generated PBN article image from the private storage bucket over a
 * stable public URL, so magazine pages and crawlers never depend on expiring links.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "GET" && request.method !== "HEAD") return fail("method_not_allowed", 405);

  const params = new URL(request.url).searchParams;
  const articleId = String(params.get("article_id") ?? "").trim();
  const kind = String(params.get("kind") ?? "hero").trim() as MagazineImageKind;
  if (!UUID_PATTERN.test(articleId)) return fail("article_id_invalid", 400);
  if (kind !== "hero" && kind !== "inline") return fail("kind_invalid", 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return fail("server_not_configured", 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: article, error: articleError } = await admin
    .from("publishing_articles")
    .select("id,tenant_id")
    .eq("id", articleId)
    .maybeSingle();
  if (articleError) return fail("article_lookup_failed", 500);
  if (!article) return fail("article_not_found", 404);

  const path = publishingImageStoragePath(article.tenant_id, article.id, kind);
  const { data: file, error: downloadError } = await admin.storage
    .from(ENTITY_ATTACHMENTS_BUCKET)
    .download(path);
  if (downloadError || !file) return fail("image_not_found", 404);

  const headers = {
    ...corsHeaders,
    "Content-Type": file.type || "image/webp",
    "Cache-Control": "public, max-age=3600, s-maxage=31536000, stale-while-revalidate=86400",
  };
  if (request.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(await file.arrayBuffer(), { status: 200, headers });
});
