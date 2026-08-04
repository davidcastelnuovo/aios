export type MeetingPlatform = "zoom" | "google_meet" | "teams" | "unknown";

const PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  zoom: "Zoom",
  google_meet: "Google Meet",
  teams: "Microsoft Teams",
  unknown: "פגישה",
};

/** Normalize pasted meeting links (trim, ensure https). */
export function normalizeMeetingUrl(raw: string): string {
  let url = raw.trim();
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}

export function detectMeetingPlatform(url: string): MeetingPlatform {
  const lower = url.toLowerCase();
  if (lower.includes("zoom.us/") || lower.includes("zoom.com/")) return "zoom";
  if (lower.includes("meet.google.com/") || lower.includes("google.com/meet/")) return "google_meet";
  if (
    lower.includes("teams.microsoft.com/") ||
    lower.includes("teams.live.com/") ||
    lower.includes("gov.teams.microsoft.us/")
  ) {
    return "teams";
  }
  return "unknown";
}

export function isSupportedMeetingUrl(url: string): boolean {
  return detectMeetingPlatform(url) !== "unknown";
}

export function platformLabel(platform: MeetingPlatform): string {
  return PLATFORM_LABELS[platform];
}
