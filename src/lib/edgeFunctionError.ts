// `supabase.functions.invoke` rejects with a FunctionsHttpError whose `message` is
// always the generic "Edge Function returned a non-2xx status code". Everything the
// function actually said is in the unread response body on `error.context`, so a
// toast built from `error.message` tells the user nothing about what to fix.

interface EdgeErrorBody {
  message?: unknown;
  error?: unknown;
  details?: unknown;
}

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

/**
 * Best available message for a failed edge function call: prefer what the function
 * put in its JSON body, and fall back to the thrown error or the given default.
 */
export async function edgeFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const body = (await context.clone().json()) as EdgeErrorBody;
      const fromBody = firstString(body?.message, body?.error, body?.details);
      if (fromBody) return fromBody;
    } catch {
      // Body was empty or not JSON — fall through to the thrown error.
    }
  }
  return firstString((error as { message?: unknown } | null)?.message) || fallback;
}
