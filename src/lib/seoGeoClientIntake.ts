import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edgeFunctionInvoke";

export const SEO_INTAKE_MANUAL_QUESTIONS = [
  "מי הלקוח / מה העסק?",
  "מי קהל היעד (הלקוחות של הלקוח)?",
  "מי המתחרים העיקריים?",
  "מה המטרות השיווקיות וה-SEO?",
  "דגשים, אזורים, מגבלות או מה אסור להמציא?",
] as const;

export type SeoPriorBrief = {
  id: string;
  title: string | null;
  excerpt: string;
  updated_at: string;
};

export type SeoIntakePreview = {
  website: string | null;
  wordpressSites: Array<{
    id: string;
    site_url: string;
    site_name: string | null;
    is_active: boolean | null;
  }>;
  priorBriefs: SeoPriorBrief[];
  ahrefsReportCount: number;
  trackedKeywordCount: number;
  rankDomains: string[];
};

export async function fetchSeoIntakePreview(
  tenantId: string,
  clientId: string,
): Promise<SeoIntakePreview> {
  const [
    { data: client },
    { data: wpSites },
    { data: items },
    { count: ahrefsReportCount },
    { data: projects },
  ] = await Promise.all([
    supabase.from("clients").select("website").eq("id", clientId).maybeSingle(),
    supabase
      .from("social_media_wordpress_sites")
      .select("id,site_url,site_name,is_active")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId),
    supabase
      .from("marketing_work_items")
      .select("id,title,payload,updated_at")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(12),
    supabase
      .from("ahrefs_reports")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId),
    supabase
      .from("rank_tracking_projects")
      .select("id,domain")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("is_active", true),
  ]);

  const projectIds = (projects ?? []).map((p) => p.id);
  const { count: keywordCount } = projectIds.length
    ? await supabase
        .from("rank_tracking_keywords")
        .select("id", { count: "exact", head: true })
        .in("project_id", projectIds)
        .eq("is_active", true)
    : { count: 0 };

  const priorBriefs: SeoPriorBrief[] = (items ?? [])
    .map((row) => {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      const text = String(payload.brief_text ?? payload.brief ?? "").trim();
      if (!text) return null;
      return {
        id: row.id,
        title: row.title,
        excerpt: text.slice(0, 280),
        updated_at: row.updated_at,
      };
    })
    .filter(Boolean) as SeoPriorBrief[];

  return {
    website: client?.website?.trim() || null,
    wordpressSites: wpSites ?? [],
    priorBriefs,
    ahrefsReportCount: ahrefsReportCount ?? 0,
    trackedKeywordCount: keywordCount ?? 0,
    rankDomains: (projects ?? []).map((p) => p.domain).filter(Boolean),
  };
}

export type SeoIntakeMode = "carmen_full" | "manual_five" | "existing_brief";

export async function runSeoProjectIntake(body: {
  work_item_id: string;
  mode: SeoIntakeMode;
  website_override?: string;
  manual_answers?: Record<string, string>;
  selected_brief_id?: string;
  run_research?: boolean;
  user_prompt?: string;
}) {
  return invokeEdgeFunction<{
    ok: boolean;
    brief_length: number;
    website: string;
    wordpress_site_id: string | null;
    plan?: unknown;
  }>("marketing-seo-intake", body);
}
