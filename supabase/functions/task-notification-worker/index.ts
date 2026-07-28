import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { taskReminderAt } from './schedule.ts'

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

type TaskRow = {
  id: string
  title: string
  status: string
  priority: number
  created_at: string
  due_date: string | null
  due_time: string | null
  created_by: string | null
  campaigner_id: string | null
  assignment_notification_sent_at: string | null
  high_priority_reminder_sent_at: string | null
  high_priority_creator_notified_at: string | null
  completion_creator_notified_at: string | null
}

async function invokeNotification(taskId: string, triggerType: NotificationType) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/trigger-automation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      trigger_type: triggerType,
      data: { task_id: taskId },
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body?.sent !== true) {
    throw new Error(body?.reason || body?.error || `trigger-automation returned ${response.status}`)
  }
  return body
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
    const result = await invokeNotification(task.id, triggerType)
    return { task_id: task.id, trigger_type: triggerType, sent: true, result }
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
    .select('id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at')
    .eq('id', taskId)
    .maybeSingle()
  if (error) throw error
  return data as TaskRow | null
}

async function processTask(supabase: ReturnType<typeof createClient>, task: TaskRow) {
  const results: unknown[] = []
  const oneMinuteAgo = Date.now() - 60 * 1000
  const reminderAt = taskReminderAt(task)

  if (
    task.campaigner_id
    && task.status !== 'done'
    && !task.assignment_notification_sent_at
  ) {
    results.push(await claimAndSend(supabase, task, 'assignment_notification_sent_at', 'task_assigned'))
    task.assignment_notification_sent_at = new Date().toISOString()
  }

  if (
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
    task.created_by
    && task.high_priority_reminder_sent_at
    && Date.parse(task.high_priority_reminder_sent_at) <= oneMinuteAgo
    && !task.high_priority_creator_notified_at
  ) {
    results.push(await claimAndSend(supabase, task, 'high_priority_creator_notified_at', 'task_high_priority_reminder_sent'))
    task.high_priority_creator_notified_at = new Date().toISOString()
  }

  if (
    task.created_by
    && task.status === 'done'
    && !task.completion_creator_notified_at
  ) {
    results.push(await claimAndSend(supabase, task, 'completion_creator_notified_at', 'task_completed'))
    task.completion_creator_notified_at = new Date().toISOString()
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
      const [assignments, reminders, reminderReceipts, completions] = await Promise.all([
        supabase
          .from('tasks')
          .select('id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at')
          .not('campaigner_id', 'is', null)
          .neq('status', 'done')
          .is('assignment_notification_sent_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select('id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at')
          .not('campaigner_id', 'is', null)
          .eq('status', 'open')
          .is('high_priority_reminder_sent_at', null)
          .limit(100),
        supabase
          .from('tasks')
          .select('id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at')
          .not('created_by', 'is', null)
          .lte('high_priority_reminder_sent_at', oneMinuteAgo)
          .is('high_priority_creator_notified_at', null)
          .limit(25),
        supabase
          .from('tasks')
          .select('id,title,status,priority,created_at,due_date,due_time,created_by,campaigner_id,assignment_notification_sent_at,high_priority_reminder_sent_at,high_priority_creator_notified_at,completion_creator_notified_at')
          .not('created_by', 'is', null)
          .eq('status', 'done')
          .is('completion_creator_notified_at', null)
          .limit(25),
      ])

      const queryErrors = [assignments.error, reminders.error, reminderReceipts.error, completions.error].filter(Boolean)
      if (queryErrors.length) throw queryErrors[0]

      const unique = new Map<string, TaskRow>()
      for (const task of [
        ...(assignments.data || []),
        ...(reminders.data || []),
        ...(reminderReceipts.data || []),
        ...(completions.data || []),
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
