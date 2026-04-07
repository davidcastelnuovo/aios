import { supabase } from "@/integrations/supabase/client";

/**
 * Unified Calendar API helper.
 * Routes ALL calendar operations through the unified-calendar-proxy edge function.
 * No legacy fallback — if Unified is not connected, operations will fail with a clear message.
 */

interface CalendarProxyOptions {
  tenantId: string;
  connectionId?: string;
}

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

export async function getCalendarEvents(
  timeMin: string,
  timeMax: string,
  options: CalendarProxyOptions,
  _legacyOptions?: { target_user_id?: string }
) {
  return await invokeCalendarProxy('list_events', { timeMin, timeMax }, options);
}

export async function addCalendarEvent(
  eventData: { summary: string; description?: string; start: string; end?: string; attendees?: string[] },
  options: CalendarProxyOptions,
  _legacyOptions?: { target_user_id?: string }
) {
  return await invokeCalendarProxy('create_event', eventData, options);
}

export async function updateCalendarEvent(
  eventData: { eventId: string; summary?: string; description?: string; start?: string; end?: string },
  options: CalendarProxyOptions
) {
  return await invokeCalendarProxy('update_event', eventData, options);
}

export async function deleteCalendarEvent(
  eventId: string,
  options: CalendarProxyOptions
) {
  return await invokeCalendarProxy('delete_event', { eventId }, options);
}

export async function checkCalendarConnection(options: CalendarProxyOptions) {
  try {
    const data = await invokeCalendarProxy('check_connection', {}, options);
    return { connected: true, type: 'unified' as const, connection_id: data?.connection_id };
  } catch {
    return { connected: false, type: 'none' as const };
  }
}

export async function syncTasksToCalendar(options: CalendarProxyOptions) {
  // For now, sync is not supported through Unified proxy
  // Return a no-op result
  return { synced: 0, failed: 0, message: 'סנכרון משימות זמין רק עם חיבור Unified פעיל.' };
}
