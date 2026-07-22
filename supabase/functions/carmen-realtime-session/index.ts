// Mints an ephemeral OpenAI Realtime client secret for the Command Center's
// live voice conversation. The browser then talks WebRTC directly to OpenAI;
// the real OPENAI_API_KEY never reaches the frontend.
//
// POST body: { voice?: string }
// Response: { client_secret: string, model: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REALTIME_MODEL = 'gpt-realtime';

// Mirrors resolveOpenAIKey in _shared/ai.ts (kept local so this function stays
// single-file deployable): env var first, then the active llm integration row.
async function resolveOpenAIKey(): Promise<string | null> {
  const envKey = Deno.env.get('OPENAI_API_KEY');
  if (envKey) return envKey;
  try {
    const url = `${Deno.env.get('SUPABASE_URL')}/rest/v1/tenant_integrations` +
      `?integration_type=eq.llm&is_active=eq.true&select=settings`;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const r = await fetch(url, { headers: { apikey: service, Authorization: `Bearer ${service}` } });
    if (!r.ok) return null;
    const rows = await r.json();
    for (const row of Array.isArray(rows) ? rows : []) {
      const k = row?.settings?.openai_api_key;
      if (typeof k === 'string' && k.trim()) return k.trim();
    }
  } catch { /* fall through */ }
  return null;
}

// Voice-first persona. Data questions are delegated to Carmen's full brain
// (run-ai-agent) through the ask_carmen tool — the realtime model never
// invents system data on its own.
const CARMEN_REALTIME_INSTRUCTIONS =
  'את כרמן — עוזרת ה-AI של מערכת AIOS. דברי עברית ישראלית טבעית וחמה, במשפטים קצרים וישירים. ' +
  'לכל שאלה על נתונים במערכת — לקוחות, לידים, משימות, קמפיינים, דוחות, זיכרון — או בקשה לבצע פעולה, ' +
  'חובה לקרוא לכלי ask_carmen עם הבקשה המלאה, ולענות רק לפי מה שהכלי החזיר. אל תמציאי נתונים. ' +
  'בזמן שהכלי עובד אפשר לומר משפט קצר כמו "שניה, בודקת". שיחת חולין — עני ישירות ובקצרה.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    // Any signed-in user may open a session (tenant scoping happens inside
    // run-ai-agent when the ask_carmen tool is invoked with the user's JWT).
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: claims } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (!claims?.claims) return json(401, { error: 'Unauthorized' });

    const key = await resolveOpenAIKey();
    if (!key) return json(500, { error: 'No OpenAI key available (env or llm integration)' });

    const { voice } = await req.json().catch(() => ({} as Record<string, unknown>));

    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions: CARMEN_REALTIME_INSTRUCTIONS,
          audio: {
            input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'he' } },
            output: { voice: typeof voice === 'string' && voice ? voice : 'marin' },
          },
          tools: [{
            type: 'function',
            name: 'ask_carmen',
            description:
              'המוח המלא של כרמן במערכת AIOS: שליפת נתונים (לקוחות, לידים, משימות, קמפיינים, דוחות, זיכרון) וביצוע פעולות. יש להעביר את בקשת המשתמש במלואה, בעברית.',
            parameters: {
              type: 'object',
              properties: { question: { type: 'string', description: 'הבקשה המלאה של המשתמש' } },
              required: ['question'],
            },
          }],
          tool_choice: 'auto',
        },
      }),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      console.error('[carmen-realtime-session] openai error', r.status, detail);
      return json(502, { error: `OpenAI realtime session failed (${r.status})`, detail });
    }
    const data = await r.json();
    const secret = data?.value ?? data?.client_secret?.value;
    if (!secret) return json(502, { error: 'No client secret in OpenAI response' });
    return json(200, { client_secret: secret, model: REALTIME_MODEL });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
});
