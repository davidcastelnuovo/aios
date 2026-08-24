import { supabase } from "@/integrations/supabase/client";

/** When a linked Google event is removed, mark the AIOS task done (not just unscheduled). */
export async function markLinkedTaskDoneForCalendarEvent(eventId: string): Promise<string | null> {
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status")
    .eq("google_calendar_event_id", eventId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!task || task.status === "done") return null;

  const { error } = await supabase
    .from("tasks")
    .update({ status: "done", google_calendar_event_id: null })
    .eq("id", task.id);
  if (error) throw error;
  return task.id;
}
