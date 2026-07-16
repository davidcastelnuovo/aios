import { APP_ORIGIN } from "./config";
import { supabase } from "./supabase";

const params = new URLSearchParams(location.search);
const tenantId = params.get("tenant") ?? "";
const tenantSlug = params.get("slug") ?? "";
const clientId = params.get("client") || null;
const clientName = params.get("clientName") || "";
const topic = params.get("topic") || "";
const audioOnly = params.get("audioOnly") === "1";

// Transcription audio is recorded as TWO separate channels — the mic (the
// recording user) and system/tab audio (everyone else) — so speaker
// attribution is physical, not guessed. Each channel rotates into a
// standalone webm part every 10 minutes and is uploaded DURING the meeting:
// a crash loses at most the last few minutes, and transcription of all parts
// runs in parallel the moment the meeting ends.
const SEGMENT_MS = 10 * 60 * 1000;

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const startBtn = el<HTMLButtonElement>("start-btn");
const stopBtn = el<HTMLButtonElement>("stop-btn");
const timerEl = el<HTMLDivElement>("timer");
const statusEl = el<HTMLDivElement>("status");
const progressEl = el<HTMLDivElement>("progress");
const progressBar = el<HTMLDivElement>("progress-bar");

el<HTMLElement>("info-topic").textContent = topic || "ללא נושא";
el<HTMLElement>("info-client").textContent = clientName || "ללא שיוך";
el<HTMLElement>("info-mode").classList.toggle("hidden", !audioOnly);

let displayStream: MediaStream | null = null;
let micStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;

// Continuous recorder for playback: screen video (or full mixed audio in audio-only mode).
let archiveRecorder: MediaRecorder | null = null;
const archiveChunks: Blob[] = [];

interface Channel {
  name: "mic" | "sys";
  stream: MediaStream;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  partNum: number;
}

const channels: Channel[] = [];
let segmentTimer: number | undefined;
let audioMime: string | undefined;

let recordingId: string | null = null;
const uploadedPartPaths: string[] = [];
const failedParts: { path: string; blob: Blob }[] = [];
const pendingUploads: Promise<void>[] = [];

let startedAt = 0;
let timerInterval: number | undefined;
let recording = false;

function setStatus(message: string, ok = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("ok", ok);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function pickMimeType(candidates: string[]): string | undefined {
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

async function uploadWithRetry(path: string, blob: Blob, contentType: string, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.storage.from("recordings").upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (!error) return;
    lastError = error;
    console.error(`upload attempt ${i + 1} failed for ${path}:`, error);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String((lastError as { message?: string })?.message ?? lastError));
}

// Progressive save: called for every finished segment, during the meeting.
function uploadPart(channel: "mic" | "sys", partNum: number, blob: Blob) {
  const path = `${tenantId}/${startedAt}_${channel}_part${partNum}.webm`;
  const job = (async () => {
    try {
      await uploadWithRetry(path, blob, "audio/webm");
      uploadedPartPaths.push(path);
      if (recordingId) {
        await supabase
          .from("zoom_recordings")
          .update({ audio_file_paths: [...uploadedPartPaths].sort() })
          .eq("id", recordingId);
      }
      if (recording) {
        setStatus(`☁️ ${uploadedPartPaths.length} קטעים נשמרו בענן — ההקלטה מוגנת`, true);
      }
    } catch (err) {
      console.error(`part upload failed, will retry at stop: ${path}`, err);
      failedParts.push({ path, blob });
    }
  })();
  pendingUploads.push(job);
}

function startChannelRecorder(channel: Channel) {
  channel.chunks = [];
  channel.recorder = new MediaRecorder(channel.stream, {
    mimeType: audioMime,
    audioBitsPerSecond: 32_000,
  });
  channel.recorder.ondataavailable = (e) => { if (e.data.size > 0) channel.chunks.push(e.data); };
  // Fires on rotation and on final stop — ship the finished part right away.
  channel.recorder.onstop = () => {
    if (channel.chunks.length > 0) {
      channel.partNum += 1;
      uploadPart(channel.name, channel.partNum, new Blob(channel.chunks, { type: "audio/webm" }));
    }
    channel.chunks = [];
  };
  channel.recorder.start(1000);
}

// Register the recording in AIOS as soon as it starts, so segments uploaded
// mid-meeting are attached to a row even if the browser crashes before "stop".
async function createRecordingRow(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const { data, error } = await supabase
    .from("zoom_recordings")
    .insert({
      tenant_id: tenantId,
      meeting_id: `ext_${startedAt}`,
      meeting_topic: topic || `הקלטת פגישה ${new Date(startedAt).toLocaleDateString("he-IL")}`,
      recording_type: audioOnly ? "audio_only" : "screen_capture",
      start_time: new Date(startedAt).toISOString(),
      source: "chrome_extension",
      client_id: clientId,
      host_email: session.user.email ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("early row insert failed (will insert at stop):", error);
    return;
  }
  recordingId = data.id;
}

async function startRecording() {
  startBtn.disabled = true;
  setStatus("");
  try {
    // Screen (and system/tab audio when the user checks "share audio").
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
  } catch {
    startBtn.disabled = false;
    setStatus("בחירת המסך בוטלה");
    return;
  }

  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    micStream = null;
    setStatus("⚠️ אין גישה למיקרופון — מוקלט אודיו מערכת בלבד");
  }

  const sysTracks = displayStream.getAudioTracks();
  const micTracks = micStream?.getAudioTracks() ?? [];

  // Mixed track for the playback recording only (transcription uses the raw channels).
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  if (sysTracks.length > 0) {
    audioContext.createMediaStreamSource(new MediaStream(sysTracks)).connect(destination);
  }
  if (micTracks.length > 0) {
    audioContext.createMediaStreamSource(new MediaStream(micTracks)).connect(destination);
  }
  const mixedTracks = destination.stream.getAudioTracks();
  if (mixedTracks.length === 0 && !audioOnly) {
    setStatus("⚠️ אין מקור אודיו — מוקלט וידאו בלבד");
  }

  audioMime = pickMimeType(["audio/webm;codecs=opus", "audio/webm"]);
  startedAt = Date.now();

  // Playback recording: full video, or continuous mixed audio in audio-only mode.
  if (!audioOnly) {
    const videoMime = pickMimeType(["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]);
    const archiveStream = new MediaStream([...displayStream.getVideoTracks(), ...mixedTracks]);
    archiveRecorder = new MediaRecorder(archiveStream, {
      mimeType: videoMime,
      videoBitsPerSecond: 1_000_000,
      audioBitsPerSecond: 96_000,
    });
    archiveRecorder.ondataavailable = (e) => { if (e.data.size > 0) archiveChunks.push(e.data); };
    archiveRecorder.start(1000);
  } else if (mixedTracks.length > 0) {
    archiveRecorder = new MediaRecorder(new MediaStream(mixedTracks), {
      mimeType: audioMime,
      audioBitsPerSecond: 32_000,
    });
    archiveRecorder.ondataavailable = (e) => { if (e.data.size > 0) archiveChunks.push(e.data); };
    archiveRecorder.start(1000);
  }

  // Transcription channels — separate mic and system recorders, rotated together.
  if (micTracks.length > 0) {
    channels.push({ name: "mic", stream: new MediaStream(micTracks), recorder: null, chunks: [], partNum: 0 });
  }
  if (sysTracks.length > 0) {
    channels.push({ name: "sys", stream: new MediaStream(sysTracks), recorder: null, chunks: [], partNum: 0 });
  }
  for (const channel of channels) startChannelRecorder(channel);
  if (channels.length > 0) {
    segmentTimer = window.setInterval(() => {
      if (!recording) return;
      for (const channel of channels) {
        channel.recorder?.stop(); // onstop uploads the finished part
        startChannelRecorder(channel);
      }
    }, SEGMENT_MS);
  }

  if (!archiveRecorder && channels.length === 0) {
    setStatus("אין מה להקליט — לא נמצא מקור וידאו או אודיו");
    cleanupStreams();
    startBtn.disabled = false;
    return;
  }

  recording = true;
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  timerEl.classList.add("recording");
  timerEl.innerHTML = `00:00<span class="rec-dot"></span>`;
  timerInterval = window.setInterval(() => {
    timerEl.innerHTML = `${formatElapsed(Date.now() - startedAt)}<span class="rec-dot"></span>`;
  }, 1000);

  void createRecordingRow();

  // Stop when the user clicks Chrome's native "Stop sharing" bar.
  displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
    if (recording) stopAndUpload();
  });
}

function stopRecorder(recorder: MediaRecorder | null): Promise<void> {
  return new Promise((resolve) => {
    if (!recorder || recorder.state === "inactive") return resolve();
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.stop();
  });
}

function cleanupStreams() {
  displayStream?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  audioContext?.close().catch(() => {});
  displayStream = micStream = null;
  audioContext = null;
}

async function stopAndUpload() {
  if (!recording) return;
  recording = false;
  window.clearInterval(timerInterval);
  window.clearInterval(segmentTimer);
  stopBtn.disabled = true;
  timerEl.classList.remove("recording");
  timerEl.textContent = formatElapsed(Date.now() - startedAt);

  setStatus("עוצר הקלטה...");
  await Promise.all([
    stopRecorder(archiveRecorder),
    ...channels.map((c) => stopRecorder(c.recorder)),
  ]);
  cleanupStreams();

  const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const archiveBlob = archiveChunks.length > 0
    ? new Blob(archiveChunks, { type: audioOnly ? "audio/webm" : "video/webm" })
    : null;

  await finalizeUpload(archiveBlob, durationMinutes);
}

async function finalizeUpload(archiveBlob: Blob | null, durationMinutes: number) {
  progressEl.classList.remove("hidden");
  progressBar.style.width = "10%";

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("פג תוקף ההתחברות — נא להתחבר מחדש בחלונית התוסף");

    // Wait for in-flight segment uploads (incl. the final rotation parts).
    setStatus("ממתין לסיום שמירת הקטעים...");
    await Promise.allSettled(pendingUploads);
    progressBar.style.width = "40%";

    // Retry anything that failed mid-meeting.
    const retries = failedParts.splice(0, failedParts.length);
    for (const { path, blob } of retries) {
      setStatus(`מעלה מחדש קטע שנכשל...`);
      await uploadWithRetry(path, blob, "audio/webm");
      uploadedPartPaths.push(path);
    }

    if (!archiveBlob && uploadedPartPaths.length === 0) {
      setStatus("ההקלטה ריקה — לא הועלה דבר");
      return;
    }

    let filePath: string | null = null;
    if (archiveBlob) {
      setStatus(`מעלה ${audioOnly ? "אודיו" : "וידאו"} (${(archiveBlob.size / 1024 / 1024).toFixed(1)}MB)...`);
      filePath = `${tenantId}/${startedAt}.webm`;
      await uploadWithRetry(filePath, archiveBlob, archiveBlob.type);
    } else if (uploadedPartPaths.length > 0) {
      filePath = [...uploadedPartPaths].sort()[0];
    }
    progressBar.style.width = "75%";

    setStatus("רושם את ההקלטה במערכת...");
    const finalPaths = [...uploadedPartPaths].sort();
    const rowData = {
      duration: durationMinutes,
      file_path: filePath,
      audio_file_paths: finalPaths.length > 0 ? finalPaths : null,
      file_size: (archiveBlob?.size ?? 0),
    };

    if (recordingId) {
      const { error: updateError } = await supabase
        .from("zoom_recordings")
        .update(rowData)
        .eq("id", recordingId);
      if (updateError) throw new Error("שגיאה בעדכון ההקלטה: " + updateError.message);
    } else {
      // Early insert failed at start — create the row now.
      const { data: inserted, error: insertError } = await supabase
        .from("zoom_recordings")
        .insert({
          tenant_id: tenantId,
          meeting_id: `ext_${startedAt}`,
          meeting_topic: topic || `הקלטת פגישה ${new Date(startedAt).toLocaleDateString("he-IL")}`,
          recording_type: audioOnly ? "audio_only" : "screen_capture",
          start_time: new Date(startedAt).toISOString(),
          source: "chrome_extension",
          client_id: clientId,
          host_email: session.user.email ?? null,
          ...rowData,
        })
        .select("id")
        .single();
      if (insertError || !inserted) {
        throw new Error("שגיאה ברישום ההקלטה: " + (insertError?.message ?? "unknown"));
      }
      recordingId = inserted.id;
    }

    setStatus("מפעיל תמלול וסיכום...");
    progressBar.style.width = "90%";

    const { error: fnError } = await supabase.functions.invoke("ingest-extension-recording", {
      body: { recording_id: recordingId },
    });
    if (fnError) {
      console.error("ingest-extension-recording:", fnError);
      setStatus("ההקלטה הועלתה, אך הפעלת העיבוד נכשלה — ניתן לתמלל ידנית מעמוד ההקלטות");
    }

    progressBar.style.width = "100%";
    const recordingsUrl = tenantSlug ? `${APP_ORIGIN}/t/${tenantSlug}/recordings` : APP_ORIGIN;
    statusEl.classList.add("ok");
    statusEl.innerHTML = `✅ ההקלטה הועלתה ומעובדת ברקע (תמלול עם דוברים${clientId ? " + סיכום + בריף" : ""}).<br/><a href="${recordingsUrl}" target="_blank" rel="noreferrer">פתח את ספריית ההקלטות</a>`;
  } catch (err) {
    console.error(err);
    progressEl.classList.add("hidden");
    setStatus("❌ " + (err instanceof Error ? err.message : "שגיאה בהעלאה"));
    // Retry with the blobs still in memory — a reload would lose the recording.
    stopBtn.classList.remove("hidden");
    stopBtn.disabled = false;
    stopBtn.textContent = "נסה להעלות שוב";
    stopBtn.onclick = () => {
      stopBtn.disabled = true;
      finalizeUpload(archiveBlob, durationMinutes);
    };
  }
}

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopAndUpload);

window.addEventListener("beforeunload", (e) => {
  if (recording) {
    e.preventDefault();
    e.returnValue = "";
  }
});
