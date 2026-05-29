// Per-agent automatic memory: summarize + embed + store after each non-Carmen run.
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const EMBED_URL = 'https://ai.gateway.lovable.dev/v1/embeddings';

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_API_KEY || !text?.trim()) return null;
  try {
    const r = await fetch(EMBED_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemini-embedding-001', input: text.slice(0, 8000), dimensions: 1536 }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.data?.[0]?.embedding ?? null;
  } catch { return null; }
}

export async function summarizeAndStoreAgentMemory(opts: {
  supabase: any;
  tenant_id: string;
  agent_id: string;
  user_message: string;
  assistant_output: string;
  tools_used: string[];
}) {
  try {
    if (!LOVABLE_API_KEY) return;
    const { supabase, tenant_id, agent_id, user_message, assistant_output, tools_used } = opts;
    if (!user_message?.trim() || !assistant_output?.trim()) return;

    const prompt = `סכם את האינטראקציה הבאה בין משתמש לסוכן AI ב-2-3 משפטים. החזר JSON תקין בלבד עם השדות: title (כותרת קצרה), summary (סיכום), category (אחד מ: conversation, instruction, fact, task, preference), importance (1-100).
משתמש: ${user_message.slice(0, 2000)}
סוכן: ${assistant_output.slice(0, 2000)}
כלים: ${tools_used.join(', ') || 'ללא'}`;

    const r = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!r.ok) return;
    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content || '{}';
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed.title || !parsed.summary) return;

    const emb = await embed(`${parsed.title}\n${parsed.summary}`);

    await supabase.from('agent_memory').insert({
      tenant_id,
      agent_id,
      category: parsed.category || 'conversation',
      title: String(parsed.title).slice(0, 200),
      summary: String(parsed.summary).slice(0, 2000),
      summary_embedding: emb,
      importance: Math.min(100, Math.max(1, Number(parsed.importance) || 50)),
      metadata: { tools_used },
    });
  } catch (e) {
    console.error('[agent-memory] store error:', (e as any)?.message);
  }
}

export async function recallAgentMemory(
  supabase: any,
  agent_id: string,
  query_text: string,
  limit = 6,
): Promise<{ title: string; summary: string; category: string }[]> {
  try {
    const emb = await embed(query_text);
    if (!emb) return [];
    const { data } = await supabase.rpc('match_agent_memory', {
      p_agent_id: agent_id,
      p_query_embedding: emb,
      p_limit: limit,
    });
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
