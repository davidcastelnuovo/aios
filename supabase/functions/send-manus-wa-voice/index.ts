// Carmen voice notes over the Manus WA gateway — the REAL sender (probe done).
// Confirmed endpoint: POST {gateway}/api/v1/instances/{id}/send/file with
// { to, fileUrl, filename } (2026-07-24; other /send/* audio paths fall through
// to the SPA catch-all). Flow: TTS (OpenAI, ogg/opus) → public wa-voice bucket
// → gateway fetches by URL.
//
// POST body: { tenant_id: string, to: string, text: string, voice?: string }
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiSpeak } from '../_shared/ai.ts';

const DEFAULT_GATEWAY = 'https://whatsappgw-pzpyrrww.manus.space';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Strip markdown noise so the TTS reads clean prose.
function cleanForSpeech(raw: string): string {
  return (raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>~|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { tenant_id, to, text, voice } = await req.json();
    if (!tenant_id || !to || !text) return json({ error: 'tenant_id, to and text are required' }, 400);
    const clean = cleanForSpeech(String(text));
    if (!clean) return json({ error: 'empty text' }, 400);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );

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
    const settings = (integ?.settings as Record<string, unknown>) || {};
    const instanceId = settings.instance_id;
    if (!apiKey || !instanceId) return json({ error: 'Manus WhatsApp not configured for this tenant' }, 400);

    // TTS → ogg/opus (WhatsApp voice format)
    const audio = await aiSpeak(clean, { voice: (voice as string) || 'shimmer', format: 'opus' });
    if (!audio) return json({ error: 'TTS failed' }, 502);

    await supabase.storage.createBucket('wa-voice', { public: true }).catch(() => {});
    const path = `${tenant_id}/${crypto.randomUUID()}.ogg`;
    const up = await supabase.storage.from('wa-voice').upload(path, audio, {
      contentType: 'audio/ogg', upsert: true,
    });
    if (up.error) return json({ error: `upload failed: ${up.error.message}` }, 500);
    const fileUrl = supabase.storage.from('wa-voice').getPublicUrl(path).data.publicUrl;

    const gateway = (settings.gateway_url as string) || DEFAULT_GATEWAY;
    const r = await fetch(`${gateway}/api/v1/instances/${instanceId}/send/file`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, fileUrl, filename: 'carmen-voice.ogg' }),
    });
    const bodyText = (await r.text()).slice(0, 300);
    // The gateway serves its SPA (HTML, 200) for unknown routes — treat as failure
    const isHtml = bodyText.trimStart().startsWith('<');
    if (!r.ok || isHtml) {
      console.error('[send-manus-wa-voice] gateway rejected', r.status, bodyText.slice(0, 120));
      return json({ error: 'gateway rejected voice send', status: r.status }, 502);
    }
    return json({ success: true, fileUrl });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
