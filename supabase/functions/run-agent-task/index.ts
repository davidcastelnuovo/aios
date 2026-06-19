import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const MAX_EXECUTION_TIME_MS = 240_000 // 240s, leave 60s buffer before 300s wall clock

import { requireAuth } from "../_shared/security.ts";

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
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
    const updatedCheckpoint = {
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
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
