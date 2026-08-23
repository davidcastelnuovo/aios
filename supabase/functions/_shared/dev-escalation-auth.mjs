/**
 * Authorization for Carmen → coding-agent escalations (Cursor / Claude / Manus MCP
 * + native GitHub-agent delegation).
 *
 * Tiers:
 * - full: David — any system/dev/config/code/DB fix via any coding agent
 * - bugfix: Ana — Cursor `request_dev_task` for reproducible bugs only
 * - null: everyone else — polite refusal; CRM tools unchanged
 *
 * Role alone is never enough — must match an allowlisted identity.
 */

/** David — full system-fix requester. */
export const FULL_DEV_REQUESTERS = Object.freeze({
  campaigner_ids: Object.freeze(["3d58377d-1518-4067-82d7-34bb615d3039"]),
  user_ids: Object.freeze(["ac7b2493-dcfa-47d8-80cc-b3900a406c46"]),
  /** Last-9 phone digits (handles 050… / 97250… / +97250…). */
  phone_suffixes: Object.freeze(["507677613"]),
});

/** Ana — bug-fix escalations to Cursor only (no open-ended dev / other agents). */
export const BUGFIX_DEV_REQUESTERS = Object.freeze({
  campaigner_ids: Object.freeze(["d6cd8d62-701e-4040-897b-cd07e119a9bd"]),
  user_ids: Object.freeze(["52eb35b4-0899-4927-b118-6cc07c164e3d"]),
  phone_suffixes: Object.freeze(["545612156"]),
});

/** @deprecated Use FULL_DEV_REQUESTERS — kept for callers/tests that import the old name. */
export const AUTHORIZED_DEV_REQUESTERS = FULL_DEV_REQUESTERS;

export const DEV_ESCALATION_REFUSAL_HE =
  "רק דיוויד (או אנה לתיקוני באגים מוגדרים) יכולים לבקש תיקוני מערכת דרכי. " +
  "אם צריך שינוי בקוד, בקונפיג או ב-DB — תעבירי את הבקשה לדיוויד או לאנה.";

export const DEV_ESCALATION_BUGFIX_ONLY_REFUSAL_HE =
  "מותר לך לשלוח ל-Cursor רק תיקוני באגים ברורים (עם צעדי שחזור). " +
  "שינויי קונפיג, הרשאות, סכמת DB או פיצ'רים חדשים — רק דיוויד.";

export function normalizePhoneSuffix(phone) {
  if (phone == null) return null;
  const digits = String(phone).replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

function matchesAllowlist(identity, allowlist) {
  const campaignerId = identity.campaignerId ? String(identity.campaignerId) : null;
  const userId = identity.userId ? String(identity.userId) : null;
  const phoneSuffix = normalizePhoneSuffix(identity.phone);
  if (campaignerId && allowlist.campaigner_ids.includes(campaignerId)) return true;
  if (userId && allowlist.user_ids.includes(userId)) return true;
  if (phoneSuffix && allowlist.phone_suffixes.includes(phoneSuffix)) return true;
  return false;
}

/**
 * @param {{ campaignerId?: string|null, userId?: string|null, phone?: string|null }} identity
 * @returns {'full'|'bugfix'|null}
 */
export function getDevEscalationTier(identity = {}) {
  if (matchesAllowlist(identity, FULL_DEV_REQUESTERS)) return "full";
  if (matchesAllowlist(identity, BUGFIX_DEV_REQUESTERS)) return "bugfix";
  return null;
}

/**
 * @param {{ campaignerId?: string|null, userId?: string|null, phone?: string|null }} identity
 */
export function isAuthorizedDevRequester(identity = {}) {
  return getDevEscalationTier(identity) !== null;
}

/**
 * Which dev-escalation tools this tier may see/call.
 * @param {'full'|'bugfix'|null} tier
 */
export function isDevEscalationToolAllowed(toolName, tier) {
  if (!tier || !toolName) return false;
  const n = String(toolName);
  if (tier === "full") return isDevEscalationTool(n);
  // bugfix: Cursor DEV task only — no ask_cursor, Claude, Manus, or GitHub agent.
  return n === "mcp_Cursor__request_dev_task" || n === "request_dev_task";
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

/** Bug-fix-only escalation skin — allowed for bugfix tier even when generic escalation skins are hidden. */
export function isBugfixEscalationSkill(slug) {
  if (!slug) return false;
  const s = String(slug).toLowerCase();
  return s === "bugfix_escalation_to_cursor" || s.includes("bugfix_escalation");
}

/**
 * @param {'full'|'bugfix'|null} tier
 */
export function buildDevEscalationPromptRule(tier) {
  if (tier === "full") {
    return (
      "\n\n🛠️ **תיקוני מערכת (מורשה — דיוויד):** המשתמש הנוכחי מורשה לבקש תיקוני מערכת / משימות פיתוח. " +
      "מותר להשתמש ב-mcp_Cursor__* / mcp_Claude__* / mcp_Manus__* / delegate_to_github_agent כשצריך."
    );
  }
  if (tier === "bugfix") {
    return (
      "\n\n🐛 **תיקוני באגים (מורשה — אנה):** המשתמש הנוכחי מורשה לשלוח **תיקוני באגים בלבד** ל-Cursor " +
      "דרך `mcp_Cursor__request_dev_task`. לפני השליחה: ודאי שיש באג ברור, צעדי שחזור, התנהגות צפויה מול בפועל, " +
      "ולקוח/מסך רלוונטי. אסור: פיצ'רים חדשים, שינויי הרשאות/roles, שינויי סכמת DB, שינויי קונפיג רחבים, " +
      "או ask_cursor / Claude / Manus / delegate_to_github_agent. " +
      "ב-task/context צייני במפורש: «Requested by Ana — BUG FIX ONLY» + צעדי שחזור. " +
      "אחרי שליחה — עדכני ש-Cursor יפתח PR ודיוויד יאשר לפני מיזוג."
    );
  }
  return (
    "\n\n🛠️ **תיקוני מערכת — חסום (חובה):** המשתמש הנוכחי אינו מורשה לבקש תיקוני מערכת דרכך. " +
    "אם מבקשים לשלוח תיקון/פיתוח/קונפיג/שינוי קוד או DB ל-Cursor / Claude / Manus / GitHub agent — " +
    "סרבי בנימוס בעברית: רק דיוויד (או אנה לבאגים מוגדרים) יכולים לבקש תיקוני מערכת דרכך. " +
    "אסור לקרוא ל-mcp_Cursor__* / mcp_Claude__* / mcp_Manus__* / delegate_to_github_agent / request_dev_task. " +
    "פעולות CRM רגילות (לקוחות, לידים, משימות, קמפיינים) ממשיכות לפי הרשאות התפקיד הקיימות."
  );
}
