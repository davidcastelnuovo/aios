import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brand_name, keywords, competitors, description } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const competitorList = (competitors || []).filter(Boolean).join(", ");
    const keywordList = (keywords || []).filter(Boolean).join(", ");

    const systemPrompt = `אתה מומחה ל-AI search / GEO. תפקידך ליצור שאילתות שמשתמש אמיתי שואל את ChatGPT כשיש כוונת רכישה — לא סקרנות כללית.

כלל קריטי: הפרומפטים חייבים להיות שאלות כלליות בתחום בלי לציין את שם המותג "${brand_name}" בשאלה עצמה.
הציון ימדוד אם ChatGPT ממליץ על המותג מעצמו לשאלות high-intent.

דוגמאות נכונות (כוונת רכישה):
- "מה סוכנות השיווק הכי טובה לעסקים קטנים בישראל?"
- "איזה כלי CRM מומלץ לניהול לקוחות?"
- "מה החלופות הכי טובות לכלי ניהול פרויקטים לעסק קטן?"

דוגמאות שגויות:
- "מה דעתך על ${brand_name}?" ← מזכיר את שם המותג
- "מה זה שיווק דיגיטלי?" ← אין כוונת רכישה`;

    const userPrompt = `צור 12 פרומפטים שמשתמשים אמיתיים בישראל ישאלו את ChatGPT בתחום של:
${description ? `- הצעת ערך / כאב / שימושים: ${description}` : `- תחום: ${brand_name}`}
${keywordList ? `- מילות מפתח / שימושים: ${keywordList}` : ""}
${competitorList ? `- מתחרים בשוק (לא לציין בשאלות): ${competitorList}` : ""}

אל תציין את "${brand_name}" או שמות מתחרים בתוך השאלות.

מיקס חובה: לפחות 10 מתוך 12 חייבים להיות high-intent (recommendation / comparison / pricing / alternatives / review / local). לכל היותר 2 how_to או general.

החזר בדיוק 12 פרומפטים בעברית מדוברת, מגוונים, בלי חזרות.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_prompts",
              description: "Return generated prompts for AI detection tracking",
              parameters: {
                type: "object",
                properties: {
                  prompts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        prompt: { type: "string", description: "The prompt text in Hebrew" },
                        category: { type: "string", enum: ["recommendation", "comparison", "review", "how_to", "pricing", "alternatives", "local", "general"] },
                      },
                      required: ["prompt", "category"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["prompts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_prompts" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error: " + response.status);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ prompts: parsed.prompts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-ai-prompts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
