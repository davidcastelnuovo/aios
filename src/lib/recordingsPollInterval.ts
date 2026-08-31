/** Safe refetchInterval helper for the recordings feed query observer. */
export function recordingsPollInterval(data: unknown): number | false {
  if (!Array.isArray(data)) return false;
  return data.some((row) => row?.transcription_status === "processing") ? 8000 : false;
}
