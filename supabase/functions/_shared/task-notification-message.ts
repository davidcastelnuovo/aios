const AIOS_APP_URL = 'https://aios.co.il'

/** Deep link into the tasks board. Always tenant-scoped so the recipient can open it. */
export function buildTaskAppLink(taskId: string, tenantSlug?: string | null): string {
  const encodedId = encodeURIComponent(String(taskId || ''))
  const slug = String(tenantSlug || '').trim().replace(/^\/+|\/+$/g, '')
  if (slug) return `${AIOS_APP_URL}/t/${encodeURIComponent(slug)}/tasks?task=${encodedId}`
  return `${AIOS_APP_URL}/tasks?task=${encodedId}`
}

/**
 * Tenant that owns the recipient's home board — not the task owner / Carmen sender.
 * A Marketing Captain campaigner working a DMM-agency task must open
 * `/t/marketingcaptain/tasks`, not DMM and not a bare `/tasks` URL.
 */
export function resolveTaskNotificationLinkTenantId(input: {
  notifyCreator: boolean
  creatorHomeTenantId?: string | null
  campaignerTenantId?: string | null
  salesPersonTenantId?: string | null
  fallbackTenantId?: string | null
}): string | null {
  const fallback = input.fallbackTenantId || null
  if (input.notifyCreator) return input.creatorHomeTenantId || fallback
  return input.campaignerTenantId || input.salesPersonTenantId || fallback
}

export type TaskNotificationExtras = {
  updateContent?: string | null
  updaterName?: string | null
}

export function formatTaskNotificationMessage(
  notificationType: string,
  task: any,
  clientName: string,
  assigneeName: string,
  recipientName: string,
  creatorName: string,
  tenantSlug?: string | null,
  extras?: TaskNotificationExtras,
): string {
  const taskLink = buildTaskAppLink(task.id, tenantSlug)
  const details = [`היי ${recipientName || 'צוות'}, כאן כרמן 👋`, '']

  if (notificationType === 'task_self_reminder') {
    details.push(
      'התזכורת שביקשת למשימה:',
      `*${task.title}*`,
      `לקוח: ${clientName}`,
    )
  } else if (notificationType === 'task_high_priority_reminder') {
    details.push(
      task.priority >= 8
        ? 'תזכורת למשימה בדחיפות גבוהה שעדיין פתוחה:'
        : 'תזכורת: המשימה עדיין פתוחה ומועד הביצוע שלה מתקרב:',
      `*${task.title}*`,
      `לקוח: ${clientName}`,
    )
  } else if (notificationType === 'task_high_priority_reminder_sent') {
    details.push(
      `נשלחה עכשיו תזכורת ל${assigneeName || 'מקבל המשימה'} על משימה שעדיין פתוחה:`,
      `*${task.title}*`,
      `לקוח: ${clientName}`,
      '',
      'אעדכן אותך כשהמשימה תסומן כבוצעה.',
    )
  } else if (notificationType === 'task_completed') {
    details.push(
      `המשימה שהגדרת ל${assigneeName || 'מקבל המשימה'} בוצעה ✅`,
      `*${task.title}*`,
      `לקוח: ${clientName}`,
    )
  } else if (notificationType === 'task_overdue') {
    details.push(
      'תזכורת: המשימה עברה את תאריך היעד ועדיין לא סומנה כבוצעה:',
      `*${task.title}*`,
      `לקוח: ${clientName}`,
    )
  } else if (notificationType === 'task_overdue_sent') {
    details.push(
      `נשלחה עכשיו תזכורת ל${assigneeName || 'מקבל המשימה'} על משימה שעברה את תאריך היעד ועדיין פתוחה:`,
      `*${task.title}*`,
      `לקוח: ${clientName}`,
      '',
      'אעדכן אותך כשהמשימה תסומן כבוצעה.',
    )
  } else if (notificationType === 'task_collaborator_added') {
    details.push(
      creatorName
        ? `נוספת למשימה על ידי ${creatorName} עבור ${clientName}:`
        : `נוספת למשימה עבור ${clientName}:`,
      `*${task.title}*`,
    )
  } else if (notificationType === 'task_update_added') {
    details.push(
      extras?.updaterName
        ? `יש עדכון חדש במשימה מאת ${extras.updaterName}:`
        : 'יש עדכון חדש במשימה:',
      `*${task.title}*`,
      `לקוח: ${clientName}`,
    )
    if (extras?.updateContent) details.push('', String(extras.updateContent))
  } else {
    details.push(
      creatorName
        ? `משימה חדשה ניתנה לך על ידי ${creatorName} עבור ${clientName}:`
        : `משימה חדשה שויכה אליך עבור ${clientName}:`,
      `*${task.title}*`,
    )
  }

  if (notificationType !== 'task_update_added' && task.notes) {
    details.push('', String(task.notes))
  }
  if (Number(task.priority) >= 8) details.push('', 'דחיפות: גבוהה')
  if (task.due_date) {
    const due = task.due_time
      ? `${task.due_date} בשעה ${String(task.due_time).slice(0, 5)}`
      : task.due_date
    details.push('', `תאריך יעד: ${due}`)
  }
  details.push('', `לצפייה במשימה: ${taskLink}`)
  return details.join('\n')
}
