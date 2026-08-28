// WhatsApp + intel-feed alerts when Recall meeting-bot credit runs out.
import {
  formatRecallBotHours,
  recallBillingDashboardUrl,
  recallCreditErrorMessage,
} from "./recall.ts";

export const DAVID_TENANT = "6ad8f321-25db-4a04-8e44-e57a7c8961b2";
const THROTTLE_HOURS = 6;

export function recallCreditEmptyWhatsApp(): string {
  return `🚨 נגמר הקרדיט של כרמן להקלטות פגישות (Recall). אי אפשר לשלוח אותה לזום/Meet/Teams עד טעינה:\n${recallBillingDashboardUrl()}`;
}

export function recallCreditRecoveredWhatsApp(): string {
  return "✅ הקרדיט ב-Recall חזר — כרמן יכולה שוב להצטרף לפגישות.";
}

export function recallBudgetWhatsApp(usageSeconds: number, budgetHours: number, pct: number): string {
  return `⚠️ רגע לפני שנגמר: כרמן השתמשה ב-${formatRecallBotHours(usageSeconds)} בוט החודש מתוך תקציב ${budgetHours} שעות (${pct.toFixed(0)}%). כדאי לטעון קרדיט ב-Recall:\n${recallBillingDashboardUrl()}`;
}

export async function notifyRecallCreditEmpty(
  supabase: { from: Function; rpc: Function },
  opts?: { throttleHours?: number },
): Promise<boolean> {
  const throttleHours = opts?.throttleHours ?? THROTTLE_HOURS;
  const since = new Date(Date.now() - throttleHours * 3600_000).toISOString();
  const { data: already } = await supabase
    .from("integration_alerts_log")
    .select("id")
    .eq("provider", "recall")
    .eq("alert_type", "quota_out")
    .gte("fired_at", since)
    .limit(1);
  if (already?.length) return false;

  await supabase.from("integration_alerts_log").insert({
    tenant_id: DAVID_TENANT,
    provider: "recall",
    alert_type: "quota_out",
    reason: recallCreditErrorMessage(),
  });
  await supabase.rpc("claude_notify_david", {
    p_message: recallCreditEmptyWhatsApp(),
  }).then(() => {}, (e: unknown) => console.error("[recall] credit notify failed", e));
  return true;
}

export async function notifyRecallCreditRecovered(
  supabase: { from: Function; rpc: Function },
): Promise<void> {
  await supabase.from("integration_alerts_log").insert({
    tenant_id: DAVID_TENANT,
    provider: "recall",
    alert_type: "reconnected",
    reason: "הקרדיט ב-Recall חזר לפעול",
  });
  await supabase.rpc("claude_notify_david", {
    p_message: recallCreditRecoveredWhatsApp(),
  }).then(() => {}, (e: unknown) => console.error("[recall] recovered notify failed", e));
}

export async function notifyRecallBudget(
  supabase: { from: Function; rpc: Function },
  alertType: "budget_80" | "budget_95",
  usageSeconds: number,
  budgetHours: number,
  monthStartIso: string,
): Promise<boolean> {
  const { data: already } = await supabase
    .from("integration_alerts_log")
    .select("id")
    .eq("provider", "recall")
    .eq("alert_type", alertType)
    .gte("fired_at", monthStartIso)
    .limit(1);
  if (already?.length) return false;

  const pct = (usageSeconds / 3600 / budgetHours) * 100;
  const reason = `שימוש בוט החודש: ${formatRecallBotHours(usageSeconds)} מתוך ${budgetHours} שעות (${pct.toFixed(0)}%)`;
  await supabase.from("integration_alerts_log").insert({
    tenant_id: DAVID_TENANT,
    provider: "recall",
    alert_type: alertType,
    reason,
  });
  if (alertType === "budget_95") {
    await supabase.rpc("claude_notify_david", {
      p_message: recallBudgetWhatsApp(usageSeconds, budgetHours, pct),
    }).then(() => {}, (e: unknown) => console.error("[recall] budget notify failed", e));
  }
  return true;
}
