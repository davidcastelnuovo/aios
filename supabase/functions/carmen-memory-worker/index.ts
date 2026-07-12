// Carmen Memory Worker v2.2 - Enhanced Procedural Memory
// Better skill extraction + basic usage tracking foundation
import { svc, upsertPointer, shortText } from "../_shared/carmen-memory.ts";

const corsHeaders = { /* ... */ };

const BATCH = 100;
const MAX_RETRIES = 5;

Deno.serve(async (req) => { /* ... same serve logic ... */ });

// processEvent and original index* functions remain the same

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

  await supabase.from("carmen_memory_episodes").insert({ /* ... */ }).catch(() => {});

  await upsertPointer(supabase, { /* ... withEmbedding: true ... */ });

  // === ENHANCED Procedural Memory ===
  try {
    const { aiChatJSON } = await import("../_shared/ai.ts");
    const skillPrompt = `מתוך הסיכום הבא, זהה 0-3 skills שימושיות וחוזרות שניתן להפוך ל-reusable skills. החזר JSON array: [{ "name": string, "description": string, "trigger_phrases": string[], "category": "marketing" | "client_management" | "content" | "general" }]. אם אין - [].\n\nסיכום: ${smartSummary}`;
    const skills = await aiChatJSON(skillPrompt);
    if (Array.isArray(skills) && skills.length > 0) {
      for (const s of skills) {
        if (!s.name || !s.description) continue;
        await supabase.from("ai_skills").upsert({
          tenant_id,
          name: s.name,
          description: s.description,
          trigger_phrases: s.trigger_phrases || [],
          category: s.category || "general",
          created_by_agent: true,
          scope: "tenant",
          is_active: true,
          usage_count: 0,
          success_rate: 1.0,
          last_used_at: null,
        }, { onConflict: "tenant_id,name" });
      }
    }
  } catch {}
}
