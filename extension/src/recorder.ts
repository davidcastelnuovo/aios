import { APP_ORIGIN } from "./config";
import { supabase } from "./supabase";

const params = new URLSearchParams(location.search);
const tenantId = params.get("tenant") ?? "";
const tenantSlug = params.get("slug") ?? "";
const clientId = params.get("client") || null;
const clientName = params.get("clientName") || "";
const topic = params.get("topic") || "";
const audioOnly = params.get("audioOnly") === "1";

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
let videoRecorder: MediaRecorder | null = null;
let audioRecorder: MediaRecorder | null = null;
const videoChunks: Blob[] = [];
const audioChunks: Blob[] = [];
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

  // Mix system audio + mic into a single track.
  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  if (displayStream.getAudioTracks().length > 0) {
    audioContext.createMediaStreamSource(new MediaStream(displayStream.getAudioTracks())).connect(destination);
  }
  if (micStream && micStream.getAudioTracks().length > 0) {
    audioContext.createMediaStreamSource(micStream).connect(destination);
  }
  const mixedAudioTracks = destination.stream.getAudioTracks();
  if (mixedAudioTracks.length === 0 && !audioOnly) {
    setStatus("⚠️ אין מקור אודיו — מוקלט וידאו בלבד");
  }

  if (!audioOnly) {
    const videoMime = pickMimeType(["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]);
    const archiveStream = new MediaStream([...displayStream.getVideoTracks(), ...mixedAudioTracks]);
    videoRecorder = new MediaRecorder(archiveStream, {
      mimeType: videoMime,
      videoBitsPerSecond: 1_000_000,
      audioBitsPerSecond: 96_000,
    });
    videoRecorder.ondataavailable = (e) => { if (e.data.size > 0) videoChunks.push(e.data); };
    videoRecorder.start(1000);
  }

  if (mixedAudioTracks.length > 0) {
    // Low-bitrate mono track kept small enough for a single Whisper request (~14MB/hour).
    const audioMime = pickMimeType(["audio/webm;codecs=opus", "audio/webm"]);
    audioRecorder = new MediaRecorder(new MediaStream(mixedAudioTracks), {
      mimeType: audioMime,
      audioBitsPerSecond: 32_000,
    });
    audioRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    audioRecorder.start(1000);
  }

  if (!videoRecorder && !audioRecorder) {
    setStatus("אין מה להקליט — לא נמצא מקור וידאו או אודיו");
    cleanupStreams();
    startBtn.disabled = false;
    return;
  }

  recording = true;
  startedAt = Date.now();
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  timerEl.classList.add("recording");
  timerEl.innerHTML = `00:00<span class="rec-dot"></span>`;
  timerInterval = window.setInterval(() => {
    timerEl.innerHTML = `${formatElapsed(Date.now() - startedAt)}<span class="rec-dot"></span>`;
  }, 1000);

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

async function uploadWithRetry(path: string, blob: Blob, contentType: string, attempts = 3): Promise<void> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const { error } = await supabase.storage.from("recordings").upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (!error) return;
    lastError = error;
    console.error(`upload attempt ${i + 1} failed:`, error);
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error(String((lastError as { message?: string })?.message ?? lastError));
}

async function stopAndUpload() {
  if (!recording) return;
  recording = false;
  window.clearInterval(timerInterval);
  stopBtn.disabled = true;
  timerEl.classList.remove("recording");
  timerEl.textContent = formatElapsed(Date.now() - startedAt);

  setStatus("עוצר הקלטה...");
  await Promise.all([stopRecorder(videoRecorder), stopRecorder(audioRecorder)]);
  cleanupStreams();

  const durationMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const ts = Date.now();
  const videoBlob = videoChunks.length > 0 ? new Blob(videoChunks, { type: "video/webm" }) : null;
  const audioBlob = audioChunks.length > 0 ? new Blob(audioChunks, { type: "audio/webm" }) : null;

  if (!videoBlob && !audioBlob) {
    setStatus("ההקלטה ריקה — לא הועלה דבר");
    return;
  }

  await uploadAndRegister(videoBlob, audioBlob, durationMinutes, ts);
}

async function uploadAndRegister(
  videoBlob: Blob | null,
  audioBlob: Blob | null,
  durationMinutes: number,
  ts: number,
) {
  progressEl.classList.remove("hidden");

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("פג תוקף ההתחברות — נא להתחבר מחדש בחלונית התוסף");

    let filePath: string | null = null;
    let audioFilePath: string | null = null;

    if (videoBlob) {
      setStatus(`מעלה וידאו (${(videoBlob.size / 1024 / 1024).toFixed(1)}MB)...`);
      progressBar.style.width = "20%";
      filePath = `${tenantId}/${ts}.webm`;
      await uploadWithRetry(filePath, videoBlob, "video/webm");
    }

    if (audioBlob) {
      setStatus(`מעלה אודיו (${(audioBlob.size / 1024 / 1024).toFixed(1)}MB)...`);
      progressBar.style.width = "60%";
      audioFilePath = `${tenantId}/${ts}_audio.webm`;
      await uploadWithRetry(audioFilePath, audioBlob, "audio/webm");
    }

    // Audio-only mode: the opus file doubles as the playable recording.
    if (!filePath && audioFilePath) {
      filePath = audioFilePath;
      audioFilePath = null;
    }

    setStatus("רושם את ההקלטה במערכת...");
    progressBar.style.width = "80%";

    const { data: inserted, error: insertError } = await supabase
      .from("zoom_recordings")
      .insert({
        tenant_id: tenantId,
        meeting_id: `ext_${ts}`,
        meeting_topic: topic || `הקלטת פגישה ${new Date(startedAt).toLocaleDateString("he-IL")}`,
        recording_type: audioOnly ? "audio_only" : "screen_capture",
        start_time: new Date(startedAt).toISOString(),
        duration: durationMinutes,
        source: "chrome_extension",
        file_path: filePath,
        audio_file_path: audioFilePath,
        file_size: (videoBlob?.size ?? 0) + (audioBlob?.size ?? 0),
        client_id: clientId,
        host_email: session.user.email ?? null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      throw new Error("שגיאה ברישום ההקלטה: " + (insertError?.message ?? "unknown"));
    }

    setStatus("מפעיל תמלול וסיכום...");
    progressBar.style.width = "90%";

    const { error: fnError } = await supabase.functions.invoke("ingest-extension-recording", {
      body: { recording_id: inserted.id },
    });
    if (fnError) {
      console.error("ingest-extension-recording:", fnError);
      setStatus("ההקלטה הועלתה, אך הפעלת העיבוד נכשלה — ניתן לתמלל ידנית מעמוד ההקלטות");
    }

    progressBar.style.width = "100%";
    const recordingsUrl = tenantSlug ? `${APP_ORIGIN}/t/${tenantSlug}/recordings` : APP_ORIGIN;
    statusEl.classList.add("ok");
    statusEl.innerHTML = `✅ ההקלטה הועלתה ומעובדת ברקע (תמלול${clientId ? " + סיכום + בריף" : ""}).<br/><a href="${recordingsUrl}" target="_blank" rel="noreferrer">פתח את ספריית ההקלטות</a>`;
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
      uploadAndRegister(videoBlob, audioBlob, durationMinutes, ts);
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
