import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_EDGE_FILE_SIZE = 25 * 1024 * 1024; // 25MB — safe for edge function memory

// ── Audio format normalization ────────────────────────────────
// Whisper requires a recognized file extension + MIME. Zoom often serves
// audio_only files as application/octet-stream which Whisper rejects.

const MIME_TO_EXT: Record<string, string> = {
  'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/m4a': '.m4a',
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3',
  'video/mp4': '.mp4',
  'audio/wav': '.wav', 'audio/x-wav': '.wav',
  'audio/webm': '.webm', 'video/webm': '.webm',
  'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/x-flac': '.flac',
};

const VALID_EXTENSIONS = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];

/** Detect MIME from magic bytes */
function detectMimeFromBytes(header: Uint8Array): string | null {
  // ftyp → MP4/M4A container
  if (header.length >= 8) {
    const str4 = String.fromCharCode(header[4], header[5], header[6], header[7]);
    if (str4 === 'ftyp') return 'audio/mp4';
  }
  // ID3 → MP3
  if (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) return 'audio/mpeg';
  // RIFF → WAV
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) return 'audio/wav';
  // OggS → OGG
  if (header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53) return 'audio/ogg';
  // fLaC → FLAC
  if (header[0] === 0x66 && header[1] === 0x4C && header[2] === 0x61 && header[3] === 0x43) return 'audio/flac';
  // WebM (starts with 0x1A45DFA3 — EBML header)
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) return 'audio/webm';
  // MP3 sync bytes (0xFF 0xFB/0xF3/0xF2)
  if (header[0] === 0xFF && (header[1] === 0xFB || header[1] === 0xF3 || header[1] === 0xF2)) return 'audio/mpeg';
  return null;
}

/** Check if first bytes look like HTML or JSON instead of media */
function looksLikeTextContent(header: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(header.slice(0, 20)).trim();
  return prefix.startsWith('<') || prefix.startsWith('{') || prefix.startsWith('[');
}

/** Map recording_type from Zoom to likely MIME */
function mimeFromRecordingType(recordingType: string | null): string {
  if (!recordingType) return 'audio/mp4';
  const rt = recordingType.toLowerCase();
  if (rt.includes('audio')) return 'audio/mp4'; // Zoom audio-only is M4A in MP4 container
  if (rt.includes('transcript')) return 'audio/mp4';
  return 'audio/mp4';
}

/**
 * Normalize a blob for Whisper: ensure correct MIME + extension.
 * Returns { blob, fileName, contentType } ready for FormData.
 */
function normalizeForWhisper(
  blob: Blob,
  rawContentType: string,
  recordingType: string | null,
  headerBytes: Uint8Array,
): { blob: Blob; fileName: string; contentType: string } {
  let mime = rawContentType.split(';')[0].trim().toLowerCase();
  console.log(`🔍 normalizeForWhisper — raw_content_type=${mime}, recording_type=${recordingType}`);

  // If octet-stream or empty, try magic bytes first, then recording_type
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
      // ── EARLY SIZE CHECK: prevent memory crash on large Zoom files ──
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
          return await processZoomRecording(supabase, smallAlt, mode, true);
        }

        return new Response(JSON.stringify({
          error: 'file_too_large',
          size_mb: Math.round(knownSize / 1024 / 1024),
          message: `הקובץ גדול מדי (${Math.round(knownSize / 1024 / 1024)}MB) ואין הקלטת אודיו חלופית קטנה יותר לפגישה הזו. נא להדביק תמלול ידנית.`,
          no_alternative: true,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // File is small enough or size unknown — proceed with download
      const result = await downloadZoomMedia(supabase, recording);
      if (result.error) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = result.blob!;
      fileName = result.fileName!;
      contentType = result.contentType!;

      // Post-download size check
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
          return await processZoomRecording(supabase, smallAlt, mode, true);
        }

        return new Response(JSON.stringify({
          error: 'file_too_large',
          size_mb: Math.round(audioBlob.size / 1024 / 1024),
          message: `הקובץ גדול מדי (${Math.round(audioBlob.size / 1024 / 1024)}MB). נא להדביק תמלול ידנית.`,
          no_alternative: true,
        }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'No audio file or URL found for this recording' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Normalize audio format before sending to Whisper ──
    const rawBytes = new Uint8Array(await audioBlob.arrayBuffer());

    // Guard: check if downloaded content is actually HTML/JSON (not media)
    if (looksLikeTextContent(rawBytes)) {
      const preview = new TextDecoder().decode(rawBytes.slice(0, 200));
      console.error('❌ Downloaded content is text, not media:', preview.slice(0, 100));
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

    return await transcribeBlob(audioBlob, fileName, contentType, mode);

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Helper: process a Zoom recording (used for fallback) ──────────────
async function processZoomRecording(supabase: any, recording: any, mode: string | undefined, isFallback: boolean) {
  const result = await downloadZoomMedia(supabase, recording);
  if (result.error) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const blob = result.blob!;
  const rawBytes = new Uint8Array(await blob.arrayBuffer());

  // Guard against text content
  if (looksLikeTextContent(rawBytes)) {
    return new Response(JSON.stringify({
      error: 'invalid_media',
      message: 'תוכן ההקלטה שהתקבל אינו קובץ מדיה תקין.',
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Normalize
  const normalized = normalizeForWhisper(
    new Blob([rawBytes], { type: result.contentType! }),
    result.contentType!,
    recording.recording_type || null,
    rawBytes.slice(0, 16),
  );

  const resp = await transcribeBlob(normalized.blob, normalized.fileName, normalized.contentType, mode);
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

  // Mint fresh Zoom token via Server-to-Server OAuth
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
async function transcribeBlob(audioBlob: Blob, fileName: string, contentType: string, mode: string | undefined) {
  const fileSizeMB = audioBlob.size / (1024 * 1024);
  console.log(`📦 File size: ${fileSizeMB.toFixed(1)}MB, fileName: ${fileName}, contentType: ${contentType}`);

  // Mode: download - return raw audio as base64 for client-side chunking
  if (mode === 'download') {
    if (audioBlob.size > MAX_EDGE_FILE_SIZE) {
      return new Response(JSON.stringify({
        error: 'file_too_large',
        size_mb: Math.round(fileSizeMB),
        message: `הקובץ גדול מדי (${Math.round(fileSizeMB)}MB) לעיבוד בשרת.`,
        no_alternative: true,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
}
