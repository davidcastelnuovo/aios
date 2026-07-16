// redeploy trigger: rebundle _shared/ai.ts OpenAI key fallback (env secret → llm integration)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiDiarizeTranscribe, aiTranscribe, aiTranscribeVerbose } from '../_shared/ai.ts';

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

    // Case 0: Pre-segmented transcription audio (extension recordings) — each
    // part is a standalone file under the Whisper cap. Mic and system audio are
    // separate channels (…_mic_partN / …_sys_partN), so speaker attribution is
    // a physical fact, not a guess: mic = the recording user, sys = everyone else.
    const audioParts: string[] = Array.isArray(recording.audio_file_paths)
      ? recording.audio_file_paths.filter(Boolean)
      : [];
    if (audioParts.length > 0) {
      try {
        const text = await transcribeChannelParts(supabase, recording_id, audioParts);
        await setTranscriptionStatus(supabase, recording_id, 'completed', text);
        return new Response(JSON.stringify({ text }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (segErr) {
        const msg = segErr instanceof Error ? segErr.message : String(segErr);
        await setTranscriptionStatus(supabase, recording_id, 'failed', undefined, msg);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let audioBlob: Blob | null = null;
    let contentType = 'audio/mp4';

    // Case 1: Manual upload in Storage — prefer the low-bitrate audio sibling
    // (chrome_extension recordings) so long meetings stay under the Whisper cap.
    if (recording.file_path || recording.audio_file_path) {
      const storagePath = recording.audio_file_path || recording.file_path;
      const { data: fileData, error: dlError } = await supabase.storage
        .from('recordings')
        .download(storagePath);

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

    // Transcribe — splitting oversized files into Whisper-sized chunks when the format allows
    const text = await transcribeBlob(supabase, recording_id, audioBlob, contentType);
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

const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
// Chunk target leaves headroom under the cap (mid-frame slice points, headers).
const CHUNK_TARGET_BYTES = 20 * 1024 * 1024;

async function whisperTranscribe(audioBlob: Blob, contentType: string): Promise<string> {
  const sizeMB = audioBlob.size / (1024 * 1024);
  if (audioBlob.size > WHISPER_MAX_BYTES) {
    throw new Error(`Recording too large to transcribe in one request (${sizeMB.toFixed(0)}MB > 25MB). Split it into shorter segments.`);
  }
  const ext = geminiAudioFormat(contentType) || 'mp3';
  console.log(`🎙️ Transcribing ${audioBlob.size} bytes via Whisper (ext=${ext})`);
  const text = await aiTranscribe(audioBlob, { language: 'he', filename: `recording.${ext}` });
  if (!text) throw new Error('Whisper returned empty transcription');
  return text;
}

// ── Channel-aware segmented transcription ─────────────────────────────
// Parts follow the extension's naming convention:
//   {tenant}/{ts}_mic_partN.webm  → the recording user's microphone
//   {tenant}/{ts}_sys_partN.webm  → system/tab audio (other participants)
//   {tenant}/{ts}_audio_partN.webm → legacy mixed channel (no speakers)
// Each channel's parts are consecutive slices of the same timeline; Whisper's
// verbose_json gives per-segment timings which we shift by the cumulative
// duration of earlier parts, then interleave channels into a speaker timeline.

const CHANNEL_LABELS: Record<string, string> = { mic: 'מקליט', sys: 'משתתפים' };

function channelLabel(channel: string): string {
  if (CHANNEL_LABELS[channel]) return CHANNEL_LABELS[channel];
  const guest = channel.match(/^guest(\d+)$/);
  if (guest) return `משתתף ${guest[1]}`;
  return channel;
}

function partChannel(path: string): { channel: 'mic' | 'sys' | 'mixed'; part: number } {
  const m = path.match(/_(mic|sys|audio)_part(\d+)\.\w+$/);
  if (!m) return { channel: 'mixed', part: 0 };
  return { channel: m[1] === 'audio' ? 'mixed' : (m[1] as 'mic' | 'sys'), part: parseInt(m[2], 10) };
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

async function transcribeChannelParts(supabase: any, recordingId: string, paths: string[]): Promise<string> {
  // Full-length system channel ({ts}_sys_full.webm): diarize it as ONE file so
  // speaker identities stay consistent across the whole meeting ("משתתף 2" in
  // minute 5 is the same person in minute 80). When diarization succeeds, the
  // segmented sys parts are skipped (they exist as a crash-safe fallback).
  type TimedSegment = { at: number; channel: string; text: string };
  const sysFullPath = paths.find((p) => /_sys_full\.\w+$/.test(p));
  let diarized: TimedSegment[] | null = null;
  if (sysFullPath) {
    const { data: fullBlob, error: fullErr } = await supabase.storage.from('recordings').download(sysFullPath);
    if (!fullErr && fullBlob) {
      console.log(`🗣️ Diarizing system channel (${(fullBlob.size / 1024 / 1024).toFixed(1)}MB) via Scribe`);
      const segs = await aiDiarizeTranscribe(fullBlob, { filename: 'sys_full.webm' });
      if (segs) {
        const speakerOrder = new Map<string, number>();
        diarized = segs.map((s) => {
          if (!speakerOrder.has(s.speaker)) speakerOrder.set(s.speaker, speakerOrder.size + 1);
          return { at: s.start, channel: `guest${speakerOrder.get(s.speaker)}`, text: s.text };
        });
        console.log(`🗣️ Diarization: ${speakerOrder.size} speakers, ${segs.length} segments`);
        await touchProcessing(supabase, recordingId);
      } else {
        console.log('🗣️ Diarization unavailable (no ELEVENLABS_API_KEY or Scribe error) — falling back to Whisper on sys parts');
      }
    }
  }

  // Group parts per channel, ordered by part number (fallback: array order).
  const channels = new Map<string, { path: string; part: number }[]>();
  paths
    .filter((path) => path !== sysFullPath)
    .filter((path) => !(diarized && partChannel(path).channel === 'sys'))
    .forEach((path, i) => {
      const { channel, part } = partChannel(path);
      if (!channels.has(channel)) channels.set(channel, []);
      channels.get(channel)!.push({ path, part: part || i + 1 });
    });
  for (const list of channels.values()) list.sort((a, b) => a.part - b.part);

  // Download + transcribe every part in parallel (each is a few MB).
  type PartResult = { channel: string; part: number; segments: { start: number; end: number; text: string }[]; duration: number };
  const jobs: Promise<PartResult>[] = [];
  for (const [channel, list] of channels.entries()) {
    for (const { path, part } of list) {
      jobs.push((async () => {
        const { data: blob, error } = await supabase.storage.from('recordings').download(path);
        if (error || !blob) throw new Error(`Failed to download segment ${path}: ${error?.message || 'unknown'}`);
        if (blob.size > WHISPER_MAX_BYTES) throw new Error(`Segment ${path} exceeds 25MB`);
        console.log(`🎙️ Transcribing ${channel} part ${part} (${(blob.size / 1024 / 1024).toFixed(1)}MB)`);
        const verbose = await aiTranscribeVerbose(blob, { language: 'he', filename: `part.webm` });
        if (!verbose) throw new Error(`Whisper failed on segment ${path}`);
        return { channel, part, segments: verbose.segments, duration: verbose.duration };
      })());
    }
  }
  const results = await Promise.all(jobs);
  await touchProcessing(supabase, recordingId);

  // Shift each part's segments by the cumulative duration of earlier parts.
  const timeline: TimedSegment[] = diarized ? [...diarized] : [];
  for (const channel of channels.keys()) {
    const parts = results.filter((r) => r.channel === channel).sort((a, b) => a.part - b.part);
    let offset = 0;
    for (const p of parts) {
      for (const seg of p.segments) {
        timeline.push({ at: offset + seg.start, channel, text: seg.text });
      }
      offset += p.duration;
    }
  }

  if (timeline.length === 0) throw new Error('Whisper returned empty transcription');
  timeline.sort((a, b) => a.at - b.at);

  // Single mixed channel → plain transcript (legacy behavior, no fake speakers).
  const hasSpeakers = channels.has('mic') || channels.has('sys') || !!diarized;
  if (!hasSpeakers) {
    return timeline.map((s) => s.text).join(' ');
  }

  // Coalesce consecutive same-speaker segments into one line.
  const lines: string[] = [];
  let current: { at: number; channel: string; texts: string[] } | null = null;
  for (const seg of timeline) {
    if (current && current.channel === seg.channel) {
      current.texts.push(seg.text);
    } else {
      if (current) {
        lines.push(`[${formatClock(current.at)}] ${channelLabel(current.channel)}: ${current.texts.join(' ')}`);
      }
      current = { at: seg.at, channel: seg.channel, texts: [seg.text] };
    }
  }
  if (current) {
    lines.push(`[${formatClock(current.at)}] ${channelLabel(current.channel)}: ${current.texts.join(' ')}`);
  }
  return lines.join('\n');
}

// Bump updated_at while a multi-chunk transcription runs so the UI's
// stale-processing detector (3 min without change → mark failed) stays quiet.
async function touchProcessing(supabase: any, recordingId: string) {
  await supabase
    .from('zoom_recordings')
    .update({ transcription_status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', recordingId);
}

async function transcribeBlob(supabase: any, recordingId: string, audioBlob: Blob, contentType: string): Promise<string> {
  if (audioBlob.size <= WHISPER_MAX_BYTES) {
    return await whisperTranscribe(audioBlob, contentType);
  }

  const chunks = await splitOversizedBlob(audioBlob, contentType);
  if (!chunks) {
    const sizeMB = (audioBlob.size / (1024 * 1024)).toFixed(0);
    throw new Error(
      `ההקלטה גדולה מדי לתמלול (${sizeMB}MB > 25MB) ובפורמט שלא ניתן לפצל בשרת (${contentType}). ` +
      `העלה גרסת MP3/WAV או פצל את הקובץ ידנית.`,
    );
  }

  console.log(`✂️ Split ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB ${contentType} into ${chunks.length} chunks`);
  const pieces: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`🎙️ Transcribing chunk ${i + 1}/${chunks.length} (${(chunks[i].size / 1024 / 1024).toFixed(1)}MB)`);
    pieces.push(await whisperTranscribe(chunks[i], contentType));
    await touchProcessing(supabase, recordingId);
  }
  return pieces.join('\n\n');
}

// Split a too-large audio file into standalone playable chunks, when the
// container format allows it without a real demuxer:
// - MP3: frame-based; decoders resync at any byte offset, so plain byte slices work.
// - WAV: fixed-rate PCM; slice the data payload on blockAlign boundaries and
//   prepend a size-patched copy of the original header.
// Other formats (m4a/webm/ogg/flac) need a demuxer — return null and let the
// caller raise a clear error. (Extension recordings avoid this entirely by
// uploading pre-segmented parts — see audio_file_paths.)
async function splitOversizedBlob(blob: Blob, contentType: string): Promise<Blob[] | null> {
  const format = geminiAudioFormat(contentType);

  if (format === 'mp3') {
    const chunks: Blob[] = [];
    for (let off = 0; off < blob.size; off += CHUNK_TARGET_BYTES) {
      chunks.push(blob.slice(off, Math.min(off + CHUNK_TARGET_BYTES, blob.size), contentType));
    }
    return chunks;
  }

  if (format === 'wav') {
    return await splitWav(blob);
  }

  return null;
}

async function splitWav(blob: Blob): Promise<Blob[] | null> {
  const headLen = Math.min(blob.size, 4096);
  const head = new Uint8Array(await blob.slice(0, headLen).arrayBuffer());
  const dv = new DataView(head.buffer);
  const tag = (off: number) => String.fromCharCode(head[off], head[off + 1], head[off + 2], head[off + 3]);

  if (blob.size < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;

  let off = 12;
  let blockAlign = 0;
  let dataOff = -1;
  while (off + 8 <= headLen) {
    const id = tag(off);
    const size = dv.getUint32(off + 4, true);
    if (id === 'fmt ') blockAlign = dv.getUint16(off + 8 + 12, true) || 0;
    if (id === 'data') { dataOff = off + 8; break; }
    off += 8 + size + (size % 2);
  }
  // 'data' chunk not found within the first 4KB — unusual layout, bail out.
  if (dataOff < 0 || blockAlign <= 0) return null;

  const dataLen = blob.size - dataOff;
  const payloadPerChunk = Math.floor((CHUNK_TARGET_BYTES - dataOff) / blockAlign) * blockAlign;
  if (payloadPerChunk <= 0) return null;

  const chunks: Blob[] = [];
  for (let start = 0; start < dataLen; start += payloadPerChunk) {
    const segLen = Math.min(payloadPerChunk, dataLen - start);
    const header = head.slice(0, dataOff);
    const hdv = new DataView(header.buffer);
    hdv.setUint32(4, dataOff - 8 + segLen, true);        // RIFF chunk size
    hdv.setUint32(dataOff - 4, segLen, true);            // data chunk size
    chunks.push(new Blob([header, blob.slice(dataOff + start, dataOff + start + segLen)], { type: 'audio/wav' }));
  }
  return chunks;
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
