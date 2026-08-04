/**
 * WhatsApp voice-note resolve helpers (Manus + Green API).
 * Formats transcripts for Carmen with a clear 🎤 marker, and turns silent
 * "[מדיה]" / "[הודעת קול]" fallbacks into explicit status strings.
 */

export const VOICE_MARKER = "🎤";

export const VOICE_STATUSES = Object.freeze({
  OK: "ok",
  NO_AUDIO_URL: "no_audio_url",
  DOWNLOAD_FAILED: "download_failed",
  TRANSCRIPTION_FAILED: "transcription_failed",
  EMPTY_AUDIO: "empty_audio",
  NOT_VOICE_MEDIA: "not_voice_media",
  TEXT: "text",
  EMPTY: "empty",
});

const PLACEHOLDER_RE = /^\[(?:הודעת קול|מדיה|קובץ מדיה|הודעה)(?:\s*[·•|].*)?\]$/;

export function stripVoiceMarker(text) {
  return String(text || "")
    .replace(/^\s*🎤\s*/u, "")
    .trim();
}

export function isVoicePlaceholder(text) {
  return PLACEHOLDER_RE.test(String(text || "").trim());
}

export function hasVoiceTranscriptMarker(text) {
  return /^\s*🎤\s+\S/u.test(String(text || ""));
}

/** Human-readable failure / success marker for chat_messages + Carmen context. */
export function formatVoiceMessageText({ transcript, status, isVoice }) {
  const t = stripVoiceMarker(transcript || "");
  if (t && !isVoicePlaceholder(t)) {
    return `${VOICE_MARKER} ${t}`;
  }
  if (!isVoice) {
    if (status === VOICE_STATUSES.NOT_VOICE_MEDIA) return "[מדיה]";
    return t || "";
  }
  switch (status) {
    case VOICE_STATUSES.NO_AUDIO_URL:
      return "[הודעת קול · no_audio_url]";
    case VOICE_STATUSES.DOWNLOAD_FAILED:
      return "[הודעת קול · download_failed]";
    case VOICE_STATUSES.EMPTY_AUDIO:
      return "[הודעת קול · empty_audio]";
    case VOICE_STATUSES.TRANSCRIPTION_FAILED:
    default:
      return "[הודעת קול · transcription_failed]";
  }
}

/**
 * Build metadata Carmen / chat_messages can persist under raw_provider_data._voice.
 */
export function buildVoiceMeta({
  status,
  transcript = null,
  source = "none",
  messageId = null,
  audioUrl = null,
  isVoice = false,
}) {
  const text = formatVoiceMessageText({ transcript, status, isVoice });
  return {
    status,
    is_voice: !!isVoice,
    transcript: isVoice && status === VOICE_STATUSES.OK ? stripVoiceMarker(text) : null,
    source,
    message_id: messageId || null,
    audio_url: audioUrl || null,
    message_text: text,
    has_transcript: status === VOICE_STATUSES.OK && !!stripVoiceMarker(text),
  };
}

export function pickAudioUrlFromContainers(containers) {
  const fields = [
    "media_url", "mediaUrl", "url", "fileUrl", "file_url",
    "downloadUrl", "downloadURL", "mediaLink", "media_link", "link",
  ];
  for (const c of containers || []) {
    if (!c || typeof c !== "object") continue;
    for (const f of fields) {
      const v = c[f];
      if (typeof v === "string" && /^https?:\/\//.test(v)) return v;
    }
  }
  return null;
}

export function looksLikeAudioPayload({ type, mime, url, hasAudioMessage }) {
  if (hasAudioMessage) return true;
  const t = String(type || "").toLowerCase();
  if (/audio|ptt|voice/.test(t)) return true;
  const m = String(mime || "").toLowerCase();
  if (/audio|ogg|opus|voice|ptt|mpeg|mp4a|amr/.test(m)) return true;
  return !!url && /\.(ogg|opus|mp3|m4a|wav|aac|amr)(\?|$)/i.test(url);
}

/**
 * Prompt rule so Carmen answers voice-capability questions from actual markers,
 * not assumptions.
 */
export function buildVoiceCapabilityPromptRule() {
  return (
    "\n\n🎧 **הודעות קול בוואטסאפ (חובה — מבוסס מציאות):**\n" +
    "• הודעה שמתחילה ב-🎤 היא תמלול אוטומטי של הודעת קול — את *כן* קוראת הודעות קול דרך התמלול.\n" +
    "• אם נשאלת \"את מצליחה לקרוא הודעות קול?\" ועכשיו יש 🎤 בהודעה הנוכחית או בהיסטוריה — עני שכן (תמלול אוטומטי), לא \"אני לא קוראת\".\n" +
    "• אם מופיע `[הודעת קול · no_audio_url]` / `transcription_failed` / `download_failed` — אמרי שלא הצלחת לתמלל *בפעם הזו* וצייני את הסטטוס; אל תכריזי שאת לא יודעת לקרוא קול בכלל.\n" +
    "• תמלולים עלולים לכלול שגיאות הומופונים — פרשי לפי הקשר; שאלי הבהרה רק אם זה משנה פעולה."
  );
}
