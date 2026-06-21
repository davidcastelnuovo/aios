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

// RTL: brief on the right (high x), measurement on the left (low x)
function buildDefaultStages(track: MarketingTrack): DefaultStage[] {
  const targetByTrack: Record<MarketingTrack, DefaultStage> = {
    campaigns: {
      stage_type: "target_paid",
      name: "קמפיין ממומן",
      position_x: 280,
      position_y: 200,
      sort_order: 3,
    },
    seo_geo: {
      stage_type: "target_seo",
      name: "SEO / GEO",
      position_x: 280,
      position_y: 200,
      sort_order: 3,
    },
    social_organic: {
      stage_type: "target_organic",
      name: "סושיאל אורגני",
      position_x: 280,
      position_y: 200,
      sort_order: 3,
    },
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
  const { data: existing } = await supabase
    .from("marketing_pipelines")
    .select("*")
    .eq("client_id", clientId)
    .eq("track", track)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("marketing_pipelines")
    .insert({ client_id: clientId, tenant_id: tenantId, track })
    .select("*")
    .single();
  if (error) throw error;

  await supabase.from("marketing_pipeline_stages").insert(
    buildDefaultStages(track).map((s) => ({
      pipeline_id: created.id,
      tenant_id: tenantId,
      ...s,
    })),
  );

  return created;
}
