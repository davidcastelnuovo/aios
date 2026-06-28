import { supabase } from "@/integrations/supabase/client";

export type MarketingTrack = "campaigns" | "seo_geo" | "social_organic";

export const TRACK_LABELS: Record<MarketingTrack, string> = {
  campaigns: "קמפיינים",
  seo_geo: "SEO / GEO",
  social_organic: "סושיאל אורגני",
};

interface DefaultStage {
  stage_type:
    | "strategy"
    | "copy"
    | "creative"
    | "target_paid"
    | "target_seo"
    | "target_organic"
    | "measurement";
  name: string;
  position_x: number;
  position_y: number;
  sort_order: number;
}

function buildDefaultStages(track: MarketingTrack): DefaultStage[] {
  const targetByTrack: Record<MarketingTrack, DefaultStage> = {
    campaigns: { stage_type: "target_paid", name: "קמפיין ממומן", position_x: 280, position_y: 200, sort_order: 3 },
    seo_geo: { stage_type: "target_seo", name: "SEO / GEO", position_x: 280, position_y: 200, sort_order: 3 },
    social_organic: { stage_type: "target_organic", name: "סושיאל אורגני", position_x: 280, position_y: 200, sort_order: 3 },
  };
  return [
    { stage_type: "strategy", name: "בריף", position_x: 1120, position_y: 200, sort_order: 0 },
    { stage_type: "copy", name: "כתיבת תוכן", position_x: 840, position_y: 200, sort_order: 1 },
    { stage_type: "creative", name: "קריאייטיב", position_x: 560, position_y: 200, sort_order: 2 },
    targetByTrack[track],
    { stage_type: "measurement", name: "מדידה", position_x: 0, position_y: 200, sort_order: 4 },
  ];
}

export async function ensurePipelineForClient({
  clientId,
  tenantId,
  track,
}: {
  clientId: string;
  tenantId: string;
  track: MarketingTrack;
}) {
  // First try to find existing pipeline
  const { data: existing, error: selectError } = await supabase
    .from("marketing_pipelines")
    .select("*")
    .eq("client_id", clientId)
    .eq("track", track)
    .maybeSingle();

  if (existing) {
    // Check if stages exist — if not, seed them (handles legacy pipelines created before stage seeding)
    const { count } = await supabase
      .from("marketing_pipeline_stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", existing.id);

    if ((count ?? 0) === 0) {
      const { data: templates } = await supabase
        .from("marketing_stage_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("track", track);

      const tplByStageType: Record<string, any> = {};
      (templates ?? []).forEach((t: any) => { tplByStageType[t.stage_type] = t; });

      await supabase.from("marketing_pipeline_stages").insert(
        buildDefaultStages(track).map((s) => {
          const tpl = tplByStageType[s.stage_type];
          return {
            pipeline_id: existing.id,
            tenant_id: tenantId,
            ...s,
            name: tpl?.name ?? s.name,
            agent_id: tpl?.default_agent_id ?? null,
            approval_mode: tpl?.default_approval_mode ?? "manual",
            configuration: {
              instructions: tpl?.default_instructions ?? "",
              tools: tpl?.default_tools ?? [],
              target: tpl?.default_target ?? {},
            },
          };
        }),
      );
    }
    return existing;
  }

  // If select failed (e.g. RLS timing), try upsert approach
  const { data: created, error } = await supabase
    .from("marketing_pipelines")
    .insert({ client_id: clientId, tenant_id: tenantId, track })
    .select("*")
    .single();

  // If insert failed (e.g. duplicate), try fetching again
  if (error) {
    const { data: retry } = await supabase
      .from("marketing_pipelines")
      .select("*")
      .eq("client_id", clientId)
      .eq("track", track)
      .maybeSingle();
    if (retry) return retry;
    console.error("ensurePipeline error:", error);
    return null;
  }

  // Load tenant-level templates for this track
  const { data: templates } = await supabase
    .from("marketing_stage_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("track", track);

  const tplByStageType: Record<string, any> = {};
  (templates ?? []).forEach((t: any) => {
    tplByStageType[t.stage_type] = t;
  });

  await supabase.from("marketing_pipeline_stages").insert(
    buildDefaultStages(track).map((s) => {
      const tpl = tplByStageType[s.stage_type];
      return {
        pipeline_id: created.id,
        tenant_id: tenantId,
        ...s,
        name: tpl?.name ?? s.name,
        agent_id: tpl?.default_agent_id ?? null,
        approval_mode: tpl?.default_approval_mode ?? "manual",
        configuration: {
          instructions: tpl?.default_instructions ?? "",
          tools: tpl?.default_tools ?? [],
          target: tpl?.default_target ?? {},
        },
      };
    }),
  );

  return created;
}
