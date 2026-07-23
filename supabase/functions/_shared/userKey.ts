// Per-user AI key resolution for the Carmen Command Center voice stack.
// A user who brought their own OpenAI key (user_api_keys) is billed on it;
// otherwise callers fall back to org-key rules enforced by each function.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export interface Caller { id: string; email: string; }

/** Verify the caller's JWT against GoTrue and return their id + email. */
export async function getCaller(authHeader: string): Promise<Caller | null> {
  if (!authHeader || !SUPABASE_URL) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: authHeader },
    });
    if (!r.ok) return null;
    const u = await r.json();
    return u?.id ? { id: u.id, email: String(u.email ?? "").toLowerCase() } : null;
  } catch {
    return null;
  }
}

/** The user's personal OpenAI key, or null when they haven't set one. */
export async function getUserOpenAIKey(userId: string): Promise<string | null> {
  if (!userId || !SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/user_api_keys?user_id=eq.${userId}&provider=eq.openai&select=api_key`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (!r.ok) return null;
    const rows = await r.json();
    const k = rows?.[0]?.api_key;
    return typeof k === "string" && k.trim() ? k.trim() : null;
  } catch {
    return null;
  }
}
