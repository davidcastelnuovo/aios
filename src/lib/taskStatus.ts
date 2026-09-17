/** DB enum `task_status` — Carmen tools historically advertised `completed`. */
export type HumanTaskStatus = "open" | "in_progress" | "done";

export const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: "פתוח", color: "hsl(217, 91%, 60%)" },
  in_progress: { label: "בתהליך", color: "hsl(45, 93%, 47%)" },
  done: { label: "הושלם", color: "hsl(142, 71%, 45%)" },
};

export function coerceHumanTaskStatus(status: string | null | undefined): HumanTaskStatus {
  const value = (status || "").trim().toLowerCase();
  if (value === "completed" || value === "done") return "done";
  if (value === "in_progress") return "in_progress";
  return "open";
}

export function mapHumanTaskStatus(status: string | null | undefined): HumanTaskStatus {
  const value = (status || "").trim().toLowerCase();
  if (value === "completed" || value === "done") return "done";
  if (value === "in_progress") return "in_progress";
  if (value === "open") return "open";
  throw new Error(`סטטוס משימה לא תקין: ${status}`);
}
