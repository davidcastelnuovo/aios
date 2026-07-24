// Carmen voice-OUT for the in-app chat. Takes text, returns spoken audio bytes
// (MP3 — universally playable by the browser <audio> element). The frontend
// calls this to let Carmen "talk back" in the internal chat.
//
// POST body: { text: string, voice?: string, provider?: 'openai' | 'elevenlabs', instructions?: string }
// Response: audio/mpeg bytes (or JSON error).
import { aiSpeak } from '../_shared/ai.ts';
import { getCaller, getUserOpenAIKey } from '../_shared/userKey.ts';

// Users with a personal key are billed on it; these owners may use the org key.
const ORG_KEY_ALLOWLIST = ['david.castelnuovo@gmail.com'];
const OPENAI_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx',
  'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);

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
    const selectedVoice = typeof voice === 'string' && OPENAI_VOICES.has(voice) ? voice : 'marin';
    const clean = cleanForSpeech(typeof text === 'string' ? text : '');
    if (!clean) {
      return new Response(JSON.stringify({ error: 'text is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Personal-key users are billed on their own key; org key only for owners.
    const caller = await getCaller(req.headers.get('Authorization') || '');
    const userKey = caller ? await getUserOpenAIKey(caller.id) : null;
    if (!userKey && !(caller && ORG_KEY_ALLOWLIST.includes(caller.email))) {
      return new Response(JSON.stringify({ error: 'personal_key_required', message: 'כדי להשתמש בקול של כרמן יש להזין API key אישי בפרופיל' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // mp3 plays everywhere; marin = the same voice as Carmen's live (Realtime)
    // conversations, so typed chat and voice chat sound like one person.
    // marin is newer than most TTS voices — if the TTS endpoint rejects it,
    // retry with shimmer rather than going silent.
    const ttsOpts = {
      format: 'mp3' as const,
      instructions: typeof instructions === 'string' && instructions ? instructions : HEBREW_STEERING,
      ...(userKey ? { key: userKey } : {}),
    };
    let audio: Uint8Array | null = null;
    if (provider === 'elevenlabs' && !userKey) audio = await elevenSpeak(clean);
    if (!audio) audio = await aiSpeak(clean, { ...ttsOpts, voice: selectedVoice });
    if (!audio && selectedVoice === 'marin') {
      console.warn('[carmen-speak] marin failed, falling back to shimmer');
      audio = await aiSpeak(clean, { ...ttsOpts, voice: 'shimmer' });
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
