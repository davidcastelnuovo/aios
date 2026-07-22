// Carmen voice-OUT for the in-app chat. Takes text, returns spoken audio bytes
// (MP3 — universally playable by the browser <audio> element). The frontend
// calls this to let Carmen "talk back" in the internal chat.
//
// POST body: { text: string, voice?: string, provider?: 'openai' | 'elevenlabs', instructions?: string }
// Response: audio/mpeg bytes (or JSON error).
import { aiSpeak } from '../_shared/ai.ts';

// Style steering for gpt-4o-mini-tts — native-sounding Israeli Hebrew.
const HEBREW_STEERING =
  'Speak natural, warm Israeli Hebrew with a native accent. ' +
  'Sound like a sharp, friendly assistant: direct, confident, lightly upbeat. ' +
  'Natural conversational pacing, short pauses between sentences, never robotic.';

// Optional premium voice via ElevenLabs (uses the existing ELEVENLABS_API_KEY).
// Enabled per-request with provider:'elevenlabs'; falls back to OpenAI on failure.
async function elevenSpeak(text: string): Promise<Uint8Array | null> {
  const key = Deno.env.get('ELEVENLABS_API_KEY');
  if (!key) return null;
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 4000), model_id: 'eleven_multilingual_v2' }),
      },
    );
    if (!r.ok) {
      console.error('[carmen-speak] elevenlabs error', r.status, (await r.text()).slice(0, 200));
      return null;
    }
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

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
    const { text, voice, provider, instructions } = await req.json();
    const clean = cleanForSpeech(typeof text === 'string' ? text : '');
    if (!clean) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // mp3 plays everywhere; shimmer reads Hebrew naturally (matches Carmen's WA voice).
    let audio: Uint8Array | null = null;
    if (provider === 'elevenlabs') audio = await elevenSpeak(clean);
    if (!audio) {
      audio = await aiSpeak(clean, {
        voice: voice || 'shimmer',
        format: 'mp3',
        instructions: typeof instructions === 'string' && instructions ? instructions : HEBREW_STEERING,
      });
    }
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
