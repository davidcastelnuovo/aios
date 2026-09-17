export async function fireTaskPeerNotification(input: {
  supabaseUrl: string
  serviceKey: string
  triggerType: 'task_collaborator_added' | 'task_update_added'
  data: Record<string, unknown>
}): Promise<void> {
  const response = await fetch(`${input.supabaseUrl}/functions/v1/trigger-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.serviceKey}`,
    },
    body: JSON.stringify({
      trigger_type: input.triggerType,
      data: input.data,
    }),
  })
  if (!response.ok && response.status !== 202) {
    const body = await response.text().catch(() => '')
    console.warn('[notify-task-peers]', input.triggerType, response.status, body)
  }
}
