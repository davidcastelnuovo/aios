import { supabase } from "@/integrations/supabase/client";

/** Fire-and-forget Carmen WhatsApp for task peers (collaborators / updates). */
async function invokeTaskPeerNotification(body: {
  trigger_type: "task_collaborator_added" | "task_update_added";
  data: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.functions.invoke("trigger-automation", { body });
  if (error) {
    console.warn("[notify-task-peers]", body.trigger_type, error.message || error);
  }
}

export async function notifyTaskCollaboratorAdded(input: {
  taskId: string;
  campaignerId: string;
  addedByUserId?: string | null;
}): Promise<void> {
  if (!input.taskId || !input.campaignerId) return;
  await invokeTaskPeerNotification({
    trigger_type: "task_collaborator_added",
    data: {
      task_id: input.taskId,
      notify_campaigner_id: input.campaignerId,
      user_id: input.addedByUserId || undefined,
    },
  });
}

export async function notifyTaskUpdateAdded(input: {
  taskId: string;
  userId: string;
  updateContent: string;
  updaterName?: string | null;
}): Promise<void> {
  if (!input.taskId || !input.userId) return;
  await invokeTaskPeerNotification({
    trigger_type: "task_update_added",
    data: {
      task_id: input.taskId,
      user_id: input.userId,
      update_content: input.updateContent,
      updater_name: input.updaterName || undefined,
    },
  });
}
