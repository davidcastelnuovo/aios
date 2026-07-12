// redeploy trigger: prior CI bundle hit a transient esm.sh 522 fetching supabase-js;
// re-run the deploy (batch-aggregated WhatsApp report fix, PR #131).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { advanceDangerLane, getBatchResults } from '../_shared/subagent.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// When a dangerous batch subtask reaches a terminal state, advance its tenant's
// serial lane so the next queued dangerous subtask runs. Best-effort.
async function maybeAdvanceLane(supabase: any, task: any) {
  try {
    if (task?.batch_id && task?.is_dangerous) {
      await advanceDangerLane(supabase, task.tenant_id)
    }
  } catch (e: any) {
    console.error('[run-agent-task] advanceDangerLane failed:', e?.message)
  }
}

// Compose ONE concise WhatsApp report from a completed delegate_parallel batch,
// instead of firing a separate (truncated) message per subtask. Each subtask's
// output is a per-item finding (e.g. per-client pulse); we join them under their
// titles, capped to a WhatsApp-friendly length with a fair per-item budget.
function buildBatchReport(batch: {
  total: number
  completed: number
  failed: number
  tasks: Array<{ title?: string | null; status: string; output?: string; error?: string | null }>
}): string {
  const MAX = 3800
  const header = `סיכום מרוכז — ${batch.completed}/${batch.total} הושלמו${batch.failed ? `, ${batch.failed} נכשלו` : ''}:`
  const perItemBudget = Math.max(200, Math.floor((MAX - header.length) / Math.max(1, batch.tasks.length)))
  const sections = batch.tasks.map((t) => {
    const name = (t.title || 'ללא כותרת').trim()
    if (t.status === 'failed') return `❌ ${name}: ${t.error || 'נכשל'}`
    const body = (t.output || '').trim() || '—'
    const clipped = body.length > perItemBudget ? body.slice(0, perItemBudget - 1) + '…' : body
    return `• ${name}:\n${clipped}`
  })
  let msg = [header, ...sections].join('\n\n')
  if (msg.length > MAX) msg = msg.slice(0, MAX - 1) + '…'
  return msg
}

// When a delegate_parallel subtask reaches a terminal state (completed OR failed),
// send exactly ONE aggregated WhatsApp report — but only once the WHOLE batch is
// done, and only once. The insert into agent_batch_reports is the atomic claim
// (PK batch_id), so concurrent finishers can't double-send. Best-effort.
async function maybeSendBatchReport(supabase: any, task: any, preservedNotify: any): Promise<void> {
  if (!preservedNotify || preservedNotify.surface !== 'whatsapp' || !task?.batch_id) return
  try {
    const batch = await getBatchResults(supabase, preservedNotify.tenant_id, task.batch_id)
    if (!batch.all_done) return // not the finisher — the last subtask sends
    const { error: claimErr } = await supabase
      .from('agent_batch_reports')
      .insert({ batch_id: task.batch_id })
    if (claimErr) {
      console.log(`[run-agent-task] WA batch report already claimed for batch ${task.batch_id}`)
      return
    }
    let automationId: string | null = preservedNotify.automation_id || null
    if (!automationId) {
      const auto = await findCarmenSessionAutomation(
        supabase,
        preservedNotify.tenant_id,
        null,
        { isGroup: !!preservedNotify.is_group, chatId: preservedNotify.chat_id, phoneNumber: preservedNotify.phone_number },
      )
      automationId = auto?.id || null
    }
    if (!automationId) {
      console.warn(`[run-agent-task] No automation found for WA batch report on batch ${task.batch_id}`)
      return
    }
    const ok = await sendCarmenReplyViaActionStep({
      supabase,
      automationId,
      tenantId: preservedNotify.tenant_id,
      connectionUserId: preservedNotify.connection_user_id,
      chatId: preservedNotify.chat_id,
      phoneNumber: preservedNotify.phone_number || '',
      isGroup: !!preservedNotify.is_group,
      message: buildBatchReport(batch),
    })
    console.log(`[run-agent-task] WA batch report dispatched=${ok} for batch ${task.batch_id} (${batch.total} tasks)`)
  } catch (e: any) {
    console.error(`[run-agent-task] WA batch report failed for batch ${task?.batch_id}:`, e?.message)
  }
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const MAX_EXECUTION_TIME_MS = 240_000 // 240s, leave 60s buffer before 300s wall clock

import { requireAuth } from "../_shared/security.ts";
import { sendCarmenReplyViaActionStep, findCarmenSessionAutomation } from "../_shared/carmen.ts";


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const auth = await requireAuth(req)
  if (!auth) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const startTime = Date.now()

  try {
    const { task_id } = await req.json()
    if (!task_id) throw new Error('task_id is required')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Load the task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', task_id)
      .maybeSingle()

    if (taskError || !task) {
      throw new Error(`Task not found: ${task_id}`)
    }

    if (task.status === 'completed' || task.status === 'failed') {
      return new Response(JSON.stringify({ success: true, message: 'Task already finished' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update task status to running
    await supabase.from('agent_tasks').update({
      status: 'running',
      started_at: task.started_at || new Date().toISOString(),
    }).eq('id', task_id)

    // Load checkpoint from result if resuming
    const checkpoint = (task.result as any) || {}
    const previousHistory = checkpoint.conversation_history || []
    const runCount = (task.run_count || 0) + 1
    const totalToolCalls = checkpoint.total_tool_calls || 0

    // Update run count
    await supabase.from('agent_tasks').update({
      run_count: runCount,
      last_run: new Date().toISOString(),
    }).eq('id', task_id)

    // Find the agent
    // Find the agent - try task's agent_id first, then fallback
    let { data: agent } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', task.agent_id)
      .maybeSingle()
    
    if (!agent) {
      // Fallback to any active agent
      const { data: fallback } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('active', true)
        .limit(1)
        .maybeSingle()
      agent = fallback
    }

    if (!agent) {
      await supabase.from('agent_tasks').update({
        status: 'failed',
        result: { error: 'Agent not found' },
        completed_at: new Date().toISOString(),
      }).eq('id', task_id)
      await maybeAdvanceLane(supabase, task)
      throw new Error('Agent not found')
    }

    // Build the prompt for run-ai-agent
    // If resuming, include continuation instruction
    let commandText = task.description || task.title
    if (previousHistory.length > 0) {
      commandText = `המשך את המשימה שהתחלת. הנה ההקשר: ${task.description || task.title}\n\nאתה ממשיך ריצה קודמת (ריצה מספר ${runCount}). המשך מהנקודה שהפסקת — אל תתחיל מחדש.`
    }

    // Get user context for the task
    const userId = task.created_by || 'system'

    console.log(`[run-agent-task] Starting task ${task_id}, run #${runCount}, history: ${previousHistory.length} msgs`)

    // Call run-ai-agent to execute the task
    const response = await fetch(`${SUPABASE_URL}/functions/v1/run-ai-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Internal service-to-service call: run-ai-agent's requireAuth accepts
        // the service-role key (or a user JWT) — the anon key is neither and 401s.
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        tenant_id: task.tenant_id,
        agent_id: task.agent_id,
        command_text: commandText,
        user_id: userId,
        conversation_history: previousHistory,
        surface: 'task',
      }),
    })

    const elapsed = Date.now() - startTime

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[run-agent-task] run-ai-agent failed: ${response.status}`, errText.substring(0, 500))

      // Check if we should retry
      if (runCount < 5) {
        await supabase.from('agent_tasks').update({
          status: 'pending',
          result: {
            ...checkpoint,
            last_error: errText.substring(0, 500),
            run_count: runCount,
          },
        }).eq('id', task_id)

        // Self-invoke to retry after a delay
        await selfInvoke(task_id)
        return new Response(JSON.stringify({ success: true, message: 'Retrying...' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase.from('agent_tasks').update({
        status: 'failed',
        result: { error: errText.substring(0, 1000), run_count: runCount },
        completed_at: new Date().toISOString(),
      }).eq('id', task_id)

      await maybeAdvanceLane(supabase, task)
      // If this failed subtask was the LAST of a delegate_parallel batch, still
      // send the aggregated report (notify target survives on task.result/checkpoint).
      await maybeSendBatchReport(supabase, task, (checkpoint as any)?.notify || (task.result as any)?.notify || null)
      return new Response(JSON.stringify({ success: false, error: 'Max retries exceeded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
      })
    }

    const result = await response.json()
    console.log(`[run-agent-task] run-ai-agent completed in ${elapsed}ms, tools: ${result.tools_used?.length || 0}`)

    const newTotalToolCalls = totalToolCalls + (result.tools_used?.length || 0)

    // Check if the AI output indicates incomplete work
    const output = result.output || ''
    const isIncomplete = 
      output.includes('הופסקה') ||
      output.includes('לא הספקתי') ||
      output.includes('ממשיכה') ||
      output.includes('נותרו עוד') ||
      (result.tools_used?.length >= 20 && !output.includes('סיימתי') && !output.includes('הושלם'))

    // Build updated checkpoint
    // Preserve `notify` (set by spawnSubagent on the initial result row) so we
    // can dispatch the final output back to the originating WhatsApp chat once
    // the subagent finishes — without this, every per-run update overwrites it.
    const preservedNotify = (checkpoint as any)?.notify || (task.result as any)?.notify || null
    const updatedCheckpoint: any = {
      conversation_history: [
        ...previousHistory,
        { role: 'user', content: commandText },
        { role: 'assistant', content: output },
      ],
      total_tool_calls: newTotalToolCalls,
      tool_log: [...(checkpoint.tool_log || []), ...(result.tool_log || [])],
      run_count: runCount,
      last_output: output,
      execution_time_ms: elapsed,
    }
    if (preservedNotify) updatedCheckpoint.notify = preservedNotify

    if (isIncomplete && runCount < 10) {
      // Save checkpoint and self-invoke to continue
      console.log(`[run-agent-task] Task ${task_id} incomplete after run ${runCount}, self-invoking...`)
      
      await supabase.from('agent_tasks').update({
        status: 'running',
        result: updatedCheckpoint,
      }).eq('id', task_id)

      await selfInvoke(task_id)

      return new Response(JSON.stringify({
        success: true,
        message: `Run ${runCount} complete, continuing...`,
        tools_used: newTotalToolCalls,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Task completed
    console.log(`[run-agent-task] Task ${task_id} COMPLETED after ${runCount} runs, ${newTotalToolCalls} tool calls`)
    
    await supabase.from('agent_tasks').update({
      status: 'completed',
      result: {
        ...updatedCheckpoint,
        final_output: output,
        completed: true,
      },
      completed_at: new Date().toISOString(),
    }).eq('id', task_id)

    // Serial lane: let the next queued dangerous subtask run.
    await maybeAdvanceLane(supabase, task)

    // Push the final output back to the user's WhatsApp chat if this subagent
    // was spawned from a WA conversation. Best-effort — failures are logged
    // but never fail the task.
    if (preservedNotify && preservedNotify.surface === 'whatsapp') {
      if (task.batch_id) {
        // delegate_parallel: DON'T fire one (truncated) WA message per subtask.
        // Only the finisher sends ONE aggregated report (see maybeSendBatchReport).
        await maybeSendBatchReport(supabase, task, preservedNotify)
      } else if (output) {
        // Single (non-batch) task → send its own output, as before. Best-effort.
        try {
          let automationId: string | null = preservedNotify.automation_id || null
          if (!automationId) {
            const auto = await findCarmenSessionAutomation(
              supabase,
              preservedNotify.tenant_id,
              null,
              { isGroup: !!preservedNotify.is_group, chatId: preservedNotify.chat_id, phoneNumber: preservedNotify.phone_number },
            )
            automationId = auto?.id || null
          }
          if (automationId) {
            const trimmed = output.length > 1500 ? output.slice(0, 1497) + '…' : output
            const ok = await sendCarmenReplyViaActionStep({
              supabase,
              automationId,
              tenantId: preservedNotify.tenant_id,
              connectionUserId: preservedNotify.connection_user_id,
              chatId: preservedNotify.chat_id,
              phoneNumber: preservedNotify.phone_number || '',
              isGroup: !!preservedNotify.is_group,
              message: trimmed,
            })
            console.log(`[run-agent-task] WA notify dispatched=${ok} for task ${task_id}`)
          } else {
            console.warn(`[run-agent-task] No automation found for WA notify on task ${task_id}`)
          }
        } catch (e: any) {
          console.error(`[run-agent-task] WA notify failed for task ${task_id}:`, e?.message)
        }
      }
    }


    return new Response(JSON.stringify({
      success: true,
      output: output,
      total_runs: runCount,
      total_tool_calls: newTotalToolCalls,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[run-agent-task] Error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})

async function selfInvoke(taskId: string) {
  try {
    // Use pg_net via supabase to self-invoke
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Use direct HTTP call to self-invoke with a small delay
    await fetch(`${SUPABASE_URL}/functions/v1/run-agent-task`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Self-invoke is service-to-service — requireAuth rejects the anon key.
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ task_id: taskId }),
    }).catch(() => {
      // Fire and forget - don't wait for response
      console.log(`[run-agent-task] Self-invoke fired for task ${taskId}`)
    })
  } catch (e) {
    console.error('[run-agent-task] Self-invoke failed:', e)
  }
}
