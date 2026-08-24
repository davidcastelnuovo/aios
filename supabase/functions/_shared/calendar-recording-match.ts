// Match a recording to a Google Calendar Zoom event by time, then use the
// event's title as the recording name and (when unambiguous) assign its client.
//
// This is deliberately deterministic: calendar + time + an explicit client
// name is strong enough for auto-assignment without asking an LLM.
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase Edge client is dynamically imported. */

const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const EVENT_START_TOLERANCE_MS = 30 * 60 * 1000;
const EVENT_OVERLAP_TOLERANCE_MS = 10 * 60 * 1000;
const MAX_CALENDAR_TOKENS = 5;
const MAX_CALENDARS_PER_USER = 20;

export interface CalendarEventLike {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  conferenceData?: {
    entryPoints?: { uri?: string }[];
  };
}

export interface CalendarClient {
  id: string;
  name: string;
}

export interface CalendarRecording {
  id: string;
  tenant_id: string;
  meeting_id?: string | null;
  meeting_topic?: string | null;
  start_time: string | null;
  duration?: number | null;
  host_email?: string | null;
  client_id?: string | null;
  calendar_event_id?: string | null;
}

export interface CalendarRecordingMatch {
  eventId: string;
  eventTitle: string;
  eventStart: string;
  clientId: string | null;
  clientName: string | null;
  startDeltaMinutes: number;
}

export interface CalendarMatchContext {
  events: CalendarEventLike[];
  clients: CalendarClient[];
}

function eventDateTime(value?: { dateTime?: string; date?: string }): string | null {
  return value?.dateTime || null; // all-day events cannot match a recording
}

function calendarEventText(event: CalendarEventLike): string {
  const conferenceUris = event.conferenceData?.entryPoints
    ?.map((entry) => entry.uri || "")
    .join(" ") || "";
  return [
    event.summary,
    event.description,
    event.location,
    event.hangoutLink,
    conferenceUris,
  ].filter(Boolean).join(" ");
}

export function isZoomCalendarEvent(event: CalendarEventLike): boolean {
  const text = calendarEventText(event);
  return /(?:https?:\/\/)?(?:[\w.-]+\.)?zoom\.(?:us|com)\//i.test(text)
    || /(?:^|\s)(?:zoom|זום)(?:\s|$)/i.test(event.summary || "");
}

export function normalizeCalendarMatchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("he")
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clientNameVariants(name: string): string[] {
  const normalized = normalizeCalendarMatchText(name);
  const withoutLegalSuffix = normalized
    .replace(/\b(?:בעמ|ltd|limited|inc|llc)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return [...new Set([normalized, withoutLegalSuffix])]
    .filter((value) => value.replace(/\s/g, "").length >= 3);
}

export function matchClientFromCalendarTitle(
  title: string,
  clients: CalendarClient[],
): CalendarClient | null {
  const normalizedTitle = ` ${normalizeCalendarMatchText(title)} `;
  const matches = clients
    .flatMap((client) =>
      clientNameVariants(client.name)
        .filter((variant) => normalizedTitle.includes(` ${variant} `))
        .map((variant) => ({ client, score: variant.length }))
    )
    .sort((a, b) => b.score - a.score);

  if (matches.length === 0) return null;
  const bestScore = matches[0].score;
  const bestIds = new Set(matches.filter((match) => match.score === bestScore).map((match) => match.client.id));
  return bestIds.size === 1 ? matches[0].client : null;
}

function isMeaningfulEventTitle(title: string): boolean {
  const normalized = normalizeCalendarMatchText(title);
  return !!normalized && !new Set([
    "zoom meeting",
    "פגישת zoom",
    "פגישת זום",
    "meeting",
    "פגישה",
  ]).has(normalized);
}

export function chooseCalendarRecordingMatch(
  recording: Pick<CalendarRecording, "start_time" | "duration">,
  events: CalendarEventLike[],
  clients: CalendarClient[],
): CalendarRecordingMatch | null {
  if (!recording.start_time) return null;
  const recordingStart = new Date(recording.start_time).getTime();
  if (!Number.isFinite(recordingStart)) return null;
  const recordingEnd = recordingStart + Math.max(1, recording.duration || 1) * 60 * 1000;

  const candidates = events.flatMap((event) => {
    if (event.status === "cancelled" || !event.id || !isZoomCalendarEvent(event)) return [];
    const startIso = eventDateTime(event.start);
    if (!startIso) return [];
    const eventStart = new Date(startIso).getTime();
    if (!Number.isFinite(eventStart)) return [];
    const endIso = eventDateTime(event.end);
    const eventEnd = endIso ? new Date(endIso).getTime() : eventStart + 60 * 60 * 1000;
    const startDelta = Math.abs(eventStart - recordingStart);
    const overlaps = eventStart <= recordingEnd + EVENT_OVERLAP_TOLERANCE_MS
      && eventEnd >= recordingStart - EVENT_OVERLAP_TOLERANCE_MS;
    if (startDelta > EVENT_START_TOLERANCE_MS && !overlaps) return [];

    const title = (event.summary || "").trim();
    if (!isMeaningfulEventTitle(title)) return [];
    return [{ event, title, startIso, startDelta }];
  }).sort((a, b) => a.startDelta - b.startDelta);

  if (candidates.length === 0) return null;
  const best = candidates[0];
  const client = matchClientFromCalendarTitle(best.title, clients);
  return {
    eventId: best.event.id!,
    eventTitle: best.title,
    eventStart: best.startIso,
    clientId: client?.id || null,
    clientName: client?.name || null,
    startDeltaMinutes: Math.round(best.startDelta / 60000),
  };
}

// deno-lint-ignore no-explicit-any
async function refreshCalendarToken(admin: any, token: any): Promise<string | null> {
  const expiresAt = new Date(token.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return token.access_token;
  }

  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !token.refresh_token) return null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (!data.access_token) {
    if (data.error === "invalid_grant") {
      await admin.from("calendar_tokens").update({
        needs_reconnect: true,
        sync_status: "needs_reconnect",
        sync_error: "refresh token revoked",
      }).eq("user_id", token.user_id);
    }
    return null;
  }

  await admin.from("calendar_tokens").update({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    needs_reconnect: false,
  }).eq("user_id", token.user_id);
  return data.access_token;
}

async function fetchEventsForToken(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEventLike[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const listResponse = await fetch(
    `${GOOGLE_CALENDAR_BASE}/users/me/calendarList?maxResults=${MAX_CALENDARS_PER_USER}`,
    { headers },
  );

  let calendarIds = ["primary"];
  if (listResponse.ok) {
    const listData = await listResponse.json();
    const listed = Array.isArray(listData.items)
      ? listData.items
        .filter((calendar: { deleted?: boolean; selected?: boolean; primary?: boolean }) =>
          !calendar.deleted && (calendar.selected !== false || calendar.primary)
        )
        .map((calendar: { id?: string }) => calendar.id)
        .filter(Boolean)
      : [];
    if (listed.length > 0) calendarIds = [...new Set(listed)] as string[];
  }

  const eventBatches = await Promise.all(calendarIds.map(async (calendarId) => {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("timeMin", timeMin);
    url.searchParams.set("timeMax", timeMax);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.items) ? data.items : [];
  }));
  return eventBatches.flat();
}

// deno-lint-ignore no-explicit-any
async function calendarTokenCandidates(admin: any, opts: {
  tenantId: string;
  preferredUserId?: string | null;
  hostEmail?: string | null;
}): Promise<any[]> {
  const userIds: string[] = [];
  if (opts.preferredUserId) userIds.push(opts.preferredUserId);

  const [{ data: tenantUsers }, { data: campaigners }] = await Promise.all([
    admin.from("tenant_users").select("user_id").eq("tenant_id", opts.tenantId).limit(30),
    admin.from("campaigners").select("id").eq("tenant_id", opts.tenantId).eq("active", true).limit(30),
  ]);
  userIds.push(...(tenantUsers || []).map((row: { user_id: string }) => row.user_id));

  const campaignerIds = (campaigners || []).map((row: { id: string }) => row.id);
  if (campaignerIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .in("campaigner_id", campaignerIds);
    userIds.push(...(profiles || []).map((row: { id: string }) => row.id));
  }

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  let tokens: any[] = [];
  if (uniqueUserIds.length > 0) {
    const { data } = await admin
      .from("calendar_tokens")
      .select("user_id, access_token, refresh_token, expires_at, google_email, needs_reconnect")
      .in("user_id", uniqueUserIds)
      .limit(30);
    tokens = data || [];
  }

  if (opts.hostEmail) {
    const { data: hostToken } = await admin
      .from("calendar_tokens")
      .select("user_id, access_token, refresh_token, expires_at, google_email, needs_reconnect")
      .ilike("google_email", opts.hostEmail)
      .maybeSingle();
    if (hostToken && !tokens.some((token) => token.user_id === hostToken.user_id)) {
      tokens.unshift(hostToken);
    }
  }

  const priority = new Map<string, number>();
  if (opts.preferredUserId) priority.set(opts.preferredUserId, 0);
  return tokens
    .filter((token) => !token.needs_reconnect)
    .sort((a, b) => (priority.get(a.user_id) ?? 1) - (priority.get(b.user_id) ?? 1))
    .slice(0, MAX_CALENDAR_TOKENS);
}

// deno-lint-ignore no-explicit-any
export async function loadCalendarMatchContext(admin: any, opts: {
  tenantId: string;
  timeMin: string;
  timeMax: string;
  preferredUserId?: string | null;
  hostEmail?: string | null;
}): Promise<CalendarMatchContext> {
  try {
    const [{ data: clients }, tokens] = await Promise.all([
      admin.from("clients").select("id, name").eq("tenant_id", opts.tenantId),
      calendarTokenCandidates(admin, opts),
    ]);

    const allEvents: CalendarEventLike[] = [];
    for (const token of tokens) {
      const accessToken = await refreshCalendarToken(admin, token);
      if (!accessToken) continue;
      try {
        allEvents.push(...await fetchEventsForToken(accessToken, opts.timeMin, opts.timeMax));
      } catch (error) {
        console.warn("[calendar-recording-match] calendar fetch failed", token.user_id, error);
      }
    }

    const eventMap = new Map<string, CalendarEventLike>();
    for (const event of allEvents) {
      if (event.id) eventMap.set(event.id, event);
    }
    return {
      events: [...eventMap.values()],
      clients: (clients || []) as CalendarClient[],
    };
  } catch (error) {
    console.warn("[calendar-recording-match] context load failed", error);
    return { events: [], clients: [] };
  }
}

// deno-lint-ignore no-explicit-any
export async function enrichRecordingFromCalendar(admin: any, recording: CalendarRecording, opts?: {
  preferredUserId?: string | null;
  context?: CalendarMatchContext;
}): Promise<CalendarRecordingMatch | null> {
  if (!recording.start_time || recording.calendar_event_id) return null;
  const start = new Date(recording.start_time);
  if (!Number.isFinite(start.getTime())) return null;

  const context = opts?.context || await loadCalendarMatchContext(admin, {
    tenantId: recording.tenant_id,
    timeMin: new Date(start.getTime() - 90 * 60 * 1000).toISOString(),
    timeMax: new Date(start.getTime() + Math.max(120, recording.duration || 0) * 60 * 1000).toISOString(),
    preferredUserId: opts?.preferredUserId,
    hostEmail: recording.host_email,
  });
  const match = chooseCalendarRecordingMatch(recording, context.events, context.clients);
  if (!match) return null;

  const updates: Record<string, unknown> = {
    meeting_topic: match.eventTitle,
    calendar_event_id: match.eventId,
    calendar_matched_at: new Date().toISOString(),
  };

  let query = admin.from("zoom_recordings")
    .update(updates)
    .eq("tenant_id", recording.tenant_id);
  query = recording.meeting_id
    ? query.eq("meeting_id", recording.meeting_id)
    : query.eq("id", recording.id);
  const { error } = await query;
  if (error) {
    console.error("[calendar-recording-match] recording update failed", error);
    return null;
  }

  if (!recording.client_id && match.clientId) {
    let clientQuery = admin.from("zoom_recordings")
      .update({ client_id: match.clientId, suggested_client_id: null })
      .eq("tenant_id", recording.tenant_id)
      .is("client_id", null);
    clientQuery = recording.meeting_id
      ? clientQuery.eq("meeting_id", recording.meeting_id)
      : clientQuery.eq("id", recording.id);
    const { error: clientError } = await clientQuery;
    if (clientError) {
      console.error("[calendar-recording-match] client assignment failed", clientError);
    }
  }

  console.log(
    `[calendar-recording-match] matched "${match.eventTitle}" (${match.startDeltaMinutes}m)`
      + (match.clientName ? ` → client ${match.clientName}` : ""),
  );
  return match;
}
