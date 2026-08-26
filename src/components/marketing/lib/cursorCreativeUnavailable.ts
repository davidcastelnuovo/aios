/** Only a missing function should fall back to local gpt-image-1. Auth/key/job errors must surface. */
export const isCursorCreativeUnavailable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /requested function was not found/i.test(message)
    || /failed to send a request to the edge function/i.test(message);
};
