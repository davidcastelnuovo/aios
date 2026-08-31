/**
 * Composer dictation: record → existing transcribe-voice → insert into composer (no auto-send).
 * Reuses transcribeAudioBlob from carmenTranscribeOnly — no new backend.
 */

/** Append transcribed text into the composer, preserving existing draft. */
export function mergeTranscriptionIntoComposer(existing: string, transcribed: string): string {
  const prev = existing.trimEnd();
  const next = transcribed.trim();
  if (!next) return existing;
  if (!prev) return next;
  return `${prev} ${next}`;
}

export function logComposerDictationEvent(
  step: "record_start" | "record_stop" | "transcribe_ok" | "transcribe_fail" | "inserted_composer",
  detail: Record<string, unknown> = {},
): void {
  console.info("[carmen:composer_dictation]", { step, ...detail });
}
