/** Idempotency for Carmen task WhatsApp — one row per task + type + recipient. */
export function taskNotificationRecipientKey(input: {
  notifyCampaignerId?: string | null
  campaignerId?: string | null
  salesPersonId?: string | null
}): string {
  return String(
    input.notifyCampaignerId
      || input.campaignerId
      || input.salesPersonId
      || '',
  ).trim()
}

export async function claimTaskNotificationDelivery(
  supabase: any,
  input: {
    taskId: string
    notificationType: string
    recipientKey?: string
  },
): Promise<'claimed' | 'duplicate'> {
  const { error } = await supabase.from('task_notification_deliveries').insert({
    task_id: input.taskId,
    notification_type: input.notificationType,
    recipient_key: input.recipientKey || '',
  })
  if (error?.code === '23505') return 'duplicate'
  if (error) throw error
  return 'claimed'
}

export async function releaseTaskNotificationDelivery(
  supabase: any,
  input: {
    taskId: string
    notificationType: string
    recipientKey?: string
  },
): Promise<void> {
  const { error } = await supabase
    .from('task_notification_deliveries')
    .delete()
    .eq('task_id', input.taskId)
    .eq('notification_type', input.notificationType)
    .eq('recipient_key', input.recipientKey || '')
  if (error) throw error
}
