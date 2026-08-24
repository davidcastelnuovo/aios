import { supabase } from "@/integrations/supabase/client";

/**
 * Dual-mode Calendar API.
 * Supports both Direct Google Calendar and Unified.to proxy modes.
 * The mode is determined by the `provider` option.
 */

export type CalendarProvider = 'direct' | 'unified';

interface CalendarProxyOptions {
  tenantId: string;
  connectionId?: string;
  provider?: CalendarProvider;
}

// ─── Unified proxy helpers ───

async function invokeCalendarProxy(action: string, body: Record<string, unknown>, options: CalendarProxyOptions) {
  const { data, error } = await supabase.functions.invoke('unified-calendar-proxy', {
    body: {
      action,
      tenant_id: options.tenantId,
      connection_id: options.connectionId,
      ...body,
    },
  });
  if (error) throw error;
  if (data?.needsSetup) {
    throw new Error('היומן לא מחובר. יש לחבר את Google Calendar דרך הגדרות אינטגרציות.');
  }
  return data;
}

// ─── Direct Google helpers ───

async function invokeDirectGoogle(fnName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(fnName, { body });
  if (error) throw error;
  return data;
}

// ─── Public API ───

export async function getCalendarEvents(
  timeMin: string,
  timeMax: string,
  options: CalendarProxyOptions,
  legacyOptions?: { target_user_id?: string }
) {
  if (options.provider === 'unified') {
    return await invokeCalendarProxy('list_events', { timeMin, timeMax }, options);
  }
  // Direct Google
  const result = await invokeDirectGoogle('get-calendar-events', {
    timeMin,
    timeMax,
    target_user_id: legacyOptions?.target_user_id,
  });
  // Normalise shape: direct returns { events: [...] }
  return result;
}

export async function addCalendarEvent(
  eventData: { summary: string; description?: string; start: string; end?: string; attendees?: string[]; allDay?: boolean },
  options: CalendarProxyOptions,
  legacyOptions?: { target_user_id?: string }
) {
  if (options.provider === 'unified') {
    return await invokeCalendarProxy('create_event', eventData, options);
  }
  return await invokeDirectGoogle('add-calendar-event', {
    ...eventData,
    target_user_id: legacyOptions?.target_user_id,
  });
}

export async function updateCalendarEvent(
  eventData: { eventId: string; summary?: string; description?: string; start?: string; end?: string; allDay?: boolean },
  options: CalendarProxyOptions
) {
  if (options.provider === 'unified') {
    return await invokeCalendarProxy('update_event', eventData, options);
  }
  return await invokeDirectGoogle('update-calendar-event', eventData);
}

export async function deleteCalendarEvent(
  eventId: string,
  options: CalendarProxyOptions
) {
  if (options.provider === 'unified') {
    return await invokeCalendarProxy('delete_event', { eventId }, options);
  }
  return await invokeDirectGoogle('delete-calendar-event', { eventId });
}

export async function checkCalendarConnection(options: CalendarProxyOptions): Promise<{
  connected: boolean;
  type: 'direct' | 'unified' | 'none';
  connection_id?: string;
  google_email?: string;
}> {
  if (options.provider === 'unified') {
    try {
      const data = await invokeCalendarProxy('check_connection', {}, options);
      return { connected: true, type: 'unified', connection_id: data?.connection_id };
    } catch {
      return { connected: false, type: 'none' };
    }
  }

  // Direct Google – check via google-calendar-auth status
  try {
    const data = await invokeDirectGoogle('google-calendar-auth', { action: 'status' });
    if (data?.connected) {
      return { connected: true, type: 'direct', google_email: data.google_email };
    }
    return { connected: false, type: 'none' };
  } catch {
    return { connected: false, type: 'none' };
  }
}

/** Initiate direct Google OAuth flow – returns { authUrl } */
export async function initDirectGoogleAuth() {
  const data = await invokeDirectGoogle('google-calendar-auth', { action: 'init' });
  return data as { authUrl: string };
}

/** Disconnect direct Google calendar */
export async function disconnectDirectGoogleCalendar() {
  return await invokeDirectGoogle('google-calendar-auth', { action: 'disconnect' });
}

export async function syncTasksToCalendar(_options: CalendarProxyOptions) {
  return { synced: 0, failed: 0, message: 'סנכרון משימות אינו נתמך כרגע.' };
}

function nextCalendarDate(dueDate: string): string {
  const [year, month, day] = dueDate.split("-").map(Number);
  const next = new Date(year, month - 1, day + 1);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Create / update / delete the Google Calendar event that mirrors a task.
 * Date+time → timed event. Date only → all-day event (so it still shows on
 * a synced Google Calendar). No date → delete the previous event.
 */
export async function syncTaskCalendarEvent(opts: {
  tenantId: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  durationMinutes?: number;
  existingEventId?: string | null;
}): Promise<string | null> {
  const { tenantId, title, dueDate, dueTime, durationMinutes = 30, existingEventId } = opts;
  if (!dueDate) {
    if (existingEventId) {
      await deleteCalendarEvent(existingEventId, { tenantId });
    }
    return null;
  }

  const payload = dueTime
    ? (() => {
        const time = dueTime.length === 5 ? `${dueTime}:00` : dueTime;
        const startDateTime = new Date(`${dueDate}T${time}`);
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
        return {
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          allDay: false,
        };
      })()
    : {
        start: dueDate,
        end: nextCalendarDate(dueDate),
        allDay: true,
      };

  if (existingEventId) {
    await updateCalendarEvent(
      {
        eventId: existingEventId,
        summary: title,
        start: payload.start,
        end: payload.end,
        allDay: payload.allDay,
      },
      { tenantId },
    );
    return existingEventId;
  }

  const calendarResult = await addCalendarEvent(
    {
      summary: title,
      description: "משימה ממערכת Marketing Captain",
      start: payload.start,
      end: payload.end,
      allDay: payload.allDay,
    },
    { tenantId },
  );
  return calendarResult?.eventId ?? null;
}
