import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { item_id } = await req.json();
    if (!item_id) {
      return new Response(JSON.stringify({ error: "item_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const supaService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supaUrl, supaService);

    const { data: item } = await admin
      .from("marketing_work_items")
      .select("*")
      .eq("id", item_id)
      .single();
    if (!item) throw new Error("Item not found");

    const { data: stages } = await admin
      .from("marketing_pipeline_stages")
      .select("id, sort_order, approval_mode")
      .eq("pipeline_id", item.pipeline_id)
      .order("sort_order", { ascending: true });

    const results: any[] = [];
    const auth = req.headers.get("Authorization");

    for (const s of stages ?? []) {
      const r = await fetch(`${supaUrl}/functions/v1/marketing-run-stage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(auth ? { Authorization: auth } : { Authorization: `Bearer ${supaService}` }),
          apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({ item_id, stage_id: s.id }),
      });
      const json = await r.json();
      results.push({ stage_id: s.id, ...json });

      if (!r.ok || json.error || json.status === "failed") {
        // Stage failed — do NOT advance current_stage_id, stop pipeline
        console.error(`[run-pipeline] Stage ${s.id} failed:`, json.error ?? json.status);
        return new Response(
          JSON.stringify({
            results,
            stopped_at: s.id,
            error: json.error ?? "Stage failed",
          }),
          {
            status: 422,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Advance current_stage_id only after successful run
      await admin
        .from("marketing_work_items")
        .update({ current_stage_id: s.id, status: "in_progress" })
        .eq("id", item_id);

      // Stop if stage needs approval — user must approve manually
      if (json.status === "awaiting_approval") {
        return new Response(
          JSON.stringify({
            results,
            stopped_at: s.id,
            awaiting_approval: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // All stages completed
    await admin
      .from("marketing_work_items")
      .update({ status: "completed" })
      .eq("id", item_id);

    return new Response(JSON.stringify({ results, completed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[run-pipeline] error:", e);
    return new Response(JSON.stringify({ error: String(e.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
