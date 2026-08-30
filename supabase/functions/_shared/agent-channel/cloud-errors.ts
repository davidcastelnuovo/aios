export function grokUsesExistingWebhook(url?: string | null, key?: string | null): boolean {
  return Boolean(String(url || "").trim() && String(key || "").trim());
}

export function isCursorSpendLimitError(message: string): boolean {
  return /usage-based|spend limit|hard limit|תקציב/i.test(message || "");
}

export function formatCloudAgentError(status: number, detail: string): string {
  const d = String(detail || "").trim();
  if (status === 401 || status === 403) {
    return "מפתח Cursor API לא תקף. הפריוויו מדבר עם Staging.";
  }
  if (status === 400 && isCursorSpendLimitError(d)) {
    return (
      "Cursor Cloud סירב לפתוח סוכן רקע חדש (תקציב Usage-based < $2). " +
      "Cursor Direct אמור לדבר עם צ'אט כרמן ישיר שכבר פתוח, בלי סוכן חדש. " +
      "https://www.cursor.com/dashboard?tab=settings"
    );
  }
  return `Cloud agent create ${status}: ${d.slice(0, 280)}`;
}
