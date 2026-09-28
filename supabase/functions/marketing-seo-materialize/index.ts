import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/security.ts";
import { materializeSeoGeoPlan, syncTrackedKeywords } from "../_shared/seo-geo-materialize.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const auth = await requireAuth(req);
    if (!auth) return respond({ error: "Unauthorized" }, 401);
    const { work_item_id, replace_existing = true, sync_tracked = true } = await req.json();
    if (!work_item_id) return respond({ error: "work_item_id required" }, 400);

    const { data: item } = await admin.from("marketing_work_items").select("*").eq("id", work_item_id).single();
    if (!item?.client_id) return respond({ error: "Work item needs a client" }, 400);
    if (auth.kind === "user") {
      const { data: membership } = await admin.from("tenant_users").select("user_id").eq("tenant_id", item.tenant_id).eq("user_id", auth.userId).maybeSingle();
      if (!membership) return respond({ error: "Forbidden" }, 403);
    }

    const payload = (item.payload ?? {}) as Record<string, unknown>;
    const plan = payload.seo_plan;
    if (!plan || typeof plan !== "object") return respond({ error: "No seo_plan on work item" }, 400);

    const { data: programRow } = await admin.from("seo_geo_programs").select("*").eq("work_item_id", work_item_id).maybeSingle();
    let program = programRow;
    if (!program) {
      const { data: created, error } = await admin.from("seo_geo_programs").insert({
        tenant_id: item.tenant_id,
        client_id: item.client_id,
        work_item_id: work_item_id,
        auto_approve: false,
        horizon_months: Number(payload.seo_horizon_months) || 3,
      }).select("*").single();
      if (error) throw error;
      program = created;
    }

    const stats = await materializeSeoGeoPlan(admin, {
      workItemId: work_item_id,
      tenantId: item.tenant_id,
      clientId: item.client_id,
      plan: plan as { clusters?: unknown[]; contentPlan?: unknown[] },
      autoApprove: !!program.auto_approve,
      horizonMonths: program.horizon_months ?? 3,
      replaceExisting: !!replace_existing,
    });

    let tracked = 0;
    if (sync_tracked) {
      tracked = await syncTrackedKeywords(admin, {
        workItemId: work_item_id,
        tenantId: item.tenant_id,
        clientId: item.client_id,
      });
    }

    return respond({ ...stats, tracked_keywords_synced: tracked });
  } catch (error) {
    console.error("marketing-seo-materialize", error);
    return respond({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
