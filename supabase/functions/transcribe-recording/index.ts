import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiTranscribe } from '../_shared/ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Audio is transcribed via OpenAI Whisper (~25MB per request ceiling).
// (above this we still try; failures bubble up clearly).
const MAX_INLINE_FILE_SIZE = 150 * 1024 * 1024;

// Map content-type -> Gemini audio format name
function geminiAudioFormat(mime: string): string {
  const m = mime.split(';')[0].trim().toLowerCase();
  if (m.includes('mp3') || m === 'audio/mpeg') return 'mp3';
  if (m.includes('wav')) return 'wav';
  if (m.includes('flac')) return 'flac';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('webm')) return 'webm';
  // mp4/m4a/aac and video/mp4 all decode as mp4 for Gemini
  return 'mp4';
}

function looksLikeTextContent(header: Uint8Array): boolean {
  const prefix = new TextDecoder().decode(header.slice(0, 20)).trim();
  return prefix.startsWith('<') || prefix.startsWith('{') || prefix.startsWith('[');
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
    const { recording_id } = await req.json();
    if (!recording_id) {
      return new Response(JSON.stringify({ error: 'recording_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    await setTranscriptionStatus(supabase, recording_id, 'processing');

    let audioBlob: Blob | null = null;
    let contentType = 'audio/mp4';

    // Case 1: Manual upload in Storage
    if (recording.file_path) {
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
      contentType = fileData.type || 'audio/mp4';
    }
    // Case 2: Zoom recording — prefer the smallest audio variant if available
    else if (recording.recording_url || recording.download_url) {
      // Prefer audio_only / audio_transcript siblings (smaller and faster)
      const { data: alternatives } = await supabase
        .from('zoom_recordings')
        .select('*')
        .eq('meeting_id', recording.meeting_id)
        .eq('tenant_id', recording.tenant_id)
        .in('recording_type', ['audio_only', 'audio_transcript']);

      const audioAlt = (alternatives || []).find(
        (alt: any) => alt.id !== recording.id && (alt.recording_url || alt.download_url),
      );

      const sourceRecording = audioAlt || recording;
      const result = await downloadZoomMedia(supabase, sourceRecording);
      if (result.error) {
        await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, result.error);
        return new Response(JSON.stringify({ error: result.error }), {
          status: result.status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      audioBlob = result.blob!;
      contentType = result.contentType!;
    } else {
      await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, 'No audio source');
      return new Response(JSON.stringify({ error: 'No audio file or URL found for this recording' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sizeMB = audioBlob.size / (1024 * 1024);
    console.log(`📦 Audio prepared: ${sizeMB.toFixed(1)}MB, type=${contentType}`);

    if (audioBlob.size > MAX_INLINE_FILE_SIZE) {
      const msg = `Audio too large (${sizeMB.toFixed(1)}MB). Maximum supported: ${Math.round(MAX_INLINE_FILE_SIZE / 1024 / 1024)}MB.`;
      await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, msg);
      return new Response(JSON.stringify({ error: msg }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate it's actually media
    const headerBytes = new Uint8Array(await audioBlob.slice(0, 32).arrayBuffer());
    if (looksLikeTextContent(headerBytes)) {
      const preview = new TextDecoder().decode(headerBytes);
      console.error('❌ Downloaded content is text, not media:', preview);
      await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, 'Downloaded content is text, not media');
      return new Response(JSON.stringify({
        error: 'invalid_media',
        message: 'תוכן ההקלטה שהתקבל אינו קובץ מדיה תקין. ייתכן שפג תוקף הקישור.',
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transcribe via Gemini
    const text = await transcribeWithGemini(audioBlob, contentType);
    await setTranscriptionStatus(supabase, recording_id, 'completed', text);

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.recording_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await setTranscriptionStatus(supabase, body.recording_id, 'failed', undefined, errMsg);
      }
    } catch (_) { /* best effort */ }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ── Transcription via OpenAI Whisper ──────────────────────────────────
async function transcribeWithGemini(audioBlob: Blob, contentType: string): Promise<string> {
  // Whisper caps a single request at ~25MB; larger recordings must be split upstream.
  const sizeMB = audioBlob.size / (1024 * 1024);
  if (sizeMB > 25) {
    throw new Error(`Recording too large to transcribe in one request (${sizeMB.toFixed(0)}MB > 25MB). Split it into shorter segments.`);
  }
  const ext = geminiAudioFormat(contentType) || 'mp3';
  console.log(`🎙️ Transcribing ${audioBlob.size} bytes via Whisper (ext=${ext})`);
  const text = await aiTranscribe(audioBlob, { language: 'he', filename: `recording.${ext}` });
  if (!text) throw new Error('Whisper returned empty transcription');
  return text;
}

// ── Helper: download media from Zoom ──────────────────────────────────
async function downloadZoomMedia(supabase: any, recording: any): Promise<{
  error?: string; status?: number; blob?: Blob; contentType?: string;
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
    return { error: `Zoom integration lookup failed: ${integrationError.message}`, status: 500 };
  }
  if (!integration) {
    return { error: 'לא נמצא חיבור Zoom פעיל. נא להגדיר את האינטגרציה בהגדרות.', status: 400 };
  }

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
      }
    } catch (_) { /* ignore */ }
  }

  const headers: Record<string, string> = {};
  if (zoomAccessToken) headers['Authorization'] = `Bearer ${zoomAccessToken}`;

  const recordingToken = typeof recording.recording_password === 'string' ? recording.recording_password : null;
  const queryTokens = [zoomAccessToken, recordingToken].filter(Boolean) as string[];
  let lastError = 'No Zoom URL candidates found';
  let sawUnauthorized = false;

  const tryDownloadFromUrl = async (baseUrl: string): Promise<{ blob?: Blob; contentType?: string; error?: string; unauthorized?: boolean }> => {
    const candidateUrls = [baseUrl];
    for (const token of queryTokens) {
      const sep = baseUrl.includes('?') ? '&' : '?';
      candidateUrls.push(`${baseUrl}${sep}access_token=${encodeURIComponent(token)}`);
    }

    for (const candidateUrl of [...new Set(candidateUrls)]) {
      const zoomResp = await fetch(candidateUrl, { headers });
      const responseType = (zoomResp.headers.get('content-type') || '').toLowerCase();

      if (!zoomResp.ok) {
        if (zoomResp.status === 401 || zoomResp.status === 403) sawUnauthorized = true;
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
      return { blob, contentType: ct };
    }
    return { error: lastError };
  };

  for (const baseUrl of zoomUrls) {
    const directResult = await tryDownloadFromUrl(baseUrl);
    if (directResult.blob) {
      return { blob: directResult.blob, contentType: directResult.contentType };
    }
  }

  // Self-heal: refresh URLs from Zoom recordings list
  if (sawUnauthorized && zoomAccessToken && recording.meeting_id) {
    try {
      const startTime = recording.start_time ? new Date(recording.start_time) : new Date();
      const fromDate = new Date(startTime.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const toDate = new Date(startTime.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const params = new URLSearchParams({ from: fromDate, to: toDate, page_size: '100' });
      const listResp = await fetch(`https://api.zoom.us/v2/users/me/recordings?${params}`, {
        headers: { Authorization: `Bearer ${zoomAccessToken}` },
      });

      if (listResp.ok) {
        const listData = await listResp.json();
        const meetings = Array.isArray(listData?.meetings) ? listData.meetings : [];
        const meetingIdStr = String(recording.meeting_id);
        const matchedMeeting = meetings.find((m: any) => String(m.id) === meetingIdStr || String(m.uuid) === meetingIdStr);

        if (matchedMeeting) {
          const files = Array.isArray(matchedMeeting.recording_files) ? matchedMeeting.recording_files : [];
          const targetType = String(recording.recording_type || '').toLowerCase();
          const exactType = files.filter((f: any) => String(f?.recording_type || '').toLowerCase() === targetType);
          const prioritized = [...exactType, ...files].filter(Boolean);

          const uniqueFreshUrls = [...new Set(
            prioritized.flatMap((f: any) => [f?.download_url, f?.play_url]).filter(Boolean),
          )] as string[];

          for (const freshUrl of uniqueFreshUrls) {
            const freshResult = await tryDownloadFromUrl(freshUrl);
            if (freshResult.blob) {
              await supabase
                .from('zoom_recordings')
                .update({ recording_url: freshUrl.split('?')[0] })
                .eq('id', recording.id);
              return { blob: freshResult.blob, contentType: freshResult.contentType };
            }
          }
          lastError = 'Found meeting but all fresh download URLs failed';
        } else {
          lastError = `Meeting ${meetingIdStr} not found in recent recordings list`;
        }
      } else {
        const errText = await listResp.text();
        lastError = `Zoom users/me/recordings API failed: ${listResp.status} ${errText.slice(0, 120)}`;
      }
    } catch (refreshErr) {
      lastError = `Zoom URL refresh failed: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}`;
    }
  }

  return { error: `Failed to download valid media from Zoom: ${lastError}`, status: 500 };
}
