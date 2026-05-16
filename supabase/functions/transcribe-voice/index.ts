import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode as base64Encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

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

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bytes = new Uint8Array(await audioFile.arrayBuffer());
    const base64 = base64Encode(bytes);
    const format = geminiAudioFormat(audioFile.type || 'audio/webm');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180_000);

    let response: Response;
    try {
      response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Lovable-API-Key': apiKey,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'אתה מתמלל מקצועי. תמלל את ההקלטה במלואה בעברית, במדויק וללא תוספות. החזר אך ורק את הטקסט המתומלל, ללא הקדמות או הסברים.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'תמלל את ההקלטה:' },
                { type: 'input_audio', input_audio: { data: base64, format } },
              ],
            },
          ],
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
    } catch (abortErr: any) {
      clearTimeout(timeout);
      const isTimeout = abortErr.name === 'AbortError';
      const errMsg = isTimeout ? 'Gemini transcription timed out' : (abortErr.message || 'Unknown fetch error');
      console.error('❌ Gemini fetch error:', errMsg);
      return new Response(JSON.stringify({ error: errMsg }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini transcription error:', response.status, errorText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please retry' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `Transcription failed: ${errorText.slice(0, 300)}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const text = (result?.choices?.[0]?.message?.content || '').trim();

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
