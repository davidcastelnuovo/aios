import { supabase } from "@/integrations/supabase/client";

/** Surface JSON `{ error }` from Supabase Edge Functions instead of a generic invoke failure. */
export async function invokeEdgeFunction<T = Record<string, unknown>>(
  name: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    (data as { error?: unknown }).error
  ) {
    throw new Error(String((data as { error: unknown }).error));
  }
  if (error) {
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === "function") {
      try {
        const payload = await ctx.clone().json();
        if (payload?.error) throw new Error(String(payload.error));
        if (payload?.message) throw new Error(String(payload.message));
      } catch (inner) {
        if (inner instanceof Error && inner.message !== error.message)
          throw inner;
      }
    }
    throw new Error(error.message || `קריאה ל-${name} נכשלה`);
  }
  return data as T;
}
