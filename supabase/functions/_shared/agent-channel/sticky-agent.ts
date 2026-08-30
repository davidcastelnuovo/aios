/** Cursor / Codex Direct talk to an already-open Cloud Agent chat (bc-…). */

export type OpenChatProvider = "cursor" | "codex";

/** Live "כרמן - ישיר" Cloud Agent. Last-resort Cursor Direct target — never create a new one. */
export const FALLBACK_CURSOR_DIRECT_CHAT = "bc-7eb07a1e-7143-4b20-bf1e-fc529a24cc5c";

export function asCloudAgentId(value?: string | null): string | null {
  const id = String(value || "").trim();
  return id.startsWith("bc-") ? id : null;
}

export function uniqueCloudAgentIds(...values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const value of values) {
    const id = asCloudAgentId(value);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function envOpenChatId(
  provider: OpenChatProvider,
  env: Record<string, string | undefined> = {},
): string | null {
  if (provider === "codex") {
    return asCloudAgentId(env.CODEX_DIRECT_AGENT_ID) || asCloudAgentId(env.CODEX_STICKY_AGENT_ID);
  }
  return asCloudAgentId(env.CURSOR_DIRECT_AGENT_ID) || asCloudAgentId(env.CURSOR_STICKY_AGENT_ID);
}

export function allowCreateNewCloudAgent(env: Record<string, string | undefined> = {}): boolean {
  return String(env.CURSOR_DIRECT_ALLOW_CREATE || "").toLowerCase() === "true";
}

export function billingNoteForSeat(provider: string): string {
  switch (provider) {
    case "cursor":
    case "codex":
      return "Cursor Cloud (שימוש בחשבון Cursor) — לא קרדיט OpenAI ולא מנוי ChatGPT";
    case "grok":
      return "Grok Bot הקיים (webhook) — בלי סוכן רקע חדש";
    case "internal":
    case "carmen":
      return "OpenAI API (מפתח הארגון) — כרמן פנימית";
    case "chatgpt":
      return "ChatGPT Work Agent (מנוי/workspace נפרד) — לא Codex";
    default:
      return "";
  }
}

export function missingOpenChatMessage(provider: OpenChatProvider): string {
  const name = provider === "codex" ? "Codex Direct" : "Cursor Direct";
  const secret = provider === "codex" ? "CODEX_DIRECT_AGENT_ID" : "CURSOR_DIRECT_AGENT_ID";
  return (
    `${name} מדבר עם צ'אט Cursor שכבר פתוח (bc-…). ` +
    `לא פותחים סוכן רקע חדש — אין חיוב $2 על יצירה. ` +
    `חסר מזהה צ'אט פתוח (${secret} או cursor_sticky_agents). ` +
    `Codex ו-Cursor Direct הם אותו חשבון Cursor Cloud, לא קרדיט OpenAI ולא מנוי ChatGPT.`
  );
}

export function busyOpenChatMessage(provider: OpenChatProvider, url?: string | null): string {
  const name = provider === "codex" ? "Codex" : "Cursor";
  return (
    `הצ'אט הפתוח של ${name} עדיין רץ. נסה שוב בעוד דקה — לא פותחים סוכן רקע חדש על התקציב.` +
    (url ? ` מעקב: ${url}` : "")
  );
}

export async function collectOpenChatIds(
  sb: {
    from: (table: string) => any;
  },
  args: {
    tenantId: string;
    provider: OpenChatProvider;
    sessionId?: string | null;
    env?: Record<string, string | undefined>;
  },
): Promise<string[]> {
  const ids = uniqueCloudAgentIds(args.sessionId, envOpenChatId(args.provider, args.env || {}));

  if (args.provider === "cursor") {
    try {
      const { data } = await sb
        .from("cursor_sticky_agents")
        .select("cursor_agent_id")
        .eq("tenant_id", args.tenantId)
        .maybeSingle();
      ids.push(...uniqueCloudAgentIds(data?.cursor_agent_id));
    } catch { /* table may be missing on a fresh clone */ }
    try {
      const { data: last } = await sb
        .from("cursor_dispatches")
        .select("cursor_agent_id")
        .eq("tenant_id", args.tenantId)
        .not("cursor_agent_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      ids.push(...uniqueCloudAgentIds(last?.cursor_agent_id));
    } catch { /* ignore */ }
  }

  try {
    const { data: sessions } = await sb
      .from("agent_channel_sessions")
      .select("external_session_id")
      .eq("tenant_id", args.tenantId)
      .eq("provider", args.provider)
      .not("external_session_id", "is", null)
      .order("last_activity_at", { ascending: false })
      .limit(5);
    for (const row of sessions || []) {
      ids.push(...uniqueCloudAgentIds(row?.external_session_id));
    }
  } catch { /* ignore */ }

  if (args.provider === "cursor") {
    ids.push(...uniqueCloudAgentIds(FALLBACK_CURSOR_DIRECT_CHAT));
  }

  return uniqueCloudAgentIds(...ids);
}
