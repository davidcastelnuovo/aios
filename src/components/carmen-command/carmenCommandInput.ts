/**
 * Command Center input contract (Stage 0).
 *
 * Typed text and Live voice are different modes. Mixing them is the bug:
 * typing used to enqueue carmen-speak, and a Realtime failure silently
 * fell back to transcribe-voice.
 */

export type CarmenInputMode = "typed" | "realtime_voice" | "external_channel_callback";
export type CarmenDeliveryMode = "text" | "realtime";

export type ChatTurnTag = {
  input_mode: CarmenInputMode;
  delivery_mode: CarmenDeliveryMode;
};

export function deliveryForInputMode(mode: CarmenInputMode): CarmenDeliveryMode {
  return mode === "realtime_voice" ? "realtime" : "text";
}

export function tagChatTurn(mode: CarmenInputMode): ChatTurnTag {
  return { input_mode: mode, delivery_mode: deliveryForInputMode(mode) };
}

/**
 * Command Center never uses carmen-speak for replies.
 * Live speech is OpenAI Realtime; typed replies stay on screen.
 */
export function shouldSpeakWithLegacyTts(_mode: CarmenInputMode): boolean {
  return false;
}

/** Volume / output-mute only applies to an open Live Realtime session. */
export function volumeControlsLiveSession(mode: CarmenInputMode): boolean {
  return mode === "realtime_voice";
}

export function onRealtimeUnavailable(): {
  fallbackToLegacyListen: false;
  title: string;
  description: string;
} {
  return {
    fallbackToLegacyListen: false,
    title: "שיחה חיה לא זמינה",
    description: "לא הצלחתי לפתוח שיחת OpenAI Realtime. אפשר לכתוב לכרמן במקלדת — בלי תמלול ובלי הקראה אוטומטית.",
  };
}

/** transcribe-voice / local VAD is out of the Command Center path. */
export function shouldResumeLegacyListen(_args: {
  inputMode: CarmenInputMode;
  realtimeActive: boolean;
}): boolean {
  return false;
}

/** Live speech stays spoken. Typed chat stays typed. Do not mix STT into the thread. */
export function shouldLogRealtimeTranscript(): boolean {
  return false;
}
