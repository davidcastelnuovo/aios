import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date().toISOString().split('T')[0]
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, due_date, status, overdue_notified_at')
      .not('campaigner_id', 'is', null)
      .not('due_date', 'is', null)
      .lt('due_date', today)
      .neq('status', 'done')
      .is('overdue_notified_at', null)
      .limit(100)

    if (fetchError) throw fetchError

    if (!overdueTasks?.length) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No overdue tasks found',
        processed: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const results: Array<Record<string, unknown>> = []
    for (const task of overdueTasks) {
      try {
        const workerResponse = await fetch(`${supabaseUrl}/functions/v1/task-notification-worker`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ task_id: task.id }),
        })
        const workerResult = await workerResponse.json().catch(() => ({}))
        results.push({
          task_id: task.id,
          task_title: task.title,
          success: workerResponse.ok,
          worker_result: workerResult,
        })
      } catch (taskError) {
        results.push({
          task_id: task.id,
          task_title: task.title,
          success: false,
          error: taskError instanceof Error ? taskError.message : 'Unknown error',
        })
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.length} overdue tasks`,
      processed: results.length,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('❌ Error in check-overdue-tasks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
