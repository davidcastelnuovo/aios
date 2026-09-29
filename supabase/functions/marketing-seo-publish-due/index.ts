import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { loadWordPressSite, publishToWordPress } from "../_shared/seo-geo-wordpress.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const headerSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && headerSecret === cronSecret;
    if (!isCron) {
      const auth = await requireAuth(req);
      if (!auth) return respond({ error: "Unauthorized" }, 401);
    }

    const { entry_id, work_item_id, dry_run = false } = await req.json().catch(() => ({}));
    const today = new Date().toISOString().slice(0, 10);

    let query = admin.from("seo_geo_calendar_entries").select("*");
    if (entry_id) query = query.eq("id", entry_id);
    else if (work_item_id) query = query.eq("work_item_id", work_item_id).lte("scheduled_date", today);
    else query = query.lte("scheduled_date", today);

    const { data: entries } = await query
      .in("approval_status", ["approved", "auto_approved"])
      .in("generation_status", ["draft"])
      .limit(20);

    const results: Array<{ id: string; ok: boolean; error?: string; link?: string }> = [];

    for (const entry of entries ?? []) {
      if (!entry.content_html?.trim()) {
        results.push({ id: entry.id, ok: false, error: "missing content" });
        continue;
      }
      const { data: program } = await admin.from("seo_geo_programs").select("wordpress_site_id").eq("work_item_id", entry.work_item_id).maybeSingle();
      if (!program?.wordpress_site_id) {
        results.push({ id: entry.id, ok: false, error: "no wordpress site on program" });
        continue;
      }
      if (dry_run) {
        results.push({ id: entry.id, ok: true });
        continue;
      }
      try {
        const site = await loadWordPressSite(admin, program.wordpress_site_id);
        if (!site) throw new Error("WordPress site not found");
        const post = await publishToWordPress(site, {
          title: entry.title_draft || entry.title,
          contentHtml: entry.content_html,
          excerpt: entry.excerpt,
          metaDescription: entry.meta_description,
          focusKeyword: entry.primary_keyword,
          status: "publish",
        });
        await admin.from("seo_geo_calendar_entries").update({
          generation_status: "published",
          live_url: post.link,
          wordpress_post_id: String(post.id),
          published_at: new Date().toISOString(),
          publish_error: null,
        }).eq("id", entry.id);
        results.push({ id: entry.id, ok: true, link: post.link });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await admin.from("seo_geo_calendar_entries").update({ generation_status: "failed", publish_error: msg }).eq("id", entry.id);
        results.push({ id: entry.id, ok: false, error: msg });
      }
    }

    return respond({ published: results.filter((r) => r.ok).length, results });
  } catch (error) {
    console.error("marketing-seo-publish-due", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
