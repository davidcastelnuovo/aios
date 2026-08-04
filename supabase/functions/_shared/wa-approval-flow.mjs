/**
 * WhatsApp / chat approval-flow helpers for Carmen Meta (and other) pending actions.
 * Detects explicit confirm/reject phrases and helps resolve the latest matching
 * pending approval without repeated "לאשר?" loops.
 */

export const META_APPROVAL_TOOLS = Object.freeze([
  "fb_duplicate_ad_variants",
  "duplicate_facebook_ad_variants",
  "toggle_facebook_campaign",
  "duplicate_facebook_campaign",
  "update_facebook_budget",
  "fb_create_campaign",
  "fb_create_adset",
  "fb_create_ad",
  "fb_create_creative_from_media",
  "fb_replace_lead_form",
  "fb_update_budget",
  "fb_pause",
  "fb_resume",
  "gads_pause",
  "gads_resume",
  "gads_update_budget",
]);

/** Strip WhatsApp noise (🎤 prefix, punctuation) for phrase matching. */
export function normalizeApprovalText(text) {
  if (text == null) return "";
  return String(text)
    .replace(/🎤/g, " ")
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Explicit user confirmation that a prepared approval should run.
 * Matches short WhatsApp replies: כן / מאשר / כן מאשר / אשרי / תעשי את זה / yes / approve.
 */
export function isExplicitApprovalPhrase(text) {
  const t = normalizeApprovalText(text);
  if (!t || t.length > 80) return false;
  const lower = t.toLowerCase();

  // Pure / near-pure Hebrew confirms
  if (/^(כן|כן\.|כֵן)([\s,!.]*)$/u.test(t)) return true;
  if (/^(כן\s+מאשר|מאשר|מאשרת|אשרי|אשר|מאשר\/ת)([\s,!.]*)$/u.test(t)) return true;
  if (/^(כן[\s,]+)?(תעשי|תעשה|תבצעי|תבצע|תריצי|תריץ)\s+(את\s+)?(זה|הפעולה|הבקשה|האישור)([\s,!.]*)$/u.test(t)) {
    return true;
  }
  if (/^(יאללה|סבבה|בסדר|אוקיי|אוקי|ok|okay)\s*,?\s*(כן|תעשי|תבצעי)?([\s,!.]*)$/iu.test(t)) {
    // Only when paired with confirm intent or alone as ack after approval ask —
    // require כן/תעשי or exact ok/סבבה alone under 12 chars.
    if (/כן|תעשי|תבצעי|תעשה|תבצע/u.test(t)) return true;
    if (/^(יאללה|סבבה|בסדר|אוקיי|אוקי|ok|okay)([\s,!.]*)$/iu.test(t) && t.length <= 12) return true;
  }

  // English
  if (/^(yes|yep|yeah|approve|approved|do\s+it|go\s+ahead|confirm|confirmed)([\s,!.]*)$/i.test(lower)) {
    return true;
  }
  if (/^(yes[\s,]+)?(please\s+)?(do\s+it|go\s+ahead|approve)([\s,!.]*)$/i.test(lower)) return true;

  // Soft: "כן מאשר את השכפול" etc. — starts with confirm + short rest
  if (/^(כן(\s+מאשר)?|מאשר|אשרי)\b/u.test(t) && t.length <= 40) return true;

  return false;
}

export function isExplicitRejectionPhrase(text) {
  const t = normalizeApprovalText(text);
  if (!t || t.length > 80) return false;
  const lower = t.toLowerCase();
  if (/^(לא|לא\.|לא\s+מאשר|דחה|דחי|בטל|ביטול)([\s,!.]*)$/u.test(t)) return true;
  if (/^(no|nope|reject|cancel|don't|do\s+not)([\s,!.]*)$/i.test(lower)) return true;
  return false;
}

export function isMetaApprovalTool(toolName) {
  if (!toolName) return false;
  return META_APPROVAL_TOOLS.includes(String(toolName));
}

/**
 * Pick the best pending row from a newest-first list.
 * Prefer Meta mutating tools when preferMeta is true.
 */
export function pickLatestPendingApproval(rows, opts = {}) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (list.length === 0) return null;
  const preferMeta = opts.preferMeta !== false;
  if (preferMeta) {
    const meta = list.find((r) => isMetaApprovalTool(r.tool_name));
    if (meta) return meta;
  }
  if (opts.toolName) {
    const match = list.find((r) => r.tool_name === opts.toolName);
    if (match) return match;
  }
  return list[0];
}

/**
 * Build recovery payload when user confirmed but nothing is pending.
 * Uses the newest recent Meta (or any) approval that still has tool_input.
 */
export function buildNoPendingRecovery(recentRows) {
  const list = Array.isArray(recentRows) ? recentRows.filter(Boolean) : [];
  const candidate =
    list.find((r) => isMetaApprovalTool(r.tool_name) && r.tool_input && r.status !== "executed") ||
    list.find((r) => isMetaApprovalTool(r.tool_name) && r.tool_input) ||
    list.find((r) => r.tool_input && r.status !== "executed") ||
    null;

  if (!candidate) {
    return {
      recovery: null,
      instruction_for_carmen:
        "אין בקשת אישור פתוחה וגם אין בקשה אחרונה לשחזור. אל תטעני שבוצע משהו. שאלי בקצרה מה הפעולה שצריך להכין מחדש, הכיני approval אחד, הציגי סיכום, ובקשי אישור סופי אחד בלבד.",
    };
  }

  const variantPreview =
    candidate.context?.variant_previews ||
    candidate.tool_input?.variants ||
    null;

  return {
    recovery: {
      mode: "recreate_once",
      previous_approval_id: candidate.id,
      previous_status: candidate.status,
      tool_name: candidate.tool_name,
      tool_input: candidate.tool_input,
      title: candidate.title,
      description: candidate.description,
      summary: candidate.title || candidate.description || candidate.tool_name,
      variant_previews: variantPreview,
    },
    instruction_for_carmen:
      "אין pending כרגע. שחזרי פעם אחת בלבד את אותה בקשה עם אותו tool_name + tool_input (או קראי לכלי המקורי עם אותם ארגומנטים), הציגי סיכום ברור מה יקרה, ובקשי אישור סופי אחד: \"לאשר? (כן/לא)\". " +
      "אחרי שהמשתמש יאשר שוב — חובה לקרוא ל-execute_pending_approval. אסור לטעון שבוצע בלי הצלחת execute_pending_approval. אסור ללולאת אישורים חוזרת.",
  };
}

export function buildApprovalConfirmPromptRule(pending) {
  if (!pending) {
    return (
      "\n\n✅ **אישור WhatsApp:** המשתמש אישר במפורש. חובה עכשיו לקרוא ל-execute_pending_approval " +
      "(בלי approval_id אם צריך — הכלי יבחר את ה-pending האחרון). " +
      "אם הכלי מחזיר no_pending_approval עם recovery — שחזרי פעם אחת והבקשי אישור סופי אחד. " +
      "אסור לכתוב שבוצע/נוצר/עודכן בלי success=true מ-execute_pending_approval."
    );
  }
  return (
    `\n\n✅ **אישור WhatsApp (חובה לבצע עכשיו):** המשתמש אישר במפורש את הבקשה הפתוחה:\n` +
    `• approval_id: ${pending.id}\n` +
    `• פעולה: ${pending.title || pending.tool_name}\n` +
    `קראי מיד ל-execute_pending_approval עם approval_id="${pending.id}". ` +
    `אל תיצרי בקשת אישור חדשה. אל תשאלי שוב "לאשר?". ` +
    `אסור לכתוב שבוצע בלי שהכלי החזיר success=true.`
  );
}

export function formatApprovalExecutionReply(execResult, pendingRow) {
  const title = pendingRow?.title || pendingRow?.tool_name || "הפעולה";
  const ok = !!(execResult && (execResult.success === true || execResult.already_executed === true));
  if (ok) {
    const already = execResult.already_executed ? " (כבר בוצע קודם)" : "";
    return `בוצע: ${title}${already}.`;
  }
  const err =
    execResult?.error ||
    execResult?.result?.error ||
    execResult?.message ||
    "הביצוע נכשל";
  return `לא הצלחתי לבצע את "${title}": ${err}. לא בוצע כלום ב-Meta.`;
}

export function buildApprovalFlowAcceptanceCases() {
  return {
    approve: ["כן", "מאשר", "כן מאשר", "אשרי", "תעשי את זה", "yes", "approve", "go ahead", "כן."],
    reject: ["לא", "לא מאשר", "no", "reject"],
    notApproval: ["כן אבל תבדקי קודם את התקציב של כל הקמפיינים לפני", "מה מצב הלידים היום?"],
  };
}
