// Carmen voice-OUT for the in-app chat. Takes text, returns spoken audio bytes
// (MP3 — universally playable by the browser <audio> element). The frontend
// calls this to let Carmen "talk back" in the internal chat.
//
// POST body: { text: string, voice?: string }
// Response: audio/mpeg bytes (or JSON error).
import { aiSpeak } from '../_shared/ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strip markdown / emoji noise so the TTS reads clean prose, not syntax.
function cleanForSpeech(raw: string): string {
  return (raw || '')
    .replace(/```[\s\S]*?```/g, ' ')          // code blocks
    .replace(/`([^`]+)`/g, '$1')               // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')   // links → keep label
    .replace(/[*_#>~|]/g, ' ')                  // md punctuation
    .replace(/\s{2,}/g, ' ')
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { text, voice } = await req.json();
    const clean = cleanForSpeech(typeof text === 'string' ? text : '');
    if (!clean) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // mp3 plays everywhere; shimmer reads Hebrew naturally (matches Carmen's WA voice).
    const audio = await aiSpeak(clean, { voice: voice || 'shimmer', format: 'mp3' });
    if (!audio) {
      return new Response(JSON.stringify({ error: 'TTS failed (check OPENAI_API_KEY)' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(audio, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
