import assert from "node:assert/strict";
import test from "node:test";

import {
  VOICE_STATUSES,
  buildVoiceCapabilityPromptRule,
  buildVoiceMeta,
  formatVoiceMessageText,
  hasVoiceTranscriptMarker,
  isVoicePlaceholder,
  looksLikeAudioPayload,
  pickAudioUrlFromContainers,
  stripVoiceMarker,
} from "./wa-voice-resolve.mjs";

test("successful transcript keeps 🎤 marker for Carmen context", () => {
  const text = formatVoiceMessageText({
    transcript: "כרמן, את מצליחה לקרוא הודעות קול?",
    status: VOICE_STATUSES.OK,
    isVoice: true,
  });
  assert.equal(text, "🎤 כרמן, את מצליחה לקרוא הודעות קול?");
  assert.equal(hasVoiceTranscriptMarker(text), true);
  assert.equal(stripVoiceMarker(text), "כרמן, את מצליחה לקרוא הודעות קול?");
});

test("paired green transcript must not lose the voice marker", () => {
  // Regression: findPairedGreenTranscript used to strip 🎤 before returning.
  const pairedRaw = "🎤 אבל כרמן את כן קוראת";
  const text = formatVoiceMessageText({
    transcript: stripVoiceMarker(pairedRaw),
    status: VOICE_STATUSES.OK,
    isVoice: true,
  });
  assert.equal(hasVoiceTranscriptMarker(text), true);
  assert.match(text, /^🎤 /);
});

test("explicit failure statuses instead of silent media placeholder", () => {
  assert.equal(
    formatVoiceMessageText({ transcript: null, status: VOICE_STATUSES.NO_AUDIO_URL, isVoice: true }),
    "[הודעת קול · no_audio_url]",
  );
  assert.equal(
    formatVoiceMessageText({ transcript: null, status: VOICE_STATUSES.TRANSCRIPTION_FAILED, isVoice: true }),
    "[הודעת קול · transcription_failed]",
  );
  assert.equal(
    formatVoiceMessageText({ transcript: null, status: VOICE_STATUSES.DOWNLOAD_FAILED, isVoice: true }),
    "[הודעת קול · download_failed]",
  );
  assert.equal(
    formatVoiceMessageText({ transcript: null, status: VOICE_STATUSES.NOT_VOICE_MEDIA, isVoice: false }),
    "[מדיה]",
  );
});

test("buildVoiceMeta exposes transcript + message_id for storage", () => {
  const meta = buildVoiceMeta({
    status: VOICE_STATUSES.OK,
    transcript: "שלום כרמן",
    source: "green_api_pair",
    messageId: "ABC123",
    audioUrl: null,
    isVoice: true,
  });
  assert.equal(meta.has_transcript, true);
  assert.equal(meta.transcript, "שלום כרמן");
  assert.equal(meta.message_id, "ABC123");
  assert.equal(meta.source, "green_api_pair");
  assert.equal(meta.message_text, "🎤 שלום כרמן");
});

test("looksLikeAudioPayload and pickAudioUrlFromContainers", () => {
  assert.equal(looksLikeAudioPayload({ hasAudioMessage: true }), true);
  assert.equal(looksLikeAudioPayload({ type: "ptt", url: null }), true);
  assert.equal(looksLikeAudioPayload({ type: "image", url: "https://x/a.jpg" }), false);
  const url = pickAudioUrlFromContainers([
    { caption: "hi" },
    { downloadUrl: "https://cdn.example/voice.ogg" },
  ]);
  assert.equal(url, "https://cdn.example/voice.ogg");
});

test("placeholders detected", () => {
  assert.equal(isVoicePlaceholder("[הודעת קול]"), true);
  assert.equal(isVoicePlaceholder("[הודעת קול · transcription_failed]"), true);
  assert.equal(isVoicePlaceholder("[מדיה]"), true);
  assert.equal(isVoicePlaceholder("🎤 שלום"), false);
});

test("capability prompt tells Carmen she can read 🎤 transcripts", () => {
  const rule = buildVoiceCapabilityPromptRule();
  assert.match(rule, /🎤/);
  assert.match(rule, /כן/);
  assert.match(rule, /transcription_failed|no_audio_url/);
});
