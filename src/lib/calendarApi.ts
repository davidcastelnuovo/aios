import { supabase } from "@/integrations/supabase/client";

/**
 * Unified Calendar API helper.
 * Routes all calendar operations through the unified-calendar-proxy edge function,
 * with fallback to direct Google Calendar edge functions for legacy connections.
 */

interface CalendarProxyOptions {
  tenantId: string;
  connectionId?: string;
}

async function invokeCalendarProxy(action: string, body: Record<string, unknown>, options: CalendarProxyOptions) {
  // Try unified-calendar-proxy first
  const { data, error } = await supabase.functions.invoke('unified-calendar-proxy', {
    body: {
      action,
      tenant_id: options.tenantId,
      connection_id: options.connectionId,
      ...body,
    },
  });

  // If no unified connection found, fall back to legacy Google Calendar functions
  if (data?.needsSetup || (error && data?.needsSetup)) {
    return { useLegacy: true as const, data: null, error: null };
  }

  if (error) throw error;
  return { useLegacy: false as const, data, error: null };
}

export async function getCalendarEvents(
  timeMin: string,
  timeMax: string,
  options: CalendarProxyOptions,
  legacyOptions?: { target_user_id?: string }
) {
  const result = await invokeCalendarProxy('list_events', { timeMin, timeMax }, options);
  
  if (result.useLegacy) {
    // Fallback to direct Google Calendar
    const { data, error } = await supabase.functions.invoke('get-calendar-events', {
      body: { timeMin, timeMax, ...legacyOptions },
    });
    if (error) throw error;
    return data;
  }
  
  return result.data;
}

export async function addCalendarEvent(
  eventData: { summary: string; description?: string; start: string; end?: string; attendees?: string[] },
  options: CalendarProxyOptions,
  legacyOptions?: { target_user_id?: string }
) {
  const result = await invokeCalendarProxy('create_event', eventData, options);
  
  if (result.useLegacy) {
    const { data, error } = await supabase.functions.invoke('add-calendar-event', {
      body: { ...eventData, ...legacyOptions },
    });
    if (error) throw error;
    return data;
  }
  
  return result.data;
}

export async function updateCalendarEvent(
  eventData: { eventId: string; summary?: string; description?: string; start?: string; end?: string },
  options: CalendarProxyOptions
) {
  const result = await invokeCalendarProxy('update_event', eventData, options);
  
  if (result.useLegacy) {
    const { data, error } = await supabase.functions.invoke('update-calendar-event', {
      body: eventData,
    });
    if (error) throw error;
    return data;
  }
  
  return result.data;
}

export async function deleteCalendarEvent(
  eventId: string,
  options: CalendarProxyOptions
) {
  const result = await invokeCalendarProxy('delete_event', { eventId }, options);
  
  if (result.useLegacy) {
    const { data, error } = await supabase.functions.invoke('delete-calendar-event', {
      body: { eventId },
    });
    if (error) throw error;
    return data;
  }
  
  return result.data;
}

export async function checkCalendarConnection(options: CalendarProxyOptions) {
  try {
    const result = await invokeCalendarProxy('check_connection', {}, options);
    
    if (result.useLegacy) {
      // Check legacy calendar_tokens
      const { data, error } = await supabase.functions.invoke('google-calendar-auth', {
        body: { action: 'status' },
      });
      if (error) return { connected: false, type: 'none' as const };
      return { connected: data?.connected === true, type: 'legacy' as const, google_email: data?.google_email };
    }
    
    return { connected: true, type: 'unified' as const };
  } catch {
    return { connected: false, type: 'none' as const };
  }
}

export async function syncTasksToCalendar(options: CalendarProxyOptions) {
  // Sync still uses the legacy function since it's server-side batch operation
  const { data, error } = await supabase.functions.invoke('sync-tasks-to-calendar');
  if (error) throw error;
  return data;
}
