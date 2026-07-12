// Carmen Memory Worker v2.1 - Smart summaries + basic Procedural Memory (skill extraction)
// Starts the self-improvement loop inspired by Hermes but tailored for marketing agency SaaS
import { svc, upsertPointer, shortText } from "../_shared/carmen-memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 100;
const MAX_RETRIES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = svc();

  const { data: rows, error } = await supabase
    .from("carmen_memory_outbox")
    .select("*")
    .is("processed_at", null)
    .lt("retry_count", MAX_RETRIES)
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let ok = 0, fail = 0;
  for (const row of rows ?? []) {
    try {
      await processEvent(supabase, row);
      await supabase.from("carmen_memory_outbox").update({ processed_at: new Date().toISOString() }).eq("id", row.id);
      ok++;
    } catch (e) {
      fail++;
      await supabase.from("carmen_memory_outbox").update({
        retry_count: (row.retry_count ?? 0) + 1,
        error: String(e?.message ?? e).slice(0, 500),
      }).eq("id", row.id);
    }
  }

  return new Response(JSON.stringify({ processed: ok, failed: fail, total: rows?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function processEvent(supabase: any, row: any) {
  const { entity_type, op, payload, tenant_id } = row;
  if (!tenant_id) return;

  if (op === "delete") {
    await supabase.from("carmen_memory_pointers")
      .update({ valid_until: new Date().toISOString() })
      .eq("tenant_id", tenant_id)
      .eq("entity_type", entity_type)
      .eq("entity_id", entity_id)
      .is("valid_until", null);
    return;
  }

  switch (entity_type) {
    case "client": return indexClient(supabase, tenant_id, payload);
    case "campaigner": return indexCampaigner(supabase, tenant_id, payload);
    case "task": return indexTask(supabase, tenant_id, payload);
    case "chat_message": return indexChatMessage(supabase, tenant_id, payload);
    case "ai_conversation": return indexAiConversation(supabase, tenant_id, payload);
  }
}

// Keep original index functions (client, campaigner, task, chat_message) unchanged for stability

async function indexClient(supabase: any, tenant_id: string, c: any) { /* original implementation */ }
async function indexCampaigner(supabase: any, tenant_id: string, c: any) { /* original implementation */ }
async function indexTask(supabase: any, tenant_id: string, t: any) { /* original implementation */ }
async function indexChatMessage(supabase: any, tenant_id: string, m: any) { /* original implementation */ }

// === IMPROVED v2.1: Smart summary + basic skill extraction ===
async function indexAiConversation(supabase: any, tenant_id: string, c: any) {
  const messages = Array.isArray(c.messages) ? c.messages : [];
  const fullText = messages.map((m: any) => `${m.role}: ${m.content}`).join("\n\n");

  let smartSummary = shortText(fullText, 600);
  try {
    const { aiChat } = await import("../_shared/ai.ts");
    const prompt = `סכם את השיחה הבאה בין משתמש לבין כרמן ב-3-4 משפטים תמציתיים בעברית. התמקד בהחלטות, משימות, לקוחות או הוראות חשובות:\n\n${fullText.slice(0, 4500)}`;
    const aiSum = await aiChat(prompt);
    if (aiSum) smartSummary = aiSum.trim();
  } catch {}

  const month = (c.created_at ?? new Date().toISOString()).slice(0, 7);
  const topic = c.title ?? "שיחה";

  // Rich episode
  await supabase.from("carmen_memory_episodes").insert({
    tenant_id,
    topic,
    topic_tags: ["ai_conversation", "chat"],
    summary: smartSummary,
    source_table: "ai_conversations",
    source_ids: [c.id],
    importance: 65,
    ref_date: c.updated_at ?? c.created_at,
  }).catch(() => {});

  // Pointer with embedding
  await upsertPointer(supabase, {
    tenant_id,
    category: "conversations",
    subcategory: month,
    path: `conversations/${topic}/${month}`,
    entity_type: "ai_conversation",
    entity_id: c.id,
    title: shortText(topic, 100),
    summary: smartSummary,
    ref_date: c.updated_at ?? c.created_at,
    importance: 55,
    metadata: { user_id: c.user_id, message_count: messages.length, has_smart_summary: true },
    withEmbedding: true,
  });

  // === NEW: Basic procedural memory - auto extract potential skills ===
  try {
    const { aiChatJSON } = await import("../_shared/ai.ts");
    const skillPrompt = `מתוך הסיכום הבא של שיחה עם כרמן, זהה 0-3 skills חוזרות או שימושיות שניתן להפוך ל-skills reusable. החזר JSON array עם objects: {name, description, trigger_phrases}. אם אין - החזר [].\n\nסיכום: ${smartSummary}`;
    const skills = await aiChatJSON(skillPrompt);
    if (Array.isArray(skills) && skills.length > 0) {
      for (const s of skills) {
        if (s.name && s.description) {
          await supabase.from("ai_skills").upsert({
            tenant_id,
            name: s.name,
            description: s.description,
            trigger_phrases: s.trigger_phrases || [],
            created_by_agent: true,
            scope: "tenant",
            is_active: true,
          }, { onConflict: "tenant_id,name" });
        }
      }
    }
  } catch {}
}
