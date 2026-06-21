import { supabase } from "@/integrations/supabase/client";

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

const DEFAULT_STAGES: DefaultStage[] = [
  { stage_type: "strategy", name: "אסטרטגיה", position_x: 0, position_y: 200, sort_order: 0 },
  { stage_type: "copy", name: "כתיבת תוכן", position_x: 280, position_y: 200, sort_order: 1 },
  { stage_type: "creative", name: "קריאייטיב", position_x: 560, position_y: 200, sort_order: 2 },
  { stage_type: "target_paid", name: "קמפיין ממומן", position_x: 880, position_y: 60, sort_order: 3 },
  { stage_type: "target_seo", name: "SEO / GEO", position_x: 880, position_y: 200, sort_order: 4 },
  { stage_type: "target_organic", name: "סושיאל אורגני", position_x: 880, position_y: 340, sort_order: 5 },
  { stage_type: "measurement", name: "מדידה", position_x: 1180, position_y: 200, sort_order: 6 },
];

export async function ensurePipelineForClient({
  clientId,
  tenantId,
}: {
  clientId: string;
  tenantId: string;
}) {
  const { data: existing } = await supabase
    .from("marketing_pipelines")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("marketing_pipelines")
    .insert({ client_id: clientId, tenant_id: tenantId })
    .select("*")
    .single();
  if (error) throw error;

  // Seed default stages
  await supabase.from("marketing_pipeline_stages").insert(
    DEFAULT_STAGES.map((s) => ({
      pipeline_id: created.id,
      tenant_id: tenantId,
      ...s,
    })),
  );

  return created;
}
