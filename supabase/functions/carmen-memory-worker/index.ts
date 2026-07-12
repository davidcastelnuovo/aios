// Carmen Memory Worker v2 - Smart summaries + episodes
// Improved with AI-generated summaries for better long-term recall
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

// Original index* functions kept for compatibility (client, campaigner, task, chat_message)
async function indexClient(supabase: any, tenant_id: string, c: any) {
  const summary = [
    c.industry && `תעשייה: ${c.industry}`,
    c.status && `סטטוס: ${c.status}`,
    c.mood_status && `מצב רוח: ${c.mood_status}`,
    c.tier && `דרגה: ${c.tier}`,
    c.contact_name && `איש קשר: ${c.contact_name}`,
  ].filter(Boolean).join(" · ");

  await upsertPointer(supabase, {
    tenant_id,
    category: "clients",
    path: `clients/${c.id}`,
    entity_type: "client",
    entity_id: c.id,
    title: c.name ?? "לקוח",
    summary,
    importance: c.tier === "premium" ? 80 : 60,
    metadata: { agency_id: c.agency_id, status: c.status, mood_status: c.mood_status },
  });
}

async function indexCampaigner(supabase: any, tenant_id: string, c: any) {
  await upsertPointer(supabase, {
    tenant_id,
    category: "team",
    path: `team/${c.id}`,
    entity_type: "campaigner",
    entity_id: c.id,
    title: c.full_name ?? "חבר צוות",
    summary: [c.role && `תפקיד: ${Array.isArray(c.role) ? c.role.join(", ") : c.role}`, c.phone && `טלפון: ${c.phone}`].filter(Boolean).join(" · "),
    importance: 60,
    metadata: { active: c.active },
  });
}

async function indexTask(supabase: any, tenant_id: string, t: any) {
  const assignee = t.assigned_to_campaigner_id ?? t.campaigner_id;
  if (!assignee) return;
  await upsertPointer(supabase, {
    tenant_id,
    category: "team",
    subcategory: "tasks",
    path: `team/${assignee}/tasks`,
    entity_type: "task",
    entity_id: t.id,
    title: shortText(t.title, 100),
    summary: shortText(t.description, 200),
    ref_date: t.due_date ?? t.created_at,
    importance: t.status === "open" ? 70 : 30,
    metadata: { status: t.status, client_id: t.client_id },
  });
}

async function indexChatMessage(supabase: any, tenant_id: string, m: any) {
  const body = m.message ?? m.body ?? m.text ?? "";
  if (!body || String(body).trim().length < 2) return;

  const date = (m.created_at ?? new Date().toISOString()).slice(0, 10);
  const channel = m.provider ?? "unknown";

  await upsertPointer(supabase, {
    tenant_id,
    category: "messages",
    subcategory: channel,
    path: `messages/${date}/${channel}`,
    entity_type: "chat_message",
    entity_id: m.id,
    title: `${m.direction ?? ""} ${m.sender_name ?? m.sender_phone ?? ""}`.trim(),
    summary: shortText(body, 200),
    ref_date: m.created_at,
    importance: 30,
    metadata: { direction: m.direction, client_id: m.client_id, lead_id: m.lead_id },
  });
}

// === IMPROVED: Smart AI summary for episodes ===
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
}
