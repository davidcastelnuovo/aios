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

/** Pull the first Zoom / Meet / Teams join URL from free text (e.g. WhatsApp). */
export function extractMeetingUrl(text: string): string | null {
  const m = text.match(
    /https?:\/\/(?:[\w.-]+\.)?(?:zoom\.us\/\S+|meet\.google\.com\/\S+|teams\.microsoft\.com\/\S+|teams\.live\.com\/\S+)/i,
  );
  if (!m) return null;
  return m[0].replace(/[)\]},.!?]+$/g, "");
}

export function platformLabel(platform: MeetingPlatform): string {
  return PLATFORM_LABELS[platform];
}
