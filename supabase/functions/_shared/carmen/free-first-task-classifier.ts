/**
 * Heuristic intake classification for Free-First routing.
 * Safety: this only proposes routing metadata. The caller must provide verified
 * client-data sensitivity, permissions and action approvals separately.
 * No LLM invocation, tools or network calls.
 */
import type { TaskDescriptor, TaskKind } from "./free-first-types.ts";

export type TaskContext = {
  hasAttachments?: boolean;
  needsVision?: boolean;
  hasAvailableDeterministicExecutor?: boolean;
  /** Must be derived from trusted tenant policy, not the user's prompt. */
  containsClientData?: boolean;
  requiresActionApproval?: boolean;
};

type Rule = { kind: TaskKind; patterns: RegExp[]; complexity: "simple" | "medium" | "complex"; tools?: boolean };

const RULES: Rule[] = [
  { kind: "development", complexity: "complex", tools: true, patterns: [
    /(?:\b(?:code|refactor|debug|deploy|github|pull request|typescript|supabase|cursor)\b)/i,
    /(?:קוד|פיתוח|באג|תיקון מערכת|מיזוג|בראנץ|פריסה)/,
  ] },
  { kind: "strategy", complexity: "complex", patterns: [
    /(?:אסטרטגי|אסטרטגיה|תכנית שיווק|תוכנית שיווק|תוכנית צמיחה|מחקר מתחרים)/,
    /(?:\b(?:strategy|strategic|growth plan|competitor research)\b)/i,
  ] },
  { kind: "campaign_analysis", complexity: "complex", tools: true, patterns: [
    /(?:לנתח|נתחי|ניתוח|אופטימיזציה|לשפר|שפרי).{0,60}(?:קמפיין|קמפיינים|פרסום|ביצועי)/,
    /(?:\b(?:optimize|analyse campaigns|analyze campaigns|budget allocation)\b)/i,
  ] },
  { kind: "campaign_report", complexity: "medium", tools: true, patterns: [
    /(?:דוח|דו"ח|דוחות|דוחו"ת|סיכום ביצועים|תקציב מדיה|כמה לידים|כמה הוצאות|מה מצב הקמפיין)/,
    /(?:\b(?:report|campaign metrics|ad spend|cost per lead|leads today)\b)/i,
  ] },
  { kind: "lead_triage", complexity: "simple", tools: true, patterns: [
    /(?:סווג|סיווג|קטלג|שיוך ליד|איזה סגמנט|בדוק ליד)/,
    /(?:\b(?:triage lead|classify lead|lead segment|lead scoring)\b)/i,
  ] },
  { kind: "content_draft", complexity: "medium", patterns: [
    /(?:קופי|תוכן שיווקי|פוסט|מודעה|כותרת פרסומית|תסריט)/,
    /(?:\b(?:copywriting|ad copy|caption|write a post|script)\b)/i,
  ] },
  { kind: "customer_reply", complexity: "simple", patterns: [
    /(?:תענה|עני|השיבי|תגובה ללקוח|הודעה ללקוח|תנסח הודעה|נסחי הודעה)/,
    /(?:\b(?:reply to|respond to|customer reply|draft a reply)\b)/i,
  ] },
];

/**
 * If confidence is low, remain "unknown" rather than trusting a forced
 * simple classification. Policy/quality gates can then select the safe model.
 */
export function classifyCarmenTask(
  message: string,
  context: TaskContext = {},
): TaskDescriptor {
  const input = String(message || "").trim().slice(0, 4_000);
  const signals = RULES.map((rule) => ({
    rule, score: rule.patterns.reduce((n, p) => n + (p.test(input) ? 1 : 0), 0),
  })).filter((v) => v.score > 0);
  signals.sort((a, b) =>
    b.score - a.score ||
    (a.rule.complexity === "complex" ? -1 : b.rule.complexity === "complex" ? 1 : 0),
  );
  const best = signals[0]?.rule;
  const action = /(?:שלח|תשלח|שלחי|פרסם|מחוק|מחק|שנה תקציב|תגדיל תקציב|\b(?:send|publish|delete|change budget)\b)/i.test(input);
  const kind: TaskKind = !best && context.hasAvailableDeterministicExecutor
    ? "deterministic" : best?.kind ?? "unknown";
  return {
    kind,
    complexity: best?.complexity ?? "medium",
    deterministicAvailable: kind === "deterministic" && !!context.hasAvailableDeterministicExecutor,
    needsToolCalling: !!best?.tools || action,
    needsVision: !!context.needsVision || !!context.hasAttachments,
    containsClientData: context.containsClientData !== false,
    requiresActionApproval: !!context.requiresActionApproval || action,
  };
}
