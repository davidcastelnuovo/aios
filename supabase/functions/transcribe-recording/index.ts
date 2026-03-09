import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_EDGE_FILE_SIZE = 25 * 1024 * 1024; // 25MB — safe for edge function memory

// ── Audio format normalization ────────────────────────────────

const MIME_TO_EXT: Record<string, string> = {
  'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/m4a': '.m4a',
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3',
  'video/mp4': '.mp4',
  'audio/wav': '.wav', 'audio/x-wav': '.wav',
  'audio/webm': '.webm', 'video/webm': '.webm',
  'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/x-flac': '.flac',
};

const VALID_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];

function detectMimeFromBytes(header: Uint8Array): string | null {
  if (header.length >= 8) {
    const str4 = String.fromCharCode(header[4], header[5], header[6], header[7]);
    if (str4 === 'ftyp') return 'audio/mp4';
  }
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) return 'audio/mpeg';
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return 'audio/wav';
  if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) return 'audio/ogg';
  if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) return 'audio/flac';
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) return 'audio/webm';
  if (header[0] === 0xFF && (header[1] === 0xFB || header[1] === 0xF3 || header[1] === 0xF2)) return 'audio/mpeg';
  return null;
}

function looksLikeTextContent(header: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(header.slice(0, 20)).trim();
  return prefix.startsWith('<') || prefix.startsWith('{') || prefix.startsWith('[');
}

function mimeFromRecordingType(recordingType: string | null): string {
  if (!recordingType) return 'audio/mp4';
  const rt = recordingType.toLowerCase();
  if (rt.includes('audio')) return 'audio/mp4';
  if (rt.includes('transcript')) return 'audio/mp4';
  return 'audio/mp4';
}

function normalizeForWhisper(
  blob: Blob,
  rawContentType: string,
  recordingType: string | null,
  headerBytes: Uint8Array,
): { blob: Blob; fileName: string; contentType: string } {
  let mime = rawContentType.split(';')[0].trim().toLowerCase();
  console.log(`🔍 normalizeForWhisper — raw_content_type=${mime}, recording_type=${recordingType}`);

  if (!mime || mime === 'application/octet-stream' || !MIME_TO_EXT[mime]) {
    const detected = detectMimeFromBytes(headerBytes);
    if (detected) {
      mime = detected;
      console.log(`  → detected via magic bytes: ${mime}`);
    } else {
      mime = mimeFromRecordingType(recordingType);
      console.log(`  → inferred from recording_type: ${mime}`);
    }
  }

  const ext = MIME_TO_EXT[mime] || '.m4a';
  const fileName = `recording${ext}`;
  const normalizedBlob = new Blob([blob], { type: mime });
  console.log(`  → final: mime=${mime}, fileName=${fileName}`);
  return { blob: normalizedBlob, fileName, contentType: mime };
}

// ── DB status helpers ─────────────────────────────────────────

async function setTranscriptionStatus(
  supabase: any,
  recordingId: string,
  status: string,
  transcription?: string,
  error?: string,
) {
  const update: any = { transcription_status: status };
  if (transcription !== undefined) update.transcription = transcription;
  if (error !== undefined) update.transcription_error = error;
  
  const { error: dbError } = await supabase
    .from('zoom_recordings')
    .update(update)
    .eq('id', recordingId);
  
  if (dbError) console.error('⚠️ Failed to update transcription status:', dbError.message);
}

// ── Main handler ──────────────────────────────────────────────

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

    // Mark as processing
    await setTranscriptionStatus(supabase, recording_id, 'processing');

    let audioBlob: Blob | null = null;
    let fileName = 'audio.mp4';
    let contentType = 'audio/mp4';
    let recordingType: string | null = recording.recording_type || null;

    // Case 1: Manual recording with file in Storage
    if (recording.file_path) {
      console.log('📂 Downloading from Storage:', recording.file_path);
      const { data: fileData, error: dlError } = await supabase.storage
        .from('recordings')
        .download(recording.file_path);

      if (dlError || !fileData) {
        await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, 'Failed to download from storage');
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
      const knownSize = typeof recording.file_size === 'number' ? recording.file_size : null;

      if (knownSize && knownSize > MAX_EDGE_FILE_SIZE) {
        console.log(`⚠️ Recording too large (${(knownSize / 1024 / 1024).toFixed(1)}MB). Searching for smaller audio-only alternative...`);

        const { data: alternatives } = await supabase
          .from('zoom_recordings')
          .select('*')
          .eq('meeting_id', recording.meeting_id)
          .eq('tenant_id', recording.tenant_id)
          .neq('id', recording.id)
          .in('recording_type', ['audio_only', 'audio_transcript'])
          .order('file_size', { ascending: true });

        const smallAlt = alternatives?.find(
          (alt: any) => typeof alt.file_size === 'number' && alt.file_size <= MAX_EDGE_FILE_SIZE && alt.file_size > 0
        );

        if (smallAlt) {
          console.log(`✅ Found smaller alternative: ${smallAlt.recording_type} (${(smallAlt.file_size / 1024 / 1024).toFixed(1)}MB)`);
          return await processZoomRecording(supabase, smallAlt, mode, true, recording_id);
        }

        // No small alternative — stream large file to Storage for client-side chunking
        console.log(`📤 No small alternative. Streaming ${(knownSize / 1024 / 1024).toFixed(1)}MB to Storage for client-side chunking...`);
        const streamResult = await streamZoomToStorage(supabase, recording, recording_id);
        if (streamResult.error) {
          await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, streamResult.error);
          return new Response(JSON.stringify({ error: streamResult.error }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({
          audio_url: streamResult.signedUrl,
          content_type: streamResult.contentType,
          file_name: streamResult.fileName,
          size_mb: Math.round(knownSize / 1024 / 1024),
          needs_chunking: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const result = await downloadZoomMedia(supabase, recording);
      if (result.error) {
        await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, result.error);
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = result.blob!;
      fileName = result.fileName!;
      contentType = result.contentType!;

      if (audioBlob.size > MAX_EDGE_FILE_SIZE) {
        console.log(`⚠️ Downloaded file is ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB — too large`);
        const { data: alternatives } = await supabase
          .from('zoom_recordings')
          .select('*')
          .eq('meeting_id', recording.meeting_id)
          .eq('tenant_id', recording.tenant_id)
          .neq('id', recording.id)
          .in('recording_type', ['audio_only', 'audio_transcript'])
          .order('file_size', { ascending: true });

        const smallAlt = alternatives?.find(
          (alt: any) => typeof alt.file_size === 'number' && alt.file_size <= MAX_EDGE_FILE_SIZE && alt.file_size > 0
        );

        if (smallAlt) {
          return await processZoomRecording(supabase, smallAlt, mode, true, recording_id);
        }

        // No small alternative — upload the already-downloaded blob to Storage for client-side chunking
        console.log(`📤 No small alternative. Uploading ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB to Storage for client-side chunking...`);
        const ext = (fileName.split('.').pop() || 'm4a').toLowerCase();
        const tempPath = `transcription-temp/${recording_id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(tempPath, audioBlob, { contentType, upsert: true });

        if (uploadError) {
          await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, `Upload failed: ${uploadError.message}`);
          return new Response(JSON.stringify({ error: `Failed to upload for chunking: ${uploadError.message}` }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: signedData } = await supabase.storage
          .from('recordings')
          .createSignedUrl(tempPath, 60 * 60);

        return new Response(JSON.stringify({
          audio_url: signedData?.signedUrl,
          content_type: contentType,
          file_name: fileName,
          size_mb: Math.round(audioBlob.size / 1024 / 1024),
          needs_chunking: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, 'No audio source');
      return new Response(JSON.stringify({ error: 'No audio file or URL found for this recording' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Normalize audio format before sending to Whisper ──
    const rawBytes = new Uint8Array(await audioBlob.arrayBuffer());

    if (looksLikeTextContent(rawBytes)) {
      const preview = new TextDecoder().decode(rawBytes.slice(0, 200));
      console.error('❌ Downloaded content is text, not media:', preview.slice(0, 100));
      await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, 'Downloaded content is text, not media');
      return new Response(JSON.stringify({
        error: 'invalid_media',
        message: 'תוכן ההקלטה שהתקבל אינו קובץ מדיה תקין. ייתכן שפג תוקף הקישור.',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalized = normalizeForWhisper(
      new Blob([rawBytes], { type: contentType }),
      contentType,
      recordingType,
      rawBytes.slice(0, 16),
    );
    audioBlob = normalized.blob;
    fileName = normalized.fileName;
    contentType = normalized.contentType;

    return await transcribeBlob(supabase, recording_id, audioBlob, fileName, contentType, mode, recordingType);

  } catch (error) {
    console.error('❌ Error:', error);
    // Try to update status on unexpected errors
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.recording_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await setTranscriptionStatus(supabase, body.recording_id, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
      }
    } catch (_) { /* best effort */ }
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Helper: process a Zoom recording (used for fallback) ──────────────
async function processZoomRecording(supabase: any, recording: any, mode: string | undefined, isFallback: boolean, originalRecordingId?: string) {
  const result = await downloadZoomMedia(supabase, recording);
  if (result.error) {
    if (originalRecordingId) await setTranscriptionStatus(supabase, originalRecordingId, 'failed', undefined, result.error);
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const blob = result.blob!;
  const rawBytes = new Uint8Array(await blob.arrayBuffer());

  if (looksLikeTextContent(rawBytes)) {
    if (originalRecordingId) await setTranscriptionStatus(supabase, originalRecordingId, 'failed', undefined, 'Downloaded content is text');
    return new Response(JSON.stringify({
      error: 'invalid_media',
      message: 'תוכן ההקלטה שהתקבל אינו קובץ מדיה תקין.',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const normalized = normalizeForWhisper(
    new Blob([rawBytes], { type: result.contentType! }),
    result.contentType!,
    recording.recording_type || null,
    rawBytes.slice(0, 16),
  );

  // Use the original recording ID for DB persistence
  const persistId = originalRecordingId || recording.id;
  const resp = await transcribeBlob(supabase, persistId, normalized.blob, normalized.fileName, normalized.contentType, mode, recording.recording_type || null);
  if (isFallback) {
    const body = await resp.json();
    body.used_fallback = true;
    body.fallback_recording_type = recording.recording_type;
    body.fallback_size_mb = blob.size / 1024 / 1024;
    return new Response(JSON.stringify(body), {
      status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return resp;
}

// ── Helper: download media from Zoom ──────────────────────────────────
async function downloadZoomMedia(supabase: any, recording: any): Promise<{
  error?: string; status?: number; blob?: Blob; fileName?: string; contentType?: string;
}> {
  const rawUrls = [recording.download_url, recording.recording_url].filter(Boolean) as string[];
  const expandedUrls = rawUrls.flatMap((url) => {
    const variants = [url];
    if (url.includes('/play/')) variants.unshift(url.replace('/play/', '/download/'));
    if (url.includes('/rec/play/')) variants.unshift(url.replace('/rec/play/', '/rec/download/'));
    return variants;
  });
  const zoomUrls = [...new Set(expandedUrls)];

  const { data: integration, error: integrationError } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', recording.tenant_id)
    .eq('integration_type', 'zoom')
    .eq('is_active', true)
    .maybeSingle();

  if (integrationError) {
    console.error('❌ Failed to fetch Zoom integration:', integrationError.message);
    return { error: `Zoom integration lookup failed: ${integrationError.message}`, status: 500 };
  }

  if (!integration) {
    console.error('❌ No active Zoom integration found for tenant:', recording.tenant_id);
    return { error: 'לא נמצא חיבור Zoom פעיל. נא להגדיר את האינטגרציה בהגדרות.', status: 400 };
  }

  let headers: Record<string, string> = {};
  const settings = (integration.settings || {}) as any;
  let zoomAccessToken: string | null = settings.access_token || null;

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
        await zoomResp.text();
        continue;
      }

      if (responseType.includes('text/html') || responseType.includes('application/json')) {
        const preview = (await zoomResp.text()).slice(0, 180);
        lastError = `Non-media response (${responseType}): ${preview}`;
        continue;
      }

      const blob = await zoomResp.blob();
      const ct = zoomResp.headers.get('content-type') || blob.type || 'application/octet-stream';
      return { blob, fileName: 'zoom_recording', contentType: ct };
    }
  }

  return { error: `Failed to download valid media from Zoom: ${lastError}`, status: 500 };
}

// ── Helper: transcribe a blob (shared logic) ─────────────────────────
async function transcribeBlob(supabase: any, recordingId: string, audioBlob: Blob, fileName: string, contentType: string, mode: string | undefined, recordingType?: string | null) {
  const fileSizeMB = audioBlob.size / (1024 * 1024);
  console.log(`📦 File size: ${fileSizeMB.toFixed(1)}MB, fileName: ${fileName}, contentType: ${contentType}`);

  // Mode: download - return audio reference for client-side chunking
  // For large files, avoid base64 conversion (can exceed edge memory); upload temp file and return signed URL.
  if (mode === 'download') {
    console.log(`📥 Download mode — preparing ${fileSizeMB.toFixed(1)}MB for client-side chunking`);

    const ext = (fileName.split('.').pop() || 'm4a').toLowerCase();
    const tempPath = `transcription-temp/${recordingId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(tempPath, audioBlob, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Failed to upload temp audio for chunking:', uploadError.message);
      return new Response(JSON.stringify({
        error: 'download_prepare_failed',
        message: `Failed to prepare audio for chunking: ${uploadError.message}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from('recordings')
      .createSignedUrl(tempPath, 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      console.error('❌ Failed to create signed URL for temp audio:', signedError?.message || 'unknown');
      return new Response(JSON.stringify({
        error: 'download_prepare_failed',
        message: 'Failed to create temporary download URL for chunking',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      audio_url: signedData.signedUrl,
      content_type: contentType,
      file_name: fileName,
      size_mb: fileSizeMB,
      source_recording_type: recordingType || 'unknown',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Mode: transcribe directly (small files only — lowered to 15MB to avoid Whisper timeouts)
  if (fileSizeMB > 15) {
    return new Response(JSON.stringify({
      error: 'file_too_large',
      size_mb: fileSizeMB,
      message: 'הקובץ גדול מ-15MB. משתמש בתמלול מחולק...'
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    await setTranscriptionStatus(supabase, recordingId, 'failed', undefined, 'OpenAI API key not configured');
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  console.log('🎤 Transcribing audio directly...');

  const whisperForm = new FormData();
  whisperForm.append('file', audioBlob, fileName);
  whisperForm.append('model', 'whisper-1');
  whisperForm.append('language', 'he');

  // AbortController with 120s timeout guard to prevent stuck "processing" state
  const whisperController = new AbortController();
  const whisperTimeout = setTimeout(() => whisperController.abort(), 120_000);

  let whisperResp: Response;
  try {
    whisperResp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}` },
      body: whisperForm,
      signal: whisperController.signal,
    });
  } catch (abortErr: any) {
    clearTimeout(whisperTimeout);
    const isTimeout = abortErr.name === 'AbortError';
    const errMsg = isTimeout ? 'Whisper API timed out after 120s' : (abortErr.message || 'Unknown fetch error');
    console.error('❌ Whisper fetch error:', errMsg);
    await setTranscriptionStatus(supabase, recordingId, 'failed', undefined, errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    clearTimeout(whisperTimeout);
  }

  if (!whisperResp.ok) {
    const errText = await whisperResp.text();
    console.error('❌ Whisper error:', whisperResp.status, errText);
    await setTranscriptionStatus(supabase, recordingId, 'failed', undefined, `Whisper error: ${errText.slice(0, 200)}`);
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

  // ── PERSIST to DB ──
  await setTranscriptionStatus(supabase, recordingId, 'completed', transcribedText);
  console.log('✅ Transcription saved to DB for recording:', recordingId);

  return new Response(JSON.stringify({ text: transcribedText }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
