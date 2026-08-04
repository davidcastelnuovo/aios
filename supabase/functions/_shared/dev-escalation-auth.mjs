/**
 * Authorization for Carmen → coding-agent escalations (Cursor / Claude / Manus MCP
 * + native GitHub-agent delegation). Only explicitly allowlisted requesters may
 * ask Carmen to create system/dev/config/code/DB fix tasks.
 *
 * Normal CRM tools stay governed by existing role/scope checks.
 */

/** David — currently the only authorized system-fix requester. */
export const AUTHORIZED_DEV_REQUESTERS = Object.freeze({
  campaigner_ids: Object.freeze(["3d58377d-1518-4067-82d7-34bb615d3039"]),
  user_ids: Object.freeze(["ac7b2493-dcfa-47d8-80cc-b3900a406c46"]),
  /** Last-9 phone digits (handles 050… / 97250… / +97250…). */
  phone_suffixes: Object.freeze(["507677613"]),
});

export const DEV_ESCALATION_REFUSAL_HE =
  "רק דיוויד יכול לאשר תיקוני מערכת / משימות פיתוח דרכי (Cursor/Claude/Manus). " +
  "אם צריך שינוי בקוד, בקונפיג או ב-DB — תעבירי את הבקשה לדיוויד.";

export function normalizePhoneSuffix(phone) {
  if (phone == null) return null;
  const digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/**
 * @param {{ campaignerId?: string|null, userId?: string|null, phone?: string|null }} identity
 */
export function isAuthorizedDevRequester(identity = {}) {
  const campaignerId = identity.campaignerId ? String(identity.campaignerId) : null;
  const userId = identity.userId ? String(identity.userId) : null;
  const phoneSuffix = normalizePhoneSuffix(identity.phone);

  if (campaignerId && AUTHORIZED_DEV_REQUESTERS.campaigner_ids.includes(campaignerId)) return true;
  if (userId && AUTHORIZED_DEV_REQUESTERS.user_ids.includes(userId)) return true;
  if (phoneSuffix && AUTHORIZED_DEV_REQUESTERS.phone_suffixes.includes(phoneSuffix)) return true;
  return false;
}

/** MCP / native tools that create or send system/dev/config/code fixes. */
export function isDevEscalationTool(toolName) {
  if (!toolName) return false;
  const n = String(toolName);
  if (n.startsWith("mcp_Cursor__") || n.startsWith("mcp_Claude__") || n.startsWith("mcp_Manus__")) {
    return true;
  }
  if (n === "delegate_to_github_agent") return true;
  // Defensive: unprefixed remote names if ever executed without mcp_ prefix.
  if (/^(request_dev_task|ask_cursor|ask_claude|ask_manus)$/i.test(n)) return true;
  return false;
}

/** Skins that instruct Carmen to escalate to coding agents — suppress when unauthorized. */
export function isDevEscalationSkill(slug) {
  if (!slug) return false;
  const s = String(slug).toLowerCase();
  return (
    s === "cursor_escalation" ||
    s === "claude_escalation" ||
    s === "manus_escalation" ||
    s.includes("cursor_escalation") ||
    s.includes("claude_escalation")
  );
}

export function buildDevEscalationPromptRule(authorized) {
  if (authorized) {
    return (
      "\n\n🛠️ **תיקוני מערכת (מורשה):** המשתמש הנוכחי מורשה לבקש תיקוני מערכת / משימות פיתוח. " +
      "מותר להשתמש ב-mcp_Cursor__* / mcp_Claude__* / mcp_Manus__* / delegate_to_github_agent כשצריך."
    );
  }
  return (
    "\n\n🛠️ **תיקוני מערכת — חסום (חובה):** המשתמש הנוכחי אינו מורשה לבקש תיקוני מערכת דרכך. " +
    "אם מבקשים לשלוח תיקון/פיתוח/קונפיג/שינוי קוד או DB ל-Cursor / Claude / Manus / GitHub agent — " +
    "סרבי בנימוס בעברית: רק דיוויד יכול לאשר תיקוני מערכת דרכך. " +
    "אסור לקרוא ל-mcp_Cursor__* / mcp_Claude__* / mcp_Manus__* / delegate_to_github_agent / request_dev_task. " +
    "פעולות CRM רגילות (לקוחות, לידים, משימות, קמפיינים) ממשיכות לפי הרשאות התפקיד הקיימות."
  );
}
