/** Resolve the fixed Carmen / Grok → Cursor Direct chat (bc-…) without hardcoded ids. */

export type CursorDirectSessionSource =
  | "arg:session_id"
  | "env:CURSOR_DIRECT_AGENT_ID"
  | "db:cursor_sticky_agents"
  | "env:CURSOR_STICKY_AGENT_ID"
  | "db:agent_channel_sessions";

export type CursorDirectSession = {
  sessionId: string;
  sessionUrl: string;
  source: CursorDirectSessionSource;
};

export function asCursorSessionId(value?: string | null): string | null {
  const id = String(value || "").trim();
  return id.startsWith("bc-") ? id : null;
}

export function cursorSessionUrl(sessionId: string): string {
  return `https://cursor.com/agents/${sessionId}`;
}

function fromEnv(
  env: Record<string, string | undefined>,
  key: "CURSOR_DIRECT_AGENT_ID" | "CURSOR_STICKY_AGENT_ID",
): CursorDirectSession | null {
  const id = asCursorSessionId(env[key]);
  if (!id) return null;
  return {
    sessionId: id,
    sessionUrl: cursorSessionUrl(id),
    source: key === "CURSOR_DIRECT_AGENT_ID" ? "env:CURSOR_DIRECT_AGENT_ID" : "env:CURSOR_STICKY_AGENT_ID",
  };
}

export async function resolveCursorDirectSession(
  sb: { from: (table: string) => any } | null | undefined,
  args: {
    tenantId?: string | null;
    env?: Record<string, string | undefined>;
  },
): Promise<CursorDirectSession | null> {
  const env = args.env ?? {};
  const direct = fromEnv(env, "CURSOR_DIRECT_AGENT_ID");
  if (direct) return direct;

  const tenantId = String(args.tenantId || "").trim();
  if (tenantId && sb) {
    try {
      const { data } = await sb
        .from("cursor_sticky_agents")
        .select("cursor_agent_id, session_url")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      const id = asCursorSessionId(String(data?.cursor_agent_id || ""));
      if (id) {
        return {
          sessionId: id,
          sessionUrl: String(data?.session_url || cursorSessionUrl(id)),
          source: "db:cursor_sticky_agents",
        };
      }
    } catch { /* table may be missing on a fresh clone */ }
  }

  const sticky = fromEnv(env, "CURSOR_STICKY_AGENT_ID");
  if (sticky) return sticky;

  if (tenantId && sb) {
    try {
      const chain = sb
        .from("agent_channel_sessions")
        .select("external_session_id, external_url")
        .eq("tenant_id", tenantId)
        .eq("provider", "cursor")
        .not("external_session_id", "is", null)
        .order("last_activity_at", { ascending: false })
        .limit(1);
      const { data: rows } = await chain as { data: Array<Record<string, unknown>> | null };
      const row = Array.isArray(rows) ? rows[0] : null;
      const id = asCursorSessionId(String(row?.external_session_id || ""));
      if (id) {
        return {
          sessionId: id,
          sessionUrl: String(row?.external_url || cursorSessionUrl(id)),
          source: "db:agent_channel_sessions",
        };
      }
    } catch { /* ignore */ }
  }

  return null;
}

export function missingCursorDirectSessionError(): string {
  return (
    "No fixed Cursor Direct session is configured. " +
    "Set Supabase secret CURSOR_DIRECT_AGENT_ID=bc-… (or seed cursor_sticky_agents for this tenant). " +
    "Do NOT use ask_cursor or request_dev_task for connection tests — they create a new Background Agent and may hit billing. " +
    "After configuration, call get_cursor_direct_session then reply_to_cursor_session."
  );
}
