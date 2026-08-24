const AIOS_APP_URL = 'https://aios.co.il'

export function formatTaskNotificationMessage(
  notificationType: string,
  task: any,
  clientName: string,
  assigneeName: string,
  recipientName: string,
  creatorName: string,
): string {
  const taskLink = `${AIOS_APP_URL}/tasks?task=${encodeURIComponent(task.id)}`
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
  } else {
    details.push(
      creatorName
        ? `משימה חדשה ניתנה לך על ידי ${creatorName} עבור ${clientName}:`
        : `משימה חדשה שויכה אליך עבור ${clientName}:`,
      `*${task.title}*`,
    )
  }

  if (task.notes) details.push('', String(task.notes))
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

