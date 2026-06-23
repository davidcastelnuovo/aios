// Carmen Self-Learning — analyzes a closed WhatsApp session and extracts insights
// into carmen_memory_pointers + carmen_memory_episodes.
import { svc, embed, upsertPointer, shortText } from "../_shared/carmen-memory.ts";
import { chatCompletion } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "google/gemini-2.5-flash";

type Insight = {
  what_worked: { observation: string; example?: string }[];
  what_failed: { observation: string; example?: string; reason?: string }[];
  facts: { entity_type?: string; entity_id?: string; fact: string }[];
  explicit_instructions: { instruction: string }[];
  style_preferences: { preference: string }[];
  session_summary: string;
  quality_score: number; // 1-5
};

const SYSTEM_PROMPT = `אתה מנתח שיחות WhatsApp בין משתמש (איש צוות בסוכנות שיווק) לבין כרמן (סוכן AI).
מטרה: ללמוד איך לשפר את כרמן.

חלץ:
1. what_worked – ניסוחים/פעולות של כרמן שהובילו לתוצאה חיובית (אישור, הבנה מהירה, שיתוף פעולה)
2. what_failed – מקומות שהמשתמש תיקן את כרמן, חזר על עצמו, ביטא תסכול, או שכרמן לא הבינה
3. facts – עובדות יציבות על לקוחות/קמפיינים/אנשי צוות שכדאי לזכור (לא חד-פעמי)
4. explicit_instructions – הוראות מפורשות מהמשתמש: "תזכרי", "זכרי", "שמרי", "מעכשיו", "תמיד", "אל תעשי..."
5. style_preferences – העדפות תקשורת: אורך תשובה, טון, פורמט, שפה
6. session_summary – משפט-שניים בעברית
7. quality_score – 1 (גרוע) עד 5 (מצוין)

החזר JSON בלבד לפי הסכמה. אם אין מה לחלץ בקטגוריה – החזר מערך ריק.`;

function buildSchema() {
  return {
    type: "object",
    properties: {
      what_worked: {
        type: "array",
        items: {
          type: "object",
          properties: {
            observation: { type: "string" },
            example: { type: "string" },
          },
          required: ["observation"],
        },
      },
      what_failed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            observation: { type: "string" },
            example: { type: "string" },
            reason: { type: "string" },
          },
          required: ["observation"],
        },
      },
      facts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            entity_type: { type: "string" },
            entity_id: { type: "string" },
            fact: { type: "string" },
          },
          required: ["fact"],
        },
      },
      explicit_instructions: {
        type: "array",
        items: {
          type: "object",
          properties: { instruction: { type: "string" } },
          required: ["instruction"],
        },
      },
      style_preferences: {
        type: "array",
        items: {
          type: "object",
          properties: { preference: { type: "string" } },
          required: ["preference"],
        },
      },
      session_summary: { type: "string" },
      quality_score: { type: "integer" },
    },
    required: [
      "what_worked",
      "what_failed",
      "facts",
      "explicit_instructions",
      "style_preferences",
      "session_summary",
      "quality_score",
    ],
  };
}

async function analyze(history: any[]): Promise<Insight | null> {
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return null;
  const trimmed = history.slice(-40);
  const transcript = trimmed
    .map((m: any) => `[${m.role || m.direction || "?"}] ${shortText(m.content || m.message || m.text, 500)}`)
    .join("\n");

  let j: any;
  try {
    j = await chatCompletion({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `תמלול שיחה:\n\n${transcript}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_insights",
            description: "שומר את התובנות מהשיחה",
            parameters: buildSchema(),
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_insights" } },
    });
  } catch (e) {
    console.error("[carmen-learn] AI error", e);
    return null;
  }
  const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args) as Insight;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { session_id, force } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = svc();

    // Load session
    const { data: session, error: sErr } = await supabase
      .from("carmen_whatsapp_sessions")
      .select("*")
      .eq("id", session_id)
      .maybeSingle();
    if (sErr || !session) {
      return new Response(JSON.stringify({ error: "session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: skip if already analyzed (unless force)
    const { data: existing } = await supabase
      .from("carmen_memory_episodes")
      .select("id")
      .eq("tenant_id", session.tenant_id)
      .eq("session_ref", session.id)
      .maybeSingle();
    if (existing && !force) {
      return new Response(JSON.stringify({ skipped: true, reason: "already_learned" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const history = Array.isArray(session.conversation_history) ? session.conversation_history : [];
    if (history.length < 2) {
      return new Response(JSON.stringify({ skipped: true, reason: "too_short" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insight = await analyze(history);
    if (!insight) {
      return new Response(JSON.stringify({ error: "ai_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenant_id = session.tenant_id;
    const ref_date = session.last_message_at || session.ended_at || session.created_at;

    // 1. Episode
    const summaryFull = [
      insight.session_summary,
      insight.what_worked.length ? `✓ ${insight.what_worked.map((w) => w.observation).join(" | ")}` : "",
      insight.what_failed.length ? `✗ ${insight.what_failed.map((w) => w.observation).join(" | ")}` : "",
    ].filter(Boolean).join("\n");

    const emb = await embed(summaryFull);
    const tags: string[] = [];
    if (insight.what_worked.length) tags.push("worked");
    if (insight.what_failed.length) tags.push("failed");
    if (insight.explicit_instructions.length) tags.push("instructions");
    if (insight.style_preferences.length) tags.push("style");

    if (existing && force) {
      await supabase.from("carmen_memory_episodes").delete().eq("id", existing.id);
    }

    await supabase.from("carmen_memory_episodes").insert({
      tenant_id,
      session_ref: session.id,
      topic: `WhatsApp · ${session.sender_name || session.phone || "שיחה"}`,
      topic_tags: tags,
      summary: summaryFull,
      summary_embedding: emb as any,
      source_table: "carmen_whatsapp_sessions",
      source_ids: [session.id],
      participants: { phone: session.phone, sender_name: session.sender_name, chat_id: session.chat_id },
      importance: Math.min(5, Math.max(1, Math.round(insight.quality_score))),
      retention_score: 1.0,
      ref_date,
    });

    // 2. Pointers — facts
    let facts = 0, instructions = 0, style = 0, worked = 0, failed = 0;

    for (const f of insight.facts) {
      await upsertPointer(supabase, {
        tenant_id,
        category: "learned_facts",
        subcategory: f.entity_type ?? null,
        path: `learned_facts/${session.id}/${facts}`,
        entity_type: f.entity_type || "session",
        entity_id: f.entity_id || session.id,
        title: shortText(f.fact, 80),
        summary: f.fact,
        ref_date,
        importance: 60,
        metadata: { source: "carmen_learn", session_id: session.id },
      });
      facts++;
    }

    for (const i of insight.explicit_instructions) {
      await upsertPointer(supabase, {
        tenant_id,
        category: "instructions",
        path: `instructions/${session.id}/${instructions}`,
        entity_type: "instruction",
        entity_id: `${session.id}-i${instructions}`,
        title: shortText(i.instruction, 80),
        summary: i.instruction,
        ref_date,
        importance: 90,
        metadata: { source: "carmen_learn", session_id: session.id, sender: session.sender_name },
      });
      instructions++;
    }

    for (const p of insight.style_preferences) {
      await upsertPointer(supabase, {
        tenant_id,
        category: "style",
        path: `style/${session.id}/${style}`,
        entity_type: "style",
        entity_id: `${session.id}-s${style}`,
        title: shortText(p.preference, 80),
        summary: p.preference,
        ref_date,
        importance: 70,
        metadata: { source: "carmen_learn", session_id: session.id },
      });
      style++;
    }

    for (const w of insight.what_worked) {
      await upsertPointer(supabase, {
        tenant_id,
        category: "what_worked",
        path: `what_worked/${session.id}/${worked}`,
        entity_type: "lesson",
        entity_id: `${session.id}-w${worked}`,
        title: shortText(w.observation, 80),
        summary: [w.observation, w.example].filter(Boolean).join(" — "),
        ref_date,
        importance: 60,
        metadata: { source: "carmen_learn", session_id: session.id, kind: "positive" },
      });
      worked++;
    }

    for (const f of insight.what_failed) {
      await upsertPointer(supabase, {
        tenant_id,
        category: "what_failed",
        path: `what_failed/${session.id}/${failed}`,
        entity_type: "lesson",
        entity_id: `${session.id}-f${failed}`,
        title: shortText(f.observation, 80),
        summary: [f.observation, f.reason && `סיבה: ${f.reason}`, f.example && `דוגמה: ${f.example}`]
          .filter(Boolean).join(" — "),
        ref_date,
        importance: 80,
        metadata: { source: "carmen_learn", session_id: session.id, kind: "negative" },
      });
      failed++;
    }

    return new Response(JSON.stringify({
      ok: true,
      session_id: session.id,
      quality_score: insight.quality_score,
      counts: { facts, instructions, style, worked, failed },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[carmen-learn-from-session]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
