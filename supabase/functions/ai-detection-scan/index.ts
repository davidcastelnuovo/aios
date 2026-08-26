import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logAiUsage } from "../_shared/ai.ts";
import {
  ISRAEL_USER,
  askChatGPTAsUser,
  brandIsMentioned,
  listPosition,
  mentionRateScore,
} from "../_shared/aiVisibilityEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScanRequest {
  brand_id: string;
  tenant_id: string;
  prompt_ids?: string[];
}

interface PromptRow {
  id: string;
  prompt: string;
  category: string;
}

interface BrandRow {
  id: string;
  brand_name: string;
  keywords: string[];
  competitor_names: string[];
  tenant_id: string;
}

const AI_GATEWAY_URL = "https://api.openai.com/v1/chat/completions";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const WORKER_URL = Deno.env.get("CHATGPT_WEB_WORKER_URL");
    const WORKER_SECRET = Deno.env.get("CHATGPT_WEB_WORKER_SECRET");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing environment variables");
    }
    if (!WORKER_URL && !OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY (and no ChatGPT web worker configured)");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const { brand_id, tenant_id, prompt_ids } = await req.json() as ScanRequest;
    if (!brand_id || !tenant_id) throw new Error("Missing brand_id or tenant_id");

    const { data: brand, error: brandError } = await supabase
      .from("ai_detection_brands")
      .select("*")
      .eq("id", brand_id)
      .eq("tenant_id", tenant_id)
      .single();
    if (brandError || !brand) throw new Error("Brand not found");
    const brandData = brand as BrandRow;

    let promptQuery = supabase
      .from("ai_detection_prompts")
      .select("id, prompt, category")
      .eq("brand_id", brand_id)
      .eq("is_active", true);
    if (prompt_ids && prompt_ids.length > 0) promptQuery = promptQuery.in("id", prompt_ids);

    const { data: prompts, error: promptsError } = await promptQuery;
    if (promptsError) throw new Error("Failed to fetch prompts");
    if (!prompts || prompts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No prompts to scan", scanned: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const typedPrompts = prompts as PromptRow[];
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    if (WORKER_URL && WORKER_SECRET) {
      const { error: jobError } = await supabase.from("ai_detection_jobs").insert({
        tenant_id,
        brand_id,
        scan_id: scanId,
        engine: "chatgpt_web",
        status: "queued",
        total_prompts: typedPrompts.length,
      });
      if (jobError) throw jobError;

      const dispatch = await fetch(`${WORKER_URL.replace(/\/$/, "")}/v1/scans`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-chatgpt-worker-secret": WORKER_SECRET,
        },
        body: JSON.stringify({
          scan_id: scanId,
          tenant_id,
          brand_id,
          brand_name: brandData.brand_name,
          keywords: brandData.keywords ?? [],
          competitors: brandData.competitor_names ?? [],
          prompts: typedPrompts.map((prompt) => ({ id: prompt.id, prompt: prompt.prompt })),
        }),
      });
      if (!dispatch.ok) {
        const detail = await dispatch.text();
        await supabase.from("ai_detection_jobs").update({
          status: "failed",
          error: `worker ${dispatch.status}: ${detail.slice(0, 500)}`,
          finished_at: new Date().toISOString(),
        }).eq("scan_id", scanId);
        throw new Error(`ChatGPT web worker rejected the scan (${dispatch.status})`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          queued: true,
          engine: "chatgpt_web",
          scan_id: scanId,
          scanned: typedPrompts.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Record<string, unknown>[] = [];
    const competitorResults: Record<string, unknown>[] = [];

    const scanned = await mapPool(typedPrompts, 3, async (prompt) => {
      try {
        const answer = await askChatGPTAsUser({
          apiKey: OPENAI_API_KEY as string,
          prompt: prompt.prompt,
          location: ISRAEL_USER,
        });
        logAiUsage({
          source: "ai-detection-scan",
          model: answer.model,
          tokens_in: answer.usage?.input ?? null,
          tokens_out: answer.usage?.output ?? null,
          tenant_id,
          meta: { engine: answer.engine, prompt_id: prompt.id, brand_id },
        });
        return { prompt, answer };
      } catch (error) {
        console.error(`ChatGPT search failed for prompt ${prompt.id}:`, error);
        return null;
      }
    });
    const successful = scanned.filter((row): row is NonNullable<typeof row> => row !== null);
    if (successful.length === 0) throw new Error("ChatGPT web search failed for every prompt");

    for (const { prompt, answer } of successful) {
      const mentioned = brandIsMentioned(answer.text, brandData.brand_name, brandData.keywords ?? []);
      let sentiment: string | null = null;
      let position: number | null = null;
      let snippet: string | null = answer.text.substring(0, 500);

      if (mentioned) {
        const analysis = await analyzeMention(OPENAI_API_KEY as string, answer.text, brandData.brand_name, brandData.keywords ?? []);
        sentiment = analysis.sentiment;
        position = analysis.position ?? listPosition(answer.text, brandData.brand_name);
        snippet = analysis.snippet;
      }

      results.push({
        tenant_id,
        brand_id,
        prompt_id: prompt.id,
        platform: "chatgpt",
        is_mentioned: mentioned,
        position,
        sentiment,
        response_snippet: snippet,
        citations: answer.citations,
        scan_id: scanId,
        scanned_at: new Date().toISOString(),
      });

      for (const competitor of brandData.competitor_names ?? []) {
        const competitorMentioned = brandIsMentioned(answer.text, competitor, [competitor]);
        competitorResults.push({
          tenant_id,
          brand_id,
          competitor_name: competitor,
          prompt_id: prompt.id,
          platform: "chatgpt",
          is_mentioned: competitorMentioned,
          position: competitorMentioned ? listPosition(answer.text, competitor) : null,
          scan_id: scanId,
          scanned_at: new Date().toISOString(),
        });
      }
    }

    if (results.length > 0) {
      const { error: insertError } = await supabase.from("ai_detection_results").insert(results);
      if (insertError) console.error("Error saving results:", insertError);
    }
    if (competitorResults.length > 0) {
      const { error: insertError } = await supabase.from("ai_detection_competitor_results").insert(competitorResults);
      if (insertError) console.error("Error saving competitor results:", insertError);
    }

    const mentionedPromptIds = new Set(results.filter((row) => row.is_mentioned).map((row) => String(row.prompt_id)));
    const score = mentionRateScore(mentionedPromptIds.size, typedPrompts.length);

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { error: scoreError } = await supabase.from("ai_detection_scores").upsert({
      tenant_id,
      brand_id,
      score,
      chatgpt_score: score,
      gemini_score: null,
      perplexity_score: null,
      total_prompts: typedPrompts.length,
      mentioned_prompts: mentionedPromptIds.size,
      week_start: weekStartStr,
    }, { onConflict: "brand_id,week_start", ignoreDuplicates: false });
    if (scoreError) console.error("Error saving score:", scoreError);

    return new Response(
      JSON.stringify({
        success: true,
        engine: "chatgpt_web_search",
        scanned: results.length,
        mentioned: mentionedPromptIds.size,
        score,
        platforms: { chatgpt: score },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function analyzeMention(
  apiKey: string,
  responseText: string,
  brandName: string,
  keywords: string[],
): Promise<{ sentiment: string; position: number | null; snippet: string }> {
  try {
    const analysisResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Analyze how the brand "${brandName}" (keywords: ${keywords.join(", ")}) is mentioned in the following AI response. Return JSON only: {"sentiment": "positive"|"neutral"|"negative", "position": <number or null - position in list if applicable>, "snippet": "<relevant 1-2 sentence excerpt>"}`,
          },
          { role: "user", content: responseText },
        ],
      }),
    });
    if (!analysisResponse.ok) {
      return { sentiment: "neutral", position: null, snippet: responseText.substring(0, 200) };
    }
    const data = await analysisResponse.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        sentiment: parsed.sentiment || "neutral",
        position: parsed.position || null,
        snippet: parsed.snippet || responseText.substring(0, 200),
      };
    }
  } catch (error) {
    console.error("Analysis error:", error);
  }
  return { sentiment: "neutral", position: null, snippet: responseText.substring(0, 200) };
}
