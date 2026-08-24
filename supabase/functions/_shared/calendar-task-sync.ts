/** DB patch when Google Calendar reports a linked event was deleted/cancelled. */
export function calendarEventCancelledTaskUpdates(): Record<string, string | null> {
  return {
    status: "done",
    google_calendar_event_id: null,
  };
}
