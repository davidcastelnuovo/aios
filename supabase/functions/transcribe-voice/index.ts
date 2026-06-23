import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function geminiAudioFormat(mime: string): string {
  const m = (mime || '').split(';')[0].trim().toLowerCase();
  if (m.includes('mp3') || m === 'audio/mpeg') return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('flac')) return 'flac';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('webm')) return 'webm';
  return 'mp4';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    // OpenAI Whisper transcription (multipart upload). Hebrew hinted via language.
    const whisperForm = new FormData();
    whisperForm.append('file', audioFile, audioFile.name || `audio.${geminiAudioFormat(audioFile.type || 'audio/webm')}`);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'he');
    whisperForm.append('response_format', 'json');

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: whisperForm,
        signal: controller.signal,
      });
    } catch (abortErr: any) {
      clearTimeout(timeout);
      const isTimeout = abortErr.name === 'AbortError';
      const errMsg = isTimeout ? 'Whisper transcription timed out' : (abortErr.message || 'Unknown fetch error');
      console.error('❌ Whisper fetch error:', errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Whisper transcription error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please retry' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `Transcription failed: ${errorText.slice(0, 300)}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const text = (result?.text || '').trim();

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in transcribe-voice:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
