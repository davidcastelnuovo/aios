/** DB enum `task_status` — Carmen tools historically advertised `completed`. */
export type HumanTaskStatus = "open" | "in_progress" | "done";

export function mapHumanTaskStatus(status: string | null | undefined): HumanTaskStatus {
  const value = (status || "").trim().toLowerCase();
  if (value === "completed" || value === "done") return "done";
  if (value === "in_progress") return "in_progress";
  if (value === "open") return "open";
  throw new Error(`סטטוס משימה לא תקין: ${status}`);
}
