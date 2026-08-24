/** Extract a user-facing message from a Supabase edge-function invoke failure. */
export async function invokeErrorMessage(
  error: unknown,
  data: { error?: string } | null,
  fallback: string,
  response?: Response,
): Promise<string> {
  if (data?.error) return data.error;

  const res = response
    ?? (error && typeof error === "object" ? (error as { context?: Response }).context : undefined);

  if (res) {
    try {
      const body = await res.clone().json() as { error?: string };
      if (body?.error) return body.error;
    } catch {
      /* not JSON */
    }
    try {
      const text = (await res.clone().text()).trim();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed?.error) return parsed.error;
        } catch {
          return text.length > 280 ? `${text.slice(0, 280)}…` : text;
        }
      }
    } catch {
      /* ignore read errors */
    }
  }

  return error instanceof Error ? error.message : fallback;
}
