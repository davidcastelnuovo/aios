import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brand_name, keywords, competitors, description } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const competitorList = (competitors || []).filter(Boolean).join(", ");
    const keywordList = (keywords || []).filter(Boolean).join(", ");

    const systemPrompt = `אתה מומחה לשיווק דיגיטלי ו-AI SEO. תפקידך ליצור פרומפטים (שאלות) שמשתמשים אמיתיים שואלים מודלי AI כמו ChatGPT, Gemini ו-Perplexity.

כלל קריטי: הפרומפטים חייבים להיות שאלות כלליות בתחום בלי לציין את שם המותג "${brand_name}" בשאלה עצמה!
המטרה היא לבדוק אם כששואלים שאלה כללית, ה-AI ממליץ על המותג מעצמו.

דוגמאות נכונות:
- "מה סוכנות השיווק הכי טובה לעסקים קטנים בישראל?"
- "איזה כלי CRM מומלץ לניהול לקוחות?"
- "איך בוחרים חברת קידום אתרים?"

דוגמאות שגויות (לא ליצור כאלה!):
- "מה דעתך על פרומו?" ← מזכיר את שם המותג
- "האם כדאי לעבוד עם פרומו?" ← מזכיר את שם המותג`;

    const userPrompt = `צור 8 פרומפטים (שאלות כלליות) שמשתמשים אמיתיים ישאלו מודלי AI בתחום של:
${description ? `- תיאור העסק: ${description}` : `- תחום: ${brand_name}`}
${keywordList ? `- מילות מפתח בתחום: ${keywordList}` : ""}
${competitorList ? `- מתחרים בשוק: ${competitorList}` : ""}

חשוב מאוד: אל תציין את "${brand_name}" או את שמות המתחרים בתוך השאלות! השאלות חייבות להיות גנריות לחלוטין.

הקטגוריות הנדרשות:
- recommendation (שאלות המלצה כמו "מה הכלי הכי טוב ל...")
- comparison (שאלות השוואת קטגוריה כמו "מה ההבדלים בין סוגי X ל-Y")
- review (שאלות על בחירה בתחום כמו "איך בוחרים את ה... הנכון?")
- general (שאלות כלליות בתחום)

החזר בדיוק 8 פרומפטים מגוונים וטבעיים.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
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
                        category: { type: "string", enum: ["recommendation", "comparison", "review", "general"] },
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
