import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { taskNotificationScope, taskOverdueNotifyAt, taskReminderAt } from './schedule.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type NotificationType =
  | 'task_assigned'
  | 'task_high_priority_reminder'
  | 'task_high_priority_reminder_sent'
  | 'task_completed'
  | 'task_self_reminder'
  | 'task_overdue'
  | 'task_overdue_sent'

type TaskRow = {
  id: string
  tenant_id: string
  title: string
  status: string
  priority: number
  created_at: string
  due_date: string | null
  due_time: string | null
  created_by: string | null
  campaigner_id: string | null
  sales_person_id: string | null
  self_reminder_at: string | null
  self_reminder_sent_at: string | null
  assignment_notification_sent_at: string | null
  high_priority_reminder_sent_at: string | null
  high_priority_creator_notified_at: string | null
  completion_creator_notified_at: string | null
  overdue_notified_at: string | null
  overdue_creator_notified_at: string | null
}

async function invokeNotification(task: TaskRow, triggerType: NotificationType) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/trigger-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      trigger_type: triggerType,
      data: {
        task_id: task.id,
        title: task.title,
        tenant_id: task.tenant_id,
        campaigner_id: task.campaigner_id,
        sales_person_id: task.sales_person_id,
        created_by: task.created_by,
      },
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 202) {
    throw new Error(body?.reason || body?.error || `trigger-automation returned ${response.status}`)
  }
  if (body?.sent === true) return { delivered: true, body }
  if (body?.handled === true && body?.sent === false) {
    return { delivered: false, body }
  }
  if (body?.success === true) {
    const delivered = Array.isArray(body.results)
      && body.results.some((result: any) => result?.success === true)
    return { delivered, body }
  }
  throw new Error(body?.reason || body?.error || 'task notification was not handled')
}

async function claimAndSend(
  supabase: ReturnType<typeof createClient>,
  task: TaskRow,
  marker: keyof Pick<
    TaskRow,
    | 'assignment_notification_sent_at'
    | 'high_priority_reminder_sent_at'
    | 'high_priority_creator_notified_at'
    | 'completion_creator_notified_at'
    | 'self_reminder_sent_at'
    | 'overdue_notified_at'
    | 'overdue_creator_notified_at'
  >,
  triggerType: NotificationType,
) {
  const claimedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await supabase
    .from('tasks')
    .update({ [marker]: claimedAt })
    .eq('id', task.id)
    .is(marker, null)
    .select('id')
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed) return { task_id: task.id, trigger_type: triggerType, skipped: 'already claimed' }

  try {
    const result = await invokeNotification(task, triggerType)
    return {
      task_id: task.id,
      trigger_type: triggerType,
      sent: result.delivered,
      skipped: result.delivered ? undefined : result.body?.reason || 'no notification channel configured',
      result: result.body,
    }
  } catch (error) {
    await supabase
      .from('tasks')
      .update({ [marker]: null })
      .eq('id', task.id)
      .eq(marker, claimedAt)
    throw error
  }
}

async function fetchTask(supabase: ReturnType<typeof createClient>, taskId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id,tenant_id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,sales_person_id,self_reminder_at,self_reminder_sent_at,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at,overdue_notified_at,overdue_creator_notified_at')
    .eq('id', taskId)
    .maybeSingle()
  if (error) throw error
  return data as TaskRow | null
}

async function notificationScope(
  supabase: ReturnType<typeof createClient>,
  task: TaskRow,
) {
  if (!task.created_by) {
    return { isSelfAssigned: false, shouldNotifyAssignee: false, isManagedAssignment: false }
  }

  const [{ data: creatorProfile, error: profileError }, { data: creatorRoles, error: rolesError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('campaigner_id,sales_person_id')
      .eq('id', task.created_by)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', task.created_by)
      .or(`tenant_id.eq.${task.tenant_id},tenant_id.is.null`),
  ])
  if (profileError) throw profileError
  if (rolesError) throw rolesError

  return taskNotificationScope({
    taskCampaignerId: task.campaigner_id,
    taskSalesPersonId: task.sales_person_id,
    creatorCampaignerId: creatorProfile?.campaigner_id || null,
    creatorSalesPersonId: creatorProfile?.sales_person_id || null,
    creatorRoles: (creatorRoles || []).map((row) => String(row.role)),
    hasCreator: true,
  })
}

async function processTask(supabase: ReturnType<typeof createClient>, task: TaskRow) {
  const results: unknown[] = []
  const oneMinuteAgo = Date.now() - 60 * 1000
  const reminderAt = taskReminderAt(task)
  const { isSelfAssigned, shouldNotifyAssignee, isManagedAssignment } =
    await notificationScope(supabase, task)

  // Self assignments and rows without a known giver are silent. Mark only the
  // assignment notification as handled; peer assignments must reach the assignee.
  if (!shouldNotifyAssignee && !task.assignment_notification_sent_at) {
    const handledAt = new Date().toISOString()
    const { error } = await supabase
      .from('tasks')
      .update({ assignment_notification_sent_at: handledAt })
      .eq('id', task.id)
      .is('assignment_notification_sent_at', null)
    if (error) throw error
    task.assignment_notification_sent_at = handledAt
  }

  // Manager-only reminder/receipt markers must also be consumed for tasks
  // created by peers, otherwise the minute cron would re-evaluate them forever.
  if (!isManagedAssignment) {
    const handledAt = new Date().toISOString()
    const silentMarkers: Record<string, string> = {}
    if (!task.high_priority_reminder_sent_at) silentMarkers.high_priority_reminder_sent_at = handledAt
    if (!task.high_priority_creator_notified_at) silentMarkers.high_priority_creator_notified_at = handledAt
    if (!task.overdue_notified_at) silentMarkers.overdue_notified_at = handledAt
    if (!task.overdue_creator_notified_at) silentMarkers.overdue_creator_notified_at = handledAt
    if (task.status === 'done' && !task.completion_creator_notified_at) {
      silentMarkers.completion_creator_notified_at = handledAt
    }
    if (Object.keys(silentMarkers).length > 0) {
      const { error } = await supabase.from('tasks').update(silentMarkers).eq('id', task.id)
      if (error) throw error
      Object.assign(task, silentMarkers)
    }
  }

  if (
    shouldNotifyAssignee
    &&
    (task.campaigner_id || task.sales_person_id)
    && task.status !== 'done'
    && !task.assignment_notification_sent_at
  ) {
    results.push(await claimAndSend(supabase, task, 'assignment_notification_sent_at', 'task_assigned'))
    task.assignment_notification_sent_at = new Date().toISOString()
  }

  if (
    isManagedAssignment
    &&
    task.campaigner_id
    && task.status === 'open'
    && reminderAt !== null
    && reminderAt.getTime() <= Date.now()
    && !task.high_priority_reminder_sent_at
  ) {
    const result = await claimAndSend(supabase, task, 'high_priority_reminder_sent_at', 'task_high_priority_reminder')
    results.push(result)
    if ('sent' in result && result.sent) task.high_priority_reminder_sent_at = new Date().toISOString()
  }

  if (
    isManagedAssignment
    &&
    task.created_by
    && task.high_priority_reminder_sent_at
    && Date.parse(task.high_priority_reminder_sent_at) <= oneMinuteAgo
    && !task.high_priority_creator_notified_at
  ) {
    results.push(await claimAndSend(supabase, task, 'high_priority_creator_notified_at', 'task_high_priority_reminder_sent'))
    task.high_priority_creator_notified_at = new Date().toISOString()
  }

  if (
    isManagedAssignment
    &&
    task.created_by
    && task.status === 'done'
    && !task.completion_creator_notified_at
  ) {
    results.push(await claimAndSend(supabase, task, 'completion_creator_notified_at', 'task_completed'))
    task.completion_creator_notified_at = new Date().toISOString()
  }

  if (
    isManagedAssignment
    &&
    task.campaigner_id
    && task.status !== 'done'
    && task.due_date
    && !task.overdue_notified_at
  ) {
    const overdueAt = taskOverdueNotifyAt(task)
    if (overdueAt !== null && overdueAt.getTime() <= Date.now()) {
      const result = await claimAndSend(supabase, task, 'overdue_notified_at', 'task_overdue')
      results.push(result)
      if ('sent' in result && result.sent) task.overdue_notified_at = new Date().toISOString()
    }
  }

  if (
    isManagedAssignment
    &&
    task.created_by
    && task.overdue_notified_at
    && Date.parse(task.overdue_notified_at) <= oneMinuteAgo
    && !task.overdue_creator_notified_at
  ) {
    results.push(await claimAndSend(supabase, task, 'overdue_creator_notified_at', 'task_overdue_sent'))
    task.overdue_creator_notified_at = new Date().toISOString()
  }

  if (
    isSelfAssigned
    && task.status !== 'done'
    && task.self_reminder_at
    && Date.parse(task.self_reminder_at) <= Date.now()
    && !task.self_reminder_sent_at
  ) {
    results.push(await claimAndSend(supabase, task, 'self_reminder_sent_at', 'task_self_reminder'))
    task.self_reminder_sent_at = new Date().toISOString()
  }

  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const results: unknown[] = []
  const errors: Array<{ task_id: string; error: string }> = []

  try {
    const body = await req.json().catch(() => ({}))
    let tasks: TaskRow[] = []

    if (body?.task_id) {
      const task = await fetchTask(supabase, String(body.task_id))
      if (task) tasks = [task]
    } else {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
      const taskColumns = 'id,tenant_id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,sales_person_id,self_reminder_at,self_reminder_sent_at,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at,overdue_notified_at,overdue_creator_notified_at'
      const [assignments, reminders, reminderReceipts, overdueReceipts, completions, selfReminders, overdueTasks] = await Promise.all([
        supabase
          .from('tasks')
          .select(taskColumns)
          .or('campaigner_id.not.is.null,sales_person_id.not.is.null')
          .neq('status', 'done')
          .is('assignment_notification_sent_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('campaigner_id', 'is', null)
          .eq('status', 'open')
          .is('high_priority_reminder_sent_at', null)
          .limit(100),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('created_by', 'is', null)
          .lte('high_priority_reminder_sent_at', oneMinuteAgo)
          .is('high_priority_creator_notified_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('created_by', 'is', null)
          .lte('overdue_notified_at', oneMinuteAgo)
          .is('overdue_creator_notified_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('created_by', 'is', null)
          .eq('status', 'done')
          .is('completion_creator_notified_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('self_reminder_at', 'is', null)
          .lte('self_reminder_at', new Date().toISOString())
          .neq('status', 'done')
          .is('self_reminder_sent_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select(taskColumns)
          .not('campaigner_id', 'is', null)
          .not('due_date', 'is', null)
          .lt('due_date', new Date().toISOString().slice(0, 10))
          .neq('status', 'done')
          .is('overdue_notified_at', null)
          .limit(25),
      ])

      const queryErrors = [assignments.error, reminders.error, reminderReceipts.error, overdueReceipts.error, completions.error, selfReminders.error, overdueTasks.error].filter(Boolean)
      if (queryErrors.length) throw queryErrors[0]

      const unique = new Map<string, TaskRow>()
      for (const task of [
        ...(assignments.data || []),
        ...(reminders.data || []),
        ...(reminderReceipts.data || []),
        ...(overdueReceipts.data || []),
        ...(completions.data || []),
        ...(selfReminders.data || []),
        ...(overdueTasks.data || []),
      ] as TaskRow[]) unique.set(task.id, task)
      tasks = [...unique.values()]
    }

    for (const task of tasks) {
      try {
        results.push(...await processTask(supabase, task))
      } catch (error) {
        errors.push({
          task_id: task.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    console.log('[task-notification-worker]', { tasks: tasks.length, results: results.length, errors })
    return new Response(JSON.stringify({ ok: errors.length === 0, processed: tasks.length, results, errors }), {
      status: errors.length ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[task-notification-worker] fatal error', error)
    return new Response(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
