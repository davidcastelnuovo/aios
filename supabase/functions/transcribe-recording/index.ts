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
    const { recording_id, mode } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
    let contentType = 'audio/mp4';

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
      contentType = fileData.type || 'audio/mp4';
    }
    // Case 2: Zoom recording with URL
    else if (recording.recording_url || recording.download_url) {
      const rawUrls = [recording.download_url, recording.recording_url].filter(Boolean) as string[];
      const expandedUrls = rawUrls.flatMap((url) => {
        const variants = [url];
        if (url.includes('/play/')) variants.unshift(url.replace('/play/', '/download/'));
        if (url.includes('/rec/play/')) variants.unshift(url.replace('/rec/play/', '/rec/download/'));
        return variants;
      });
      const zoomUrls = [...new Set(expandedUrls)];

      const { data: integration } = await supabase
        .from('tenant_integrations')
        .select('config, settings')
        .eq('tenant_id', recording.tenant_id)
        .eq('integration_type', 'zoom')
        .eq('is_active', true)
        .single();

      let headers: Record<string, string> = {};
      const settings = (integration?.settings || {}) as any;
      const config = (integration?.config || {}) as any;
      let zoomAccessToken: string | null = config.access_token || settings.access_token || null;

      // Fallback: mint fresh Zoom token via Server-to-Server OAuth
      if (!zoomAccessToken && settings.client_id && settings.client_secret && settings.account_id) {
        try {
          const tokenResp = await fetch('https://zoom.us/oauth/token', {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${settings.client_id}:${settings.client_secret}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: 'account_credentials',
              account_id: settings.account_id,
            }),
          });

          if (tokenResp.ok) {
            const tokenData = await tokenResp.json();
            zoomAccessToken = tokenData?.access_token || null;
            console.log('✅ Minted fresh Zoom access token');
          } else {
            const errText = await tokenResp.text();
            console.log('⚠️ Failed to mint fresh Zoom token:', errText.slice(0, 180));
          }
        } catch (e) {
          console.log('⚠️ Zoom token mint error:', e instanceof Error ? e.message : String(e));
        }
      }

      if (zoomAccessToken) headers['Authorization'] = `Bearer ${zoomAccessToken}`;

      const recordingToken = typeof recording.recording_password === 'string' ? recording.recording_password : null;
      const queryTokens = [zoomAccessToken, recordingToken].filter(Boolean) as string[];
      let lastError = 'No Zoom URL candidates found';

      for (const baseUrl of zoomUrls) {
        const candidateUrls = [baseUrl];
        for (const token of queryTokens) {
          const sep = baseUrl.includes('?') ? '&' : '?';
          candidateUrls.push(`${baseUrl}${sep}access_token=${encodeURIComponent(token)}`);
        }

        for (const candidateUrl of [...new Set(candidateUrls)]) {
          console.log('🔗 Trying Zoom URL:', candidateUrl.split('?')[0]);
          const zoomResp = await fetch(candidateUrl, { headers });
          const responseType = (zoomResp.headers.get('content-type') || '').toLowerCase();

          if (!zoomResp.ok) {
            lastError = `HTTP ${zoomResp.status} from Zoom`;
            continue;
          }

          if (responseType.includes('text/html') || responseType.includes('application/json')) {
            const preview = (await zoomResp.text()).slice(0, 180);
            lastError = `Non-media response (${responseType}): ${preview}`;
            continue;
          }

          audioBlob = await zoomResp.blob();
          fileName = 'zoom_recording.mp4';
          contentType = zoomResp.headers.get('content-type') || audioBlob.type || 'audio/mp4';
          break;
        }

        if (audioBlob) break;
      }

      if (!audioBlob) {
        return new Response(JSON.stringify({ error: `Failed to download valid media from Zoom: ${lastError}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'No audio file or URL found for this recording' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const fileSizeMB = audioBlob.size / (1024 * 1024);
    console.log(`📦 File size: ${fileSizeMB.toFixed(1)}MB`);

    // Ensure fileName has a recognized extension for Whisper API
    const validExtensions = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
    const mimeToExt: Record<string, string> = {
      'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3', 'video/mp4': '.mp4', 'audio/wav': '.wav',
      'audio/x-wav': '.wav', 'audio/webm': '.webm', 'video/webm': '.webm',
      'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/x-flac': '.flac',
    };
    const hasValidExt = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      const mapped = mimeToExt[contentType] || '.mp4';
      fileName = fileName.replace(/\.[^.]*$/, '') + mapped;
      if (!fileName.includes('.')) fileName += mapped;
    }
    console.log(`📎 fileName for Whisper: ${fileName}, contentType: ${contentType}`);

    // Mode: download - return raw audio as base64 for client-side chunking
    if (mode === 'download') {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      return new Response(JSON.stringify({ 
        audio_base64: base64, 
        content_type: contentType,
        file_name: fileName,
        size_mb: fileSizeMB,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode: transcribe directly (small files only)
    if (fileSizeMB > 25) {
      return new Response(JSON.stringify({ 
        error: 'file_too_large',
        size_mb: fileSizeMB,
        message: 'הקובץ גדול מ-25MB. משתמש בתמלול מחולק...'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎤 Transcribing audio directly...');

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
