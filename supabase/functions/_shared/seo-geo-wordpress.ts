import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type WpSite = {
  id: string;
  site_url: string;
  username: string;
  app_password: string;
};

export async function loadWordPressSite(admin: SupabaseClient, siteId: string): Promise<WpSite | null> {
  const { data } = await admin
    .from("social_media_wordpress_sites")
    .select("id,site_url,username,app_password")
    .eq("id", siteId)
    .maybeSingle();
  return (data as WpSite | null) ?? null;
}

export async function publishToWordPress(site: WpSite, article: {
  title: string;
  contentHtml: string;
  excerpt?: string | null;
  metaDescription?: string | null;
  focusKeyword?: string | null;
  status?: "draft" | "publish";
}) {
  const credentials = btoa(`${site.username}:${site.app_password}`);
  const wpUrl = `${site.site_url.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
  const body: Record<string, unknown> = {
    title: article.title,
    content: article.contentHtml,
    status: article.status ?? "publish",
  };
  if (article.excerpt) body.excerpt = article.excerpt;
  if (article.metaDescription || article.focusKeyword) {
    body.meta = {
      ...(article.metaDescription ? { _yoast_wpseo_metadesc: article.metaDescription } : {}),
      ...(article.focusKeyword ? { _yoast_wpseo_focuskw: article.focusKeyword } : {}),
    };
  }
  const res = await fetch(wpUrl, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`WordPress ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return await res.json() as { id: number; link: string };
}
