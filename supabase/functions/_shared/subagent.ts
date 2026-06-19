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
    task_mode: params.taskMode || 'agent',
    enabled: true,
    created_by: params.createdBy || null,
  }


  const { data, error } = await supabase
    .from('agent_tasks')
    .insert(taskRow)
    .select('id, title, status')
    .single()

  if (error) throw new Error(`spawnSubagent insert failed: ${error.message}`)

  // Fire-and-forget: invoke run-agent-task in background. Do not await.
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

  return {
    sub_task_id: data.id,
    title: data.title,
    status: data.status,
    message: 'תת-משימה נוצרה ורצה ברקע. השתמשי ב-get_subagent_result עם ה-sub_task_id כדי לקבל תוצאה.',
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
