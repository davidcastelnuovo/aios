import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mentionRateScore } from "../_shared/aiVisibilityEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chatgpt-worker-secret",
};

type IngestBody = {
  scan_id: string;
  event: "started" | "result" | "done" | "failed";
  error?: string;
  result?: {
    prompt_id: string;
    text: string;
    citations: string[];
    is_mentioned: boolean;
    position: number | null;
    sentiment: string | null;
    competitors: Array<{ name: string; is_mentioned: boolean; position: number | null }>;
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const expected = Deno.env.get("CHATGPT_WEB_WORKER_SECRET");
    const provided = req.headers.get("x-chatgpt-worker-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!expected || provided !== expected) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing environment variables");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json() as IngestBody;
    if (!body.scan_id || !body.event) throw new Error("Missing scan_id or event");

    const { data: job, error: jobError } = await supabase
      .from("ai_detection_jobs")
      .select("*")
      .eq("scan_id", body.scan_id)
      .maybeSingle();
    if (jobError || !job) throw new Error("Scan job not found");

    const now = new Date().toISOString();

    if (body.event === "started") {
      await supabase.from("ai_detection_jobs").update({ status: "running", updated_at: now }).eq("scan_id", body.scan_id);
      return json({ ok: true });
    }

    if (body.event === "failed") {
      await supabase.from("ai_detection_jobs").update({
        status: "failed",
        error: body.error || "worker failed",
        updated_at: now,
        finished_at: now,
      }).eq("scan_id", body.scan_id);
      return json({ ok: true });
    }

    if (body.event === "result") {
      const result = body.result;
      if (!result?.prompt_id) throw new Error("Missing result.prompt_id");
      const { error: insertError } = await supabase.from("ai_detection_results").insert({
        tenant_id: job.tenant_id,
        brand_id: job.brand_id,
        prompt_id: result.prompt_id,
        platform: "chatgpt",
        is_mentioned: result.is_mentioned,
        position: result.position,
        sentiment: result.sentiment,
        response_snippet: (result.text || "").slice(0, 4000),
        citations: result.citations ?? [],
        scan_id: body.scan_id,
        scanned_at: now,
      });
      if (insertError) throw insertError;

      for (const competitor of result.competitors ?? []) {
        await supabase.from("ai_detection_competitor_results").insert({
          tenant_id: job.tenant_id,
          brand_id: job.brand_id,
          competitor_name: competitor.name,
          prompt_id: result.prompt_id,
          platform: "chatgpt",
          is_mentioned: competitor.is_mentioned,
          position: competitor.position,
          scan_id: body.scan_id,
          scanned_at: now,
        });
      }

      const { data: latest } = await supabase
        .from("ai_detection_jobs")
        .select("completed_prompts, mentioned_prompts")
        .eq("scan_id", body.scan_id)
        .single();
      const completed = (latest?.completed_prompts || 0) + 1;
      const mentioned = (latest?.mentioned_prompts || 0) + (result.is_mentioned ? 1 : 0);
      await supabase.from("ai_detection_jobs").update({
        completed_prompts: completed,
        mentioned_prompts: mentioned,
        updated_at: now,
      }).eq("scan_id", body.scan_id);
      return json({ ok: true, completed });
    }

    if (body.event === "done") {
      const { data: latest } = await supabase.from("ai_detection_jobs").select("*").eq("scan_id", body.scan_id).single();
      const total = latest?.total_prompts || 0;
      const mentioned = latest?.mentioned_prompts || 0;
      const score = mentionRateScore(mentioned, total);
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      await supabase.from("ai_detection_scores").upsert({
        tenant_id: job.tenant_id,
        brand_id: job.brand_id,
        score,
        chatgpt_score: score,
        gemini_score: null,
        perplexity_score: null,
        total_prompts: total,
        mentioned_prompts: mentioned,
        week_start: weekStart.toISOString().split("T")[0],
      }, { onConflict: "brand_id,week_start", ignoreDuplicates: false });
      await supabase.from("ai_detection_jobs").update({
        status: "done",
        updated_at: now,
        finished_at: now,
      }).eq("scan_id", body.scan_id);
      return json({ ok: true, score });
    }

    throw new Error("Unknown event");
  } catch (error) {
    console.error("ai-detection-worker-ingest:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
