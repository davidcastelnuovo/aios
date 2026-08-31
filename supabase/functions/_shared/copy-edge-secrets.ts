/** Allowlisted Edge Function secrets that may be copied Production → Staging. */
export const AGENT_EDGE_SECRET_ALLOWLIST = [
  "CURSOR_API_KEY",
  "CURSOR_MCP_BEARER",
  "CURSOR_CLOUD_ENV_NAME",
  "CURSOR_DEFAULT_TENANT_ID",
  "CURSOR_STICKY_AGENT_ID",
  "CURSOR_DIRECT_AGENT_ID",
  "CURSOR_MODEL_ID",
  "CODEX_DIRECT_AGENT_ID",
  "CODEX_STICKY_AGENT_ID",
  "GROK_MCP_BEARER",
  "GROK_BOT_WEBHOOK_URL",
  "GROK_BOT_WEBHOOK_KEY",
  "GROK_CURSOR_MCP_BEARER",
  "GROK_DIRECT_AGENT_ID",
  "GROK_BOT_API_KEY",
  "CODEX_MODEL_ID",
  "CODEX_CLOUD_ENV_NAME",
  "CHATGPT_WORK_AGENT_TRIGGER_ID",
  "CHATGPT_WORK_AGENT_TOKEN",
  "CODEX_WORK_AGENT_TRIGGER_ID",
  "CODEX_WORK_AGENT_TOKEN",
  "AGENT_CHANNEL_CALLBACK_SECRET",
  "AGENT_CHANNEL_MCP_BEARER",
] as const;

export function isForbiddenSecretName(name: string): boolean {
  const u = name.toUpperCase();
  if (u.startsWith("SUPABASE_")) return true;
  if (u.startsWith("META_") || u.includes("WHATSAPP") || u.includes("FACEBOOK")) return true;
  if (u === "APP_URL" || u === "RESEND_API_KEY" || u === "RESEND_WEBHOOK_SECRET") return true;
  if (u.includes("MANUS")) return true;
  return false;
}

export function selectSecretsToCopy(
  requested: string[] | null | undefined,
  allowlist: readonly string[] = AGENT_EDGE_SECRET_ALLOWLIST,
): string[] {
  const src = requested?.length ? requested : [...allowlist];
  const allow = new Set(allowlist);
  return [...new Set(src.map((n) => String(n).trim()).filter(Boolean))]
    .filter((n) => allow.has(n) && !isForbiddenSecretName(n));
}

export function projectRefFromSupabaseUrl(url: string | undefined | null): string {
  const host = String(url || "").match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return host?.[1] || "";
}

export function assertSafeTargetRef(targetRef: string, sourceRef: string): string {
  const t = String(targetRef || "").trim();
  const s = String(sourceRef || "").trim();
  if (!/^[a-z]{20}$/.test(t)) throw new Error("invalid target_ref");
  if (!s) throw new Error("missing source project ref");
  if (t === s) throw new Error("refusing to copy onto the source project");
  return t;
}
