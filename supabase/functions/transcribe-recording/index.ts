import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recording
    const { data: recording, error: recError } = await supabase
      .from('zoom_recordings')
      .select('*')
      .eq('id', recording_id)
      .single();

    if (recError || !recording) {
      return new Response(JSON.stringify({ error: 'Recording not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let audioBlob: Blob | null = null;
    let fileName = 'audio.mp4';

    // Case 1: Manual recording with file in Storage
    if (recording.file_path) {
      console.log('📂 Downloading from Storage:', recording.file_path);
      const { data: fileData, error: dlError } = await supabase.storage
        .from('recordings')
        .download(recording.file_path);

      if (dlError || !fileData) {
        return new Response(JSON.stringify({ error: 'Failed to download file from storage: ' + (dlError?.message || 'unknown') }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = fileData;
      fileName = recording.file_path.split('/').pop() || 'audio.mp4';
    }
    // Case 2: Zoom recording with URL
    else if (recording.recording_url || recording.download_url) {
      const downloadUrl = recording.download_url || recording.recording_url;
      console.log('🔗 Downloading from Zoom URL');

      // Get Zoom access token from tenant_integrations
      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('config')
        .eq('tenant_id', recording.tenant_id)
        .eq('integration_type', 'zoom')
        .eq('is_active', true)
        .single();

      let headers: Record<string, string> = {};
      if (integration?.config) {
        const config = integration.config as any;
        if (config.access_token) {
          headers['Authorization'] = `Bearer ${config.access_token}`;
        }
      }

      const zoomResp = await fetch(downloadUrl, { headers });
      if (!zoomResp.ok) {
        return new Response(JSON.stringify({ error: `Failed to download from Zoom: ${zoomResp.status}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = await zoomResp.blob();
      fileName = 'zoom_recording.mp4';
    } else {
      return new Response(JSON.stringify({ error: 'No audio file or URL found for this recording' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check file size (Whisper limit: 25MB)
    if (audioBlob.size > 25 * 1024 * 1024) {
      return new Response(JSON.stringify({ 
        error: 'הקובץ גדול מ-25MB. Whisper תומך עד 25MB. נסה להדביק תמלול ידנית.' 
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎤 Transcribing audio, size:', audioBlob.size);

    // Send to Whisper API
    const whisperForm = new FormData();
    whisperForm.append('file', audioBlob, fileName);
    whisperForm.append('model', 'whisper-1');
    whisperForm.append('language', 'he');

    const whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}` },
      body: whisperForm,
    });

    if (!whisperResp.ok) {
      const errText = await whisperResp.text();
      console.error('❌ Whisper error:', whisperResp.status, errText);
      return new Response(JSON.stringify({ error: `Transcription failed: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whisperResult = await whisperResp.json();
    let transcribedText = whisperResult.text;
    console.log('✅ Transcription done, length:', transcribedText?.length);

    // Post-process with GPT to fix spelling
    if (transcribedText && transcribedText.length > 0) {
      try {
        console.log('🔧 Fixing spelling with GPT...');
        const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'אתה עוזר שמתקן שגיאות כתיב בעברית. תקבל טקסט שתומלל מהקלטת פגישה ותחזיר אותו מתוקן. אל תשנה את המשמעות או המבנה, רק תקן שגיאות כתיב וסימני פיסוק. החזר רק את הטקסט המתוקן, ללא הסברים.'
              },
              { role: 'user', content: transcribedText }
            ],
            temperature: 0.3,
            max_tokens: 4000,
          }),
        });

        if (gptResp.ok) {
          const gptResult = await gptResp.json();
          transcribedText = gptResult.choices?.[0]?.message?.content || transcribedText;
          console.log('✅ Spelling correction done');
        }
      } catch (e) {
        console.error('⚠️ GPT correction failed, using raw:', e);
      }
    }

    return new Response(JSON.stringify({ text: transcribedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
