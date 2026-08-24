const AIOS_APP_URL = 'https://aios.co.il'

export function formatClientFollowUpMessage(
  notificationType: string,
  client: { id: string; name: string; follow_up_date?: string | null },
  recipientName: string,
  assigneeNames: string[],
): string {
  const clientLink = `${AIOS_APP_URL}/clients?client=${encodeURIComponent(client.id)}`
  const details = [`היי ${recipientName || 'צוות'}, כאן כרמן 👋`, '']
  const followUpDate = client.follow_up_date || ''
  const assigneeLabel = assigneeNames.length
    ? assigneeNames.join(', ')
    : 'לא משויך קמפיינר'

  if (notificationType === 'client_follow_up_reminder_manager') {
    details.push(
      'תזכורת: הגיע הזמן לדבר עם לקוח בסוכנות:',
      `*${client.name}*`,
      `קמפיינר משויך: ${assigneeLabel}`,
    )
  } else {
    details.push(
      followUpDate
        ? 'תזכורת: היום צריך לדבר עם הלקוח:'
        : 'תזכורת: צריך לדבר עם הלקוח:',
      `*${client.name}*`,
    )
  }

  if (followUpDate) {
    details.push('', `תאריך לשיחה: ${followUpDate}`)
  }
  details.push('', `לצפייה בלקוח: ${clientLink}`)
  return details.join('\n')
}
