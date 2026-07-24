// Mints an ephemeral OpenAI Realtime client secret for the Command Center's
// live voice conversation. The browser then talks WebRTC directly to OpenAI;
// the real OPENAI_API_KEY never reaches the frontend.
//
// POST body: { voice?: string }
// Response: { client_secret: string, model: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { getCaller, getUserOpenAIKey } from '../_shared/userKey.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const REALTIME_MODEL = 'gpt-realtime';
const REALTIME_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

// Server-side gate for the Command Center's paid live-voice sessions.
// Temporary allowlist (mirrored in src/components/carmen-command/access.ts)
// until per-user API keys land — then each user consumes their own key.
const COMMAND_CENTER_ALLOWLIST = ['david.castelnuovo@gmail.com'];

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
// (run-ai-agent) through the ask_carmen tool — same brain, same data, caller-
// scoped permissions enforced server-side.
function buildInstructions(callerName: string | null): string {
  return [
    'את כרמן — עוזרת ה-AI שמנהלת את העסק במערכת AIOS. דברי עברית ישראלית טבעית וחמה, במשפטים קצרים וישירים.',
    callerName
      ? `את מדברת עכשיו עם ${callerName}. פתחי את השיחה בפנייה אישית בשמו/ה, ופני כך לאורך השיחה.`
      : 'פתחי את השיחה בברכה קצרה.',
    'ask_carmen הוא המוח שלך — אותו מוח, אותם נתונים ואותו זיכרון של כרמן בכל המערכת. לכל שאלה על נתונים — לקוחות, לידים, משימות, קמפיינים, דוחות, זיכרון — או בקשה לבצע פעולה, קראי לו מיד עם הבקשה המלאה וענִי רק לפי מה שחזר. אל תמציאי נתונים ואל תציגי את זה כ"בדיקה מול מערכת אחרת" — זו את.',
    'הרשאות: התשובות מ-ask_carmen כבר מוגבלות אוטומטית להרשאות של המשתמש שמולך (קמפיינר רואה רק את הלקוחות שלו; הכל בטננט הנוכחי בלבד). לעולם אל תזכירי לקוחות או נתונים מחוץ למה שהכלי החזיר.',
    'שיחות שלא קשורות לעבודה בשום צורה: עני קצר וחביב — "אין לי זמן לזה עכשיו, אני באמצע ניהול עסק 😉" — והחזירי מיד לענייני עבודה.',
    'בזמן שהכלי עובד אפשר לומר משפט קצר כמו "שניה, בודקת".',
  ].join('\n');
}

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

    // Bring-your-own-key: a personal key grants access and gets billed;
    // allowlisted owners may fall back to the org key.
    const caller = await getCaller(authHeader);
    if (!caller) return json(401, { error: 'Unauthorized' });
    const userKey = await getUserOpenAIKey(caller.id);
    const isOwner = COMMAND_CENTER_ALLOWLIST.includes(caller.email);
    if (!userKey && !isOwner) {
      return json(403, { error: 'personal_key_required', message: 'כדי להשתמש בכרמן יש להזין API key אישי של OpenAI בפרופיל שלך' });
    }

    const key = userKey ?? await resolveOpenAIKey();
    if (!key) return json(500, { error: 'No OpenAI key available (env or llm integration)' });

    // Personalization: greet the caller by name (best-effort)
    let callerName: string | null = null;
    try {
      const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const pr = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/rest/v1/profiles?id=eq.${caller.id}&select=full_name`,
        { headers: { apikey: service, Authorization: `Bearer ${service}` } },
      );
      if (pr.ok) callerName = (await pr.json())?.[0]?.full_name ?? null;
    } catch { /* name is a nicety */ }

    const { voice } = await req.json().catch(() => ({} as Record<string, unknown>));
    const selectedVoice = typeof voice === 'string' && REALTIME_VOICES.has(voice) ? voice : 'marin';

    const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        session: {
          type: 'realtime',
          model: REALTIME_MODEL,
          instructions: buildInstructions(callerName),
          audio: {
            input: { transcription: { model: 'gpt-4o-mini-transcribe', language: 'he' } },
            output: { voice: selectedVoice },
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
