// Standalone test harness for sending a Carmen voice note via the Manus WA gateway.
// Does NOT touch the live reply flow. Generates TTS (OpenAI), uploads it to a
// public bucket, then probes the likely gateway audio endpoints in order and
// reports which one the gateway accepts. Once we know the working endpoint we
// wire it into the real reply path.
//
// POST body: { tenant_id: string, to: string, text: string, voice?: string }
//   - `to`: the recipient as the gateway expects (phone like "97250..." or a
//           group/chat id like "...@g.us"/"...@c.us").
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiSpeak } from '../_shared/ai.ts';

const BASE_URL = 'https://whatsappgw-pzpyrrww.manus.space';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenant_id, to, text, voice } = await req.json();
    if (!tenant_id || !to || !text) {
      return json({ error: 'tenant_id, to and text are required' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

    // 1) Resolve the active Manus WA integration for this tenant.
    const { data: integ } = await supabase
      .from('tenant_integrations')
      .select('api_key, settings')
      .eq('tenant_id', tenant_id)
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const apiKey = integ?.api_key;
    const instanceId = (integ?.settings as any)?.instance_id;
    if (!apiKey || !instanceId) return json({ error: 'Manus WhatsApp not configured for this tenant' }, 400);

    // 2) Generate the voice note (Ogg/Opus — WhatsApp PTT format).
    const audio = await aiSpeak(text, { voice: voice || 'shimmer', format: 'opus' });
    if (!audio) return json({ error: 'TTS failed (check OPENAI_API_KEY)' }, 502);

    // 3) Upload to a public bucket so the gateway can fetch it by URL.
    await supabase.storage.createBucket('wa-voice', { public: true }).catch(() => {});
    const path = `${tenant_id}/${crypto.randomUUID()}.ogg`;
    const up = await supabase.storage.from('wa-voice').upload(path, audio, {
      contentType: 'audio/ogg', upsert: true,
    });
    if (up.error) return json({ error: `upload failed: ${up.error.message}` }, 500);
    const audioUrl = supabase.storage.from('wa-voice').getPublicUrl(path).data.publicUrl;

    // 4) Probe candidate endpoints/payloads (same /send/{type} convention as text).
    //    Stop at the first that the gateway accepts.
    const inst = `${BASE_URL}/api/v1/instances/${instanceId}`;
    const candidates: Array<{ endpoint: string; body: Record<string, unknown> }> = [
      { endpoint: `${inst}/send/audio`,  body: { to, url: audioUrl } },
      { endpoint: `${inst}/send/audio`,  body: { to, audio: audioUrl, ptt: true } },
      { endpoint: `${inst}/send/voice`,  body: { to, url: audioUrl } },
      { endpoint: `${inst}/send/media`,  body: { to, url: audioUrl, type: 'audio', ptt: true } },
      { endpoint: `${inst}/send/file`,   body: { to, url: audioUrl, type: 'audio' } },
      { endpoint: `${inst}/send/ptt`,    body: { to, url: audioUrl } },
    ];

    const attempts: any[] = [];
    let success: any = null;
    for (const c of candidates) {
      try {
        const r = await fetch(c.endpoint, {
          method: 'POST',
          headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify(c.body),
        });
        const bodyText = (await r.text()).slice(0, 400);
        const rec = { endpoint: c.endpoint, sent: c.body, status: r.status, ok: r.ok, response: bodyText };
        attempts.push(rec);
        if (r.ok) { success = rec; break; } // gateway accepted — one voice note delivered.
      } catch (e) {
        attempts.push({ endpoint: c.endpoint, sent: c.body, error: (e as any)?.message });
      }
    }

    return json({
      audio_url: audioUrl,         // verify the TTS itself even if no endpoint worked
      working_endpoint: success?.endpoint || null,
      attempts,
    }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
