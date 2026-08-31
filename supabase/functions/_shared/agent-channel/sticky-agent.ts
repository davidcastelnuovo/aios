/** Cursor / Codex Direct — optional reuse of an open Cloud Agent chat (bc-…). */

import {
  asCursorSessionId,
  resolveCursorDirectSession,
} from "../cursor-direct-session.ts";

export type OpenChatProvider = "cursor" | "codex";

export function asCloudAgentId(value?: string | null): string | null {
  return asCursorSessionId(value);
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

/** Opt-in sticky reuse for Command Center Cursor Direct (default: new agent per message). */
export function cursorDirectStickyEnabled(env: Record<string, string | undefined> = {}): boolean {
  return String(env.CURSOR_DIRECT_STICKY || "").toLowerCase() === "true";
}

export function allowCreateNewCloudAgent(env: Record<string, string | undefined> = {}): boolean {
  if (cursorDirectStickyEnabled(env)) {
    return String(env.CURSOR_DIRECT_ALLOW_CREATE || "").toLowerCase() === "true";
  }
  return String(env.CURSOR_DIRECT_ALLOW_CREATE || "true").toLowerCase() !== "false";
}

export function billingNoteForSeat(provider: string): string {
  switch (provider) {
    case "cursor":
      return "כרמן ישיר · סוכן Cursor חדש לכל משימה";
    case "codex":
      return "ChatGPT Workspace · Work Mode (ריפו)";
    case "grok":
      return "Grok Bot הקיים (webhook) — בלי סוכן רקע חדש";
    case "internal":
    case "carmen":
      return "כרמן פנימית · OpenAI API";
    case "chatgpt":
      return "ChatGPT Work Agent";
    default:
      return "";
  }
}

export function missingOpenChatMessage(provider: OpenChatProvider): string {
  if (provider === "codex") {
    return "Codex Direct רץ ב-ChatGPT Workspace / Work Mode, לא ב-Cursor Cloud.";
  }
  return (
    "Cursor Direct לא הצליח לפתוח סוכן Cursor. " +
    "בדוק ש-CURSOR_API_KEY תקף ושהסביבה מוגדרת (CURSOR_CLOUD_ENV_NAME)."
  );
}

export function busyOpenChatMessage(provider: OpenChatProvider, url?: string | null): string {
  const name = provider === "codex" ? "Codex" : "Cursor";
  return (
    `הצ'אט הפתוח של ${name} עדיין רץ — נפתח סוכן מקביל.` +
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
  const env = args.env || {};
  const sticky = args.provider === "cursor" && cursorDirectStickyEnabled(env);

  if (!sticky) {
    return uniqueCloudAgentIds(args.sessionId);
  }

  const ids = uniqueCloudAgentIds(args.sessionId, envOpenChatId(args.provider, env));

  if (args.provider === "cursor") {
    const fixed = await resolveCursorDirectSession(sb, {
      tenantId: args.tenantId,
      env: args.env || {},
    });
    if (fixed) ids.push(fixed.sessionId);
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

  return uniqueCloudAgentIds(...ids);
}
