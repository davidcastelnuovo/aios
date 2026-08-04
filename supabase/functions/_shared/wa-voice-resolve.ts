/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  VOICE_MARKER,
  VOICE_STATUSES,
  stripVoiceMarker,
  isVoicePlaceholder,
  hasVoiceTranscriptMarker,
  formatVoiceMessageText,
  buildVoiceMeta,
  pickAudioUrlFromContainers,
  looksLikeAudioPayload,
  buildVoiceCapabilityPromptRule,
} from './wa-voice-resolve.mjs'
