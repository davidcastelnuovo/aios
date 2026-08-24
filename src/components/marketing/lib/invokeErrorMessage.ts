/** Extract a user-facing message from a Supabase edge-function invoke failure. */
export async function invokeErrorMessage(
  error: unknown,
  data: { error?: string } | null,
  fallback: string,
): Promise<string> {
  if (data?.error) return data.error;
  const context = error && typeof error === "object" ? (error as { context?: Response }).context : undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json() as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* ignore parse errors */
    }
  }
  return error instanceof Error ? error.message : fallback;
}
