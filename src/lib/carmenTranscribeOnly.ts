/**
 * Transcribe-only mic mode: record → Whisper → Carmen text prompt → text reply.
 * No OpenAI Realtime, no carmen-speak / TTS, no voice-direct dispatch.
 */

import type { CarmenInputMode } from "@/components/carmen-command/carmenCommandInput";

export type MicCaptureMode = "realtime_voice" | "transcribe_only";

export const MIC_CAPTURE_MODE_KEY = "aios:carmen-mic-capture-mode";

export const MIC_CAPTURE_MODE_LABELS: Record<MicCaptureMode, string> = {
  realtime_voice: "שיחה חיה",
  transcribe_only: "תמלול לקומפוזר",
};

export function isMicCaptureMode(value: string | null | undefined): value is MicCaptureMode {
  return value === "realtime_voice" || value === "transcribe_only";
}

export function loadMicCaptureMode(): MicCaptureMode {
  const saved = localStorage.getItem(MIC_CAPTURE_MODE_KEY);
  return isMicCaptureMode(saved) ? saved : "realtime_voice";
}

export function saveMicCaptureMode(mode: MicCaptureMode): void {
  localStorage.setItem(MIC_CAPTURE_MODE_KEY, mode);
}

/** Carmen replies stay on-screen text — never TTS — in transcribe-only turns. */
export function shouldAllowTtsResponse(inputMode: CarmenInputMode): boolean {
  return inputMode !== "transcribe_only";
}

/** Structured client log for transcribe-only pipeline checks. */
export function logTranscribeOnlyEvent(
  step: "record_start" | "record_stop" | "transcribe_ok" | "transcribe_fail" | "send_text" | "text_response",
  detail: Record<string, unknown> = {},
): void {
  console.info("[carmen:transcribe_only]", { step, ...detail });
}

export async function transcribeAudioBlob(
  audioBlob: Blob,
  accessToken: string,
  opts?: { inputMode?: CarmenInputMode; filename?: string },
): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, opts?.filename ?? "voice.webm");
  if (opts?.inputMode) formData.append("input_mode", opts.inputMode);

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Transcription failed");
  }

  const { text } = (await res.json()) as { text?: string };
  return (text || "").trim();
}
