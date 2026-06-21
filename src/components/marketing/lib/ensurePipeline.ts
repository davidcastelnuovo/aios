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

// RTL layout — strategy starts on the right, flows toward measurement on the left
const DEFAULT_STAGES: DefaultStage[] = [
  { stage_type: "strategy", name: "אסטרטגיה", position_x: 1180, position_y: 200, sort_order: 0 },
  { stage_type: "copy", name: "כתיבת תוכן", position_x: 900, position_y: 200, sort_order: 1 },
  { stage_type: "creative", name: "קריאייטיב", position_x: 620, position_y: 200, sort_order: 2 },
  { stage_type: "target_paid", name: "קמפיין ממומן", position_x: 320, position_y: 60, sort_order: 3 },
  { stage_type: "target_seo", name: "SEO / GEO", position_x: 320, position_y: 200, sort_order: 4 },
  { stage_type: "target_organic", name: "סושיאל אורגני", position_x: 320, position_y: 340, sort_order: 5 },
  { stage_type: "measurement", name: "מדידה", position_x: 0, position_y: 200, sort_order: 6 },
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

  if (existing) {
    // One-shot RTL realignment for legacy pipelines: ensure stage positions match the RTL defaults.
    const { data: stages } = await supabase
      .from("marketing_pipeline_stages")
      .select("id, stage_type, position_x, position_y")
      .eq("pipeline_id", existing.id);
    const needsFix = (stages ?? []).some((s: any) => {
      const def = DEFAULT_STAGES.find((d) => d.stage_type === s.stage_type);
      return def && (s.position_x !== def.position_x || s.position_y !== def.position_y);
    });
    if (needsFix) {
      await Promise.all(
        (stages ?? []).map((s: any) => {
          const def = DEFAULT_STAGES.find((d) => d.stage_type === s.stage_type);
          if (!def) return Promise.resolve();
          return supabase
            .from("marketing_pipeline_stages")
            .update({ position_x: def.position_x, position_y: def.position_y })
            .eq("id", s.id);
        }),
      );
    }
    return existing;
  }

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
