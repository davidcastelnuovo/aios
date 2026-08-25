/** Copy written onto a lead when a meeting is booked. */

export function formatMeetingLeadUpdate(input: {
  dateLabel: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  subject?: string | null;
  inviteeLabels?: string[];
}): string {
  const timeRange = input.endTime
    ? `${input.startTime}–${input.endTime}`
    : input.startTime;
  const lines = [`נקבעה פגישה ל-${input.dateLabel} בשעה ${timeRange}`];
  if (input.subject?.trim()) lines.push(`נושא: ${input.subject.trim()}`);
  if (input.location?.trim()) lines.push(`מיקום: ${input.location.trim()}`);
  const invitees = (input.inviteeLabels || []).map((name) => name.trim()).filter(Boolean);
  if (invitees.length > 0) lines.push(`הוזמנו: ${invitees.join(", ")}`);
  return lines.join("\n");
}

export function formatMeetingWhatsappMessage(input: {
  contactName?: string | null;
  dateLabel: string;
  startTime: string;
  endTime?: string | null;
  location?: string | null;
  kind: "confirmation" | "same_day";
}): string {
  const name = input.contactName?.trim() || "";
  const hello = name ? `היי ${name}, ` : "";
  const timeRange = input.endTime
    ? `${input.startTime}–${input.endTime}`
    : input.startTime;
  const where = input.location?.trim() ? ` (${input.location.trim()})` : "";
  if (input.kind === "same_day") {
    return `${hello}תזכורת: היום יש לך פגישה בשעה ${timeRange}${where}.`.trim();
  }
  return `${hello}נקבעה לך פגישה ל-${input.dateLabel} בשעה ${timeRange}${where}.`.trim();
}
