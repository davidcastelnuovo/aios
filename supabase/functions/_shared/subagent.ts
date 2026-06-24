/**
 * Carmen Phase 4 — Subagent delegation
 * =====================================
 * Lets Carmen spawn focused background sub-tasks that run in their own
 * `run-agent-task` execution. The parent gets back a sub_task_id immediately
 * and can poll for the result via `get_subagent_result`.
 *
 * Why this exists:
 *  - The user-facing chat must stay responsive (especially WhatsApp turns).
 *  - Long analyses, multi-client sweeps, and research jobs should run async.
 *  - Re-uses the existing `agent_tasks` + `run-agent-task` infrastructure
 *    instead of inventing a new queue.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Concurrency cap (best practice: Anthropic caps at 3–5 parallel subagents; an
// explicit bound prevents a fork-bomb and protects the LLM TPM budget). Over the
// cap, a subtask is still created as `pending` and the dispatch-agent-tasks cron
// drains it when capacity frees — so nothing is lost, only paced.
const MAX_INFLIGHT_SUBAGENTS = 5

export interface SpawnSubagentParams {
  parentAgentId: string | null
  parentTaskId?: string | null
  tenantId: string
  title: string
  prompt: string
  taskMode?: string
  taskSkills?: string[]
  priority?: number
  createdBy?: string | null
  /** Optional dedupe key — a live task with the same (tenant, key) is reused. */
  idempotencyKey?: string | null
  /** Optional group id so delegate_parallel can aggregate the set. */
  batchId?: string | null
  /**
   * Optional delivery target for the subagent's final output.
   * When set with surface='whatsapp', run-agent-task will POST the final
   * result back into the originating WhatsApp chat on completion — so
   * "אני עובדת על זה ברקע" doesn't become a dead end on the user's phone.
   */
  notify?: {
    surface: 'whatsapp'
    tenant_id: string
    automation_id: string | null
    connection_user_id: string
    chat_id: string
    phone_number: string | null
    is_group: boolean
  } | null
}

export interface SpawnSubagentResult {
  sub_task_id: string
  title: string
  status: string
  message: string
}

/**
 * Create a child agent_tasks row and fire-and-forget invoke run-agent-task.
 * Returns the sub_task_id immediately so the parent agent can continue.
 */
export async function spawnSubagent(
  supabase: any,
  params: SpawnSubagentParams,
): Promise<SpawnSubagentResult> {
  const promptWithMarker = params.parentTaskId
    ? `[subagent of ${params.parentTaskId}]\n${params.prompt}`
    : params.prompt

  // Idempotency: if a live task with this key already exists, reuse it instead
  // of spawning a duplicate (queues deliver at-least-once → dedupe to one task).
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from('agent_tasks')
      .select('id, title, status')
      .eq('tenant_id', params.tenantId)
      .eq('idempotency_key', params.idempotencyKey)
      .in('status', ['pending', 'running', 'completed'])
      .maybeSingle()
    if (existing) {
      return {
        sub_task_id: existing.id,
        title: existing.title,
        status: existing.status,
        message: 'תת-משימה זהה כבר קיימת (idempotent) — מחזירה את הקיימת.',
      }
    }
  }

  // Concurrency cap: count currently-running background subagents for this
  // tenant. Under the cap → fire immediately. Over → leave pending and let the
  // dispatch-agent-tasks cron pick it up (backstop), so nothing is lost.
  const { count: runningCount } = await supabase
    .from('agent_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', params.tenantId)
    .eq('task_mode', 'background')
    .eq('status', 'running')
  const fireNow = (runningCount ?? 0) < MAX_INFLIGHT_SUBAGENTS

  const taskRow: any = {
    agent_id: params.parentAgentId,
    tenant_id: params.tenantId,
    title: params.title.slice(0, 200),
    description: promptWithMarker,
    priority: params.priority ?? 6,
    status: 'pending',
    schedule_type: 'once',
    scheduled_at: new Date().toISOString(),
    task_skills: params.taskSkills && params.taskSkills.length > 0
      ? JSON.stringify(params.taskSkills)
      : null,
    task_mode: params.taskMode || 'background',
    enabled: true,
    created_by: params.createdBy || null,
    idempotency_key: params.idempotencyKey || null,
    batch_id: params.batchId || null,
    // Seed the result jsonb with the notify target so run-agent-task can find
    // it on completion. Kept under `result` (not a new column) to avoid a
    // schema migration; run-agent-task preserves `result.notify` across runs.
    result: params.notify ? { notify: params.notify } : null,
  }

  const { data, error } = await supabase
    .from('agent_tasks')
    .insert(taskRow)
    .select('id, title, status')
    .single()

  if (error) {
    // Unique-violation on idempotency_key = a concurrent spawn won the race.
    if (params.idempotencyKey && /duplicate key|unique/i.test(error.message || '')) {
      const { data: raced } = await supabase
        .from('agent_tasks')
        .select('id, title, status')
        .eq('tenant_id', params.tenantId)
        .eq('idempotency_key', params.idempotencyKey)
        .maybeSingle()
      if (raced) {
        return { sub_task_id: raced.id, title: raced.title, status: raced.status, message: 'תת-משימה זהה נוצרה במקביל — מחזירה את הקיימת.' }
      }
    }
    throw new Error(`spawnSubagent insert failed: ${error.message}`)
  }

  // Fire-and-forget only when under the concurrency cap. Otherwise the
  // dispatcher cron runs this pending task when capacity frees.
  if (fireNow) {
    try {
      fetch(`${SUPABASE_URL}/functions/v1/run-agent-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ task_id: data.id }),
      }).catch((e) => {
        console.error('[subagent] run-agent-task fire-and-forget failed:', e?.message)
      })
    } catch (e: any) {
      console.error('[subagent] run-agent-task invoke threw:', e?.message)
    }
  } else {
    console.log(`[subagent] At capacity (${runningCount} running) — task ${data.id} queued for dispatcher.`)
  }

  return {
    sub_task_id: data.id,
    title: data.title,
    status: data.status,
    message: fireNow
      ? 'תת-משימה נוצרה ורצה ברקע. השתמשי ב-get_subagent_result עם ה-sub_task_id כדי לקבל תוצאה.'
      : 'תת-משימה נוצרה וממתינה בתור (מעל תקרת המקביליות) — תרוץ אוטומטית בקרוב.',
  }
}

/**
 * Spawn several subagents at once as a batch (delegate_parallel). Each item
 * gets a self-contained brief; they share a batch_id so results can be
 * aggregated with getBatchResults. Best practice: each subtask must be
 * independent and non-overlapping — the caller is responsible for scoping.
 */
export async function spawnSubagentBatch(
  supabase: any,
  common: Omit<SpawnSubagentParams, 'title' | 'prompt' | 'idempotencyKey'>,
  items: Array<{ title: string; prompt: string; taskSkills?: string[] }>,
  batchId: string,
): Promise<{ batch_id: string; spawned: SpawnSubagentResult[] }> {
  const spawned: SpawnSubagentResult[] = []
  for (const it of items) {
    const r = await spawnSubagent(supabase, {
      ...common,
      title: it.title,
      prompt: it.prompt,
      taskSkills: it.taskSkills ?? common.taskSkills,
      batchId,
    })
    spawned.push(r)
  }
  return { batch_id: batchId, spawned }
}

/**
 * Aggregate a batch's results. Returns per-task status/output (settled), plus
 * counts — partial failure is isolated: one failed subtask doesn't hide the
 * others. `all_done` is true only when every member reached a terminal state.
 */
export async function getBatchResults(
  supabase: any,
  tenantId: string,
  batchId: string,
): Promise<{
  batch_id: string
  total: number
  completed: number
  failed: number
  running: number
  all_done: boolean
  tasks: SubagentResultPayload[]
}> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, title, status, run_count, started_at, completed_at, result')
    .eq('tenant_id', tenantId)
    .eq('batch_id', batchId)
  if (error) throw new Error(`getBatchResults: ${error.message}`)

  const rows = (data || []) as any[]
  const tasks: SubagentResultPayload[] = rows.map((row) => {
    const result = (row.result || {}) as any
    const status = row.status as string
    let output: string | undefined
    if (typeof result.final_output === 'string') output = result.final_output
    else if (Array.isArray(result.conversation_history)) {
      const last = [...result.conversation_history].reverse()
        .find((m: any) => m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim().length > 0)
      if (last) output = last.content
    }
    return {
      sub_task_id: row.id,
      status,
      done: status === 'completed' || status === 'failed',
      run_count: row.run_count ?? 0,
      output: output ? output.slice(0, 4000) : undefined,
      started_at: row.started_at,
      completed_at: row.completed_at,
      error: typeof result.error === 'string' ? result.error : null,
    }
  })

  const completed = tasks.filter((t) => t.status === 'completed').length
  const failed = tasks.filter((t) => t.status === 'failed').length
  const running = tasks.filter((t) => !t.done).length
  return {
    batch_id: batchId,
    total: tasks.length,
    completed,
    failed,
    running,
    all_done: tasks.length > 0 && running === 0,
    tasks,
  }
}

export interface SubagentResultPayload {
  sub_task_id: string
  status: string
  done: boolean
  run_count?: number
  output?: string
  tools_used?: number
  started_at?: string | null
  completed_at?: string | null
  error?: string | null
}

/**
 * Read a subagent task's status/output. The child run-agent-task writes its
 * conversation history & final output into agent_tasks.result on each loop.
 */
export async function getSubagentResult(
  supabase: any,
  tenantId: string,
  subTaskId: string,
): Promise<SubagentResultPayload> {
  const { data, error } = await supabase
    .from('agent_tasks')
    .select('id, title, status, run_count, started_at, completed_at, result, tenant_id')
    .eq('id', subTaskId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw new Error(`getSubagentResult: ${error.message}`)
  if (!data) throw new Error(`subagent task not found: ${subTaskId}`)

  const result = (data.result || {}) as any
  const status = data.status as string
  const done = status === 'completed' || status === 'failed'

  // run-agent-task stores conversation_history + tools_used inside `result`.
  // Pull the last assistant text as the user-facing output.
  let output: string | undefined
  if (typeof result.final_output === 'string') {
    output = result.final_output
  } else if (Array.isArray(result.conversation_history)) {
    const lastAssistant = [...result.conversation_history]
      .reverse()
      .find((m: any) => m?.role === 'assistant' && typeof m.content === 'string' && m.content.trim().length > 0)
    if (lastAssistant) output = lastAssistant.content
  }

  return {
    sub_task_id: data.id,
    status,
    done,
    run_count: data.run_count ?? 0,
    output: output ? output.slice(0, 4000) : undefined,
    tools_used: typeof result.total_tool_calls === 'number' ? result.total_tool_calls : undefined,
    started_at: data.started_at,
    completed_at: data.completed_at,
    error: typeof result.error === 'string' ? result.error : null,
  }
}
