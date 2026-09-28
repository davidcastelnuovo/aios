import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function gatherSeoClientContext(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string,
) {
  const [
    { data: client },
    { data: wpSites },
    { data: priorBriefs },
    { data: reports },
    { data: projects },
    { data: chats },
    { data: recordings },
  ] = await Promise.all([
    admin.from("clients").select("name,website,business_description,industry,ahrefs_domain,services,gsc_site_url,ga_property_id").eq("id", clientId).maybeSingle(),
    admin.from("social_media_wordpress_sites").select("id,site_url,site_name,is_active").eq("tenant_id", tenantId).eq("client_id", clientId),
    admin.from("marketing_work_items").select("id,title,payload,updated_at").eq("tenant_id", tenantId).eq("client_id", clientId).order("updated_at", { ascending: false }).limit(8),
    admin.from("ahrefs_reports").select("report_type,report_date").eq("tenant_id", tenantId).eq("client_id", clientId).order("report_date", { ascending: false }).limit(6),
    admin.from("rank_tracking_projects").select("id,domain").eq("tenant_id", tenantId).eq("client_id", clientId).eq("is_active", true),
    admin.from("chat_messages").select("direction,message,created_at,provider,sender_name").eq("tenant_id", tenantId).eq("client_id", clientId).order("created_at", { ascending: false }).limit(40),
    admin.from("zoom_recordings").select("meeting_topic,summary_md,transcription,start_time").eq("tenant_id", tenantId).eq("client_id", clientId).order("start_time", { ascending: false }).limit(5),
  ]);

  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: trackedKeywords } = projectIds.length
    ? await admin.from("rank_tracking_keywords").select("keyword,current_position,search_volume").in("project_id", projectIds).eq("is_active", true).limit(80)
    : { data: [] };

  const briefCandidates = (priorBriefs ?? [])
    .map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const text = String(payload.brief_text ?? payload.brief ?? "").trim();
      if (!text) return null;
      return { id: row.id, title: row.title, department: payload.department, excerpt: text.slice(0, 500), updated_at: row.updated_at };
    })
    .filter(Boolean);

  const manusChats = (chats ?? []).filter((m) => m.provider === "manus_wa").slice(0, 20);
  const crmChats = (chats ?? []).filter((m) => m.provider !== "manus_wa").slice(0, 15);

  return {
    client,
    wordpress_sites: wpSites ?? [],
    prior_briefs: briefCandidates,
    ahrefs_report_count: reports?.length ?? 0,
    ahrefs_reports: (reports ?? []).map((r) => ({ type: r.report_type, date: r.report_date })),
    tracked_keywords: trackedKeywords ?? [],
    rank_domains: (projects ?? []).map((p) => p.domain),
    communications: {
      manus_wa_messages: manusChats.map((m) => ({
        direction: m.direction,
        from: m.sender_name,
        text: String(m.message ?? "").slice(0, 400),
        at: m.created_at,
      })),
      other_messages: crmChats.map((m) => ({
        provider: m.provider,
        direction: m.direction,
        text: String(m.message ?? "").slice(0, 300),
        at: m.created_at,
      })),
    },
    meetings: (recordings ?? []).map((r) => ({
      topic: r.meeting_topic,
      summary: String(r.summary_md ?? r.transcription ?? "").slice(0, 1200),
      at: r.start_time,
    })),
  };
}

export async function fetchPublicWebsiteSnippet(url: string): Promise<string | null> {
  try {
    const normalized = url.match(/^https?:\/\//i) ? url : `https://${url}`;
    const res = await fetch(normalized, {
      headers: { "User-Agent": "AIOS-SEO-Intake/1.0", Accept: "text/html,text/plain" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 4500) || null;
  } catch {
    return null;
  }
}
