/**
 * Google Calendar conference + attendee helpers for Carmen tools.
 * Meet is always available via Calendar API. Zoom requires tenant_integrations.zoom.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : '';
}

export function collectExtraAttendeeEmails(args) {
  const out = [];
  const push = (raw) => {
    if (Array.isArray(raw)) {
      for (const item of raw) push(item);
      return;
    }
    if (raw && typeof raw === 'object') {
      const email = normalizeEmail(raw.email);
      if (email) out.push(email);
      return;
    }
    const text = String(raw || '');
    for (const part of text.split(/[,\s;]+/)) {
      const email = normalizeEmail(part);
      if (email) out.push(email);
    }
  };
  push(args?.add_attendee_emails);
  push(args?.attendee_emails);
  push(args?.attendee_email);
  push(args?.carmen_email);
  return [...new Set(out)];
}

export function mergeAttendees(existing, extraEmails, extraNamed = []) {
  const byEmail = new Map();
  for (const row of existing || []) {
    const email = normalizeEmail(row?.email);
    if (!email) continue;
    byEmail.set(email, { ...row, email });
  }
  for (const named of extraNamed) {
    const email = normalizeEmail(named?.email);
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      email,
      ...(named.displayName ? { displayName: String(named.displayName) } : {}),
    });
  }
  for (const email of extraEmails || []) {
    const normalized = normalizeEmail(email);
    if (!normalized || byEmail.has(normalized)) continue;
    byEmail.set(normalized, { email: normalized });
  }
  return [...byEmail.values()];
}

export function mergeNamedPrimaryAttendee(primaryEmail, primaryName, extraEmails, extraNamed = []) {
  return mergeAttendees(
    [],
    extraEmails,
    [
      { email: primaryEmail, ...(primaryName ? { displayName: String(primaryName) } : {}) },
      ...(extraNamed || []),
    ],
  );
}

export function extractConferenceUrl(event) {
  const hangout = String(event?.hangoutLink || '').trim();
  if (hangout) return hangout;
  const entries = event?.conferenceData?.entryPoints || [];
  const video = entries.find((e) => e?.entryPointType === 'video' && e?.uri) || entries.find((e) => e?.uri);
  if (video?.uri) return String(video.uri);
  const location = String(event?.location || '');
  const locMatch = location.match(/https?:\/\/\S+/i);
  if (locMatch) return locMatch[0];
  const description = String(event?.description || '');
  const descMatch = description.match(/https?:\/\/(?:[\w.-]+\.)?(?:zoom\.(?:us|com)\/\S+|meet\.google\.com\/\S+)/i);
  return descMatch ? descMatch[0].replace(/[)\].,;]+$/, '') : null;
}

export function conferenceKindFromUrl(url) {
  const value = String(url || '').toLowerCase();
  if (value.includes('zoom.us') || value.includes('zoom.com')) return 'zoom';
  if (value.includes('meet.google.com')) return 'meet';
  if (value.includes('teams.microsoft.com') || value.includes('teams.live.com')) return 'teams';
  return url ? 'other' : 'none';
}

export function eventDurationMinutes(event, fallback = 60) {
  const start = Date.parse(event?.start?.dateTime || '');
  const end = Date.parse(event?.end?.dateTime || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fallback;
  return Math.max(15, Math.round((end - start) / 60_000));
}

export function resolveRequestedConference(args) {
  const raw = String(args?.conference_type || args?.conference || args?.video_type || '').trim().toLowerCase();
  if (raw === 'none' || raw === 'off' || args?.add_conference === false) return 'none';
  if (/zoom|זום/.test(raw)) return 'zoom';
  if (/meet|google|גוגל/.test(raw)) return 'meet';
  if (args?.add_conference === true || args?.add_video === true || args?.add_meet === true) return 'meet';
  return 'none';
}

export function buildMeetConferenceData(requestId) {
  return {
    createRequest: {
      requestId: String(requestId || crypto.randomUUID()),
      conferenceSolutionKey: { type: 'hangoutsMeet' },
    },
  };
}

export function applyZoomLinkToEvent(event, joinUrl) {
  const url = String(joinUrl || '').trim();
  const description = String(event?.description || '');
  const already = description.includes(url);
  return {
    location: url || event?.location || '',
    description: already || !url
      ? description
      : `${description}${description ? '\n\n' : ''}Zoom: ${url}`,
  };
}

export function googleEventPatchUrl(eventId, { conference = false } = {}) {
  const params = new URLSearchParams({ sendUpdates: 'all' });
  if (conference) params.set('conferenceDataVersion', '1');
  return `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(String(eventId))}?${params}`;
}

export function summarizeEventResult(event, extras = {}) {
  const conference_url = extractConferenceUrl(event);
  const attendees = (event?.attendees || []).map((a) => a.email).filter(Boolean);
  return {
    success: true,
    event_id: event?.id || null,
    event_link: event?.htmlLink || null,
    title: event?.summary || null,
    start: event?.start?.dateTime || event?.start?.date || null,
    attendees,
    conference_url,
    conference_type: conferenceKindFromUrl(conference_url),
    ...extras,
  };
}

export function zoomUnavailableMessage() {
  return 'Zoom לא מוגדר בטננט (חסר tenant_integrations.zoom עם account_id/client_id/client_secret). נוצר Google Meet במקום.';
}

export async function resolveCarmenAttendeeEmail(supabase, tenantId, explicitEmail) {
  const fromArg = normalizeEmail(explicitEmail);
  if (fromArg) return { email: fromArg, source: 'argument' };

  const envEmail = normalizeEmail(
    (typeof Deno !== 'undefined' && Deno.env?.get?.('CARMEN_CALENDAR_EMAIL')) || '',
  );
  if (envEmail) return { email: envEmail, source: 'env' };

  if (!supabase || !tenantId) {
    return { email: null, source: null, error: 'לא נמצא מייל לכרמן — העבירי carmen_email או חברי קמפיינר בשם כרמן עם מייל.' };
  }

  const { data, error } = await supabase
    .from('campaigners')
    .select('email, name')
    .eq('tenant_id', tenantId)
    .or('name.ilike.%כרמן%,name.ilike.%carmen%')
    .not('email', 'is', null)
    .limit(5);
  if (error) return { email: null, source: null, error: `חיפוש מייל כרמן נכשל: ${error.message}` };
  const hit = (data || []).find((row) => normalizeEmail(row.email));
  if (hit) return { email: normalizeEmail(hit.email), source: 'campaigner' };
  return {
    email: null,
    source: null,
    error: 'לא נמצא מייל לכרמן בטננט. הוסיפי carmen_email בכלי, או קמפיינר בשם כרמן עם כתובת מייל. בינתיים אפשר לצרף אותה כבוט עם join_meeting_for_client אחרי שיש conference_url.',
  };
}

export async function fetchZoomAccessToken(supabase, tenantId, fetchImpl = fetch) {
  const { data, error } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'zoom')
    .eq('is_active', true)
    .maybeSingle();
  if (error) return { error: `שגיאת Zoom: ${error.message}` };
  const settings = data?.settings || {};
  if (!settings.account_id || !settings.client_id || !settings.client_secret) {
    return { error: zoomUnavailableMessage(), configured: false };
  }
  const tokenResponse = await fetchImpl('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${settings.client_id}:${settings.client_secret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'account_credentials',
      account_id: settings.account_id,
    }),
  });
  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    return { error: `אימות Zoom נכשל: ${errText.slice(0, 200)}`, configured: true };
  }
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return { error: 'Zoom לא החזיר access_token', configured: true };
  return { accessToken: tokenData.access_token, configured: true };
}

export async function createZoomMeeting({ accessToken, topic, startDateTime, durationMinutes, fetchImpl = fetch }) {
  const body = {
    topic: topic || 'Meeting',
    type: 2,
    start_time: startDateTime,
    duration: durationMinutes || 60,
    timezone: 'Asia/Jerusalem',
    settings: {
      join_before_host: true,
      waiting_room: false,
      meeting_authentication: false,
    },
  };
  const resp = await fetchImpl('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { error: `יצירת פגישת Zoom נכשלה: ${data?.message || resp.status}` };
  }
  if (!data.join_url) return { error: 'Zoom לא החזיר join_url' };
  return { join_url: data.join_url, meeting_id: data.id, start_url: data.start_url || null };
}

export async function googleCalendarGetEvent(accessToken, eventId, fetchImpl = fetch) {
  const resp = await fetchImpl(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(String(eventId))}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { error: `שגיאת Google Calendar (קריאת אירוע): ${data?.error?.message || resp.status}` };
  }
  return { event: data };
}

export async function googleCalendarPatchEvent(accessToken, eventId, patch, { conference = false } = {}, fetchImpl = fetch) {
  const resp = await fetchImpl(googleEventPatchUrl(eventId, { conference }), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { error: `שגיאת Google Calendar: ${data?.error?.message || resp.status}` };
  }
  return { event: data };
}

/**
 * GET existing event, merge attendees, add Meet/Zoom conference without dropping guests.
 */
export async function updateExistingCalendarEvent({
  accessToken,
  eventId,
  fieldPatch = {},
  conferenceType = 'none',
  extraEmails = [],
  extraNamed = [],
  createZoomMeetingFn = null,
  fetchImpl = fetch,
}) {
  const got = await googleCalendarGetEvent(accessToken, eventId, fetchImpl);
  if (got.error) return got;
  const existing = got.event;

  const patch = { ...fieldPatch };
  const existingAttendees = existing.attendees || [];
  const mergedAttendees = mergeAttendees(existingAttendees, extraEmails, extraNamed);
  const attendeesChanged = mergedAttendees.length !== existingAttendees.length
    || extraEmails.length > 0
    || extraNamed.length > 0;
  if (attendeesChanged) patch.attendees = mergedAttendees;

  let zoom_available = null;
  let zoom_status = null;
  let appliedConference = 'none';
  let needsConferenceVersion = false;
  const existingUrl = extractConferenceUrl(existing);

  if (conferenceType === 'zoom') {
    if (typeof createZoomMeetingFn !== 'function') {
      zoom_available = false;
      zoom_status = zoomUnavailableMessage();
      if (!existingUrl) {
        patch.conferenceData = buildMeetConferenceData();
        needsConferenceVersion = true;
        appliedConference = 'meet';
      }
    } else {
      const zoom = await createZoomMeetingFn(existing);
      if (zoom?.join_url) {
        zoom_available = true;
        Object.assign(patch, applyZoomLinkToEvent({ ...existing, ...patch }, zoom.join_url));
        appliedConference = 'zoom';
      } else {
        zoom_available = zoom?.configured === false ? false : true;
        zoom_status = zoom?.error || zoomUnavailableMessage();
        if (!existingUrl) {
          patch.conferenceData = buildMeetConferenceData();
          needsConferenceVersion = true;
          appliedConference = 'meet';
        }
      }
    }
  } else if (conferenceType === 'meet') {
    if (conferenceKindFromUrl(existingUrl) === 'meet') {
      appliedConference = 'meet';
    } else {
      patch.conferenceData = buildMeetConferenceData();
      needsConferenceVersion = true;
      appliedConference = 'meet';
    }
  }

  if (Object.keys(patch).length === 0) {
    return {
      error: 'לא סופק שום שדה לעדכון (title/date/notes/conference/attendees)',
    };
  }

  const patched = await googleCalendarPatchEvent(
    accessToken,
    eventId,
    patch,
    { conference: needsConferenceVersion },
    fetchImpl,
  );
  if (patched.error) return patched;

  return summarizeEventResult(patched.event, {
    zoom_available,
    zoom_status,
    conference_requested: conferenceType,
    conference_applied: appliedConference,
    attendees_added: extraEmails,
    message: buildUpdateMessage({
      conferenceType,
      appliedConference,
      zoom_status,
      attendeesChanged,
    }),
  });
}

function buildUpdateMessage({ conferenceType, appliedConference, zoom_status, attendeesChanged }) {
  const parts = ['האירוע עודכן'];
  if (appliedConference === 'meet') parts.push('נוסף קישור Google Meet');
  if (appliedConference === 'zoom') parts.push('נוסף קישור Zoom');
  if (conferenceType === 'zoom' && appliedConference !== 'zoom' && zoom_status) parts.push(zoom_status);
  if (attendeesChanged) parts.push('נוספו מוזמנים בלי להסיר קיימים');
  parts.push('כל המשתתפים קיבלו מייל עדכון');
  return `${parts.join(' — ')}.`;
}
