// Cron-driven dispatcher for scheduled agent_tasks.
// Picks pending tasks whose scheduled_at <= now() (one-shot),
// or recurring (daily/weekly) tasks whose next slot has elapsed,
// and invokes run-agent-task for each.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const nowIso = new Date().toISOString()
  const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const dispatched: any[] = []
  const errors: any[] = []

  try {
    // 1. One-shot tasks: scheduled_at in the past, never ran, still pending.
    const { data: onceDue, error: onceErr } = await supabase
      .from('agent_tasks')
      .select('id, title, scheduled_at, schedule_type, last_run, status, enabled')
      .eq('status', 'pending')
      .eq('schedule_type', 'once')
      .eq('enabled', true)
      .is('last_run', null)
      .not('scheduled_at', 'is', null)
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(25)
    if (onceErr) throw onceErr

    // 2. Daily recurring: enabled, last_run null or > 24h ago.
    const { data: dailyDue } = await supabase
      .from('agent_tasks')
      .select('id, title, schedule_type, last_run, status, enabled')
      .eq('schedule_type', 'daily')
      .eq('enabled', true)
      .in('status', ['pending', 'completed'])
      .or(`last_run.is.null,last_run.lte.${oneDayAgoIso}`)
      .limit(25)

    // 3. Weekly recurring.
    const { data: weeklyDue } = await supabase
      .from('agent_tasks')
      .select('id, title, schedule_type, last_run, status, enabled')
      .eq('schedule_type', 'weekly')
      .eq('enabled', true)
      .in('status', ['pending', 'completed'])
      .or(`last_run.is.null,last_run.lte.${sevenDaysAgoIso}`)
      .limit(25)

    const allTasks = [...(onceDue || []), ...(dailyDue || []), ...(weeklyDue || [])]

    for (const task of allTasks) {
      // Atomically claim by stamping last_run and flipping status to running.
      // Use last_run guard to avoid double-firing if cron overlaps.
      const claimQuery = supabase
        .from('agent_tasks')
        .update({ last_run: nowIso, status: 'running' })
        .eq('id', task.id)
      // For one-shot: only claim if last_run still null
      if (task.schedule_type === 'once') {
        claimQuery.is('last_run', null)
      } else {
        // For recurring: only claim if last_run still in the past window we matched
        if (task.last_run) claimQuery.eq('last_run', task.last_run)
        else claimQuery.is('last_run', null)
      }
      const { data: claimed, error: claimErr } = await claimQuery.select('id').maybeSingle()
      if (claimErr || !claimed) {
        // Another worker got it
        continue
      }

      // Fire-and-forget run-agent-task
      fetch(`${SUPABASE_URL}/functions/v1/run-agent-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ task_id: task.id }),
      }).catch((e) => console.error(`[dispatch-agent-tasks] invoke failed for ${task.id}:`, e?.message))

      dispatched.push({ id: task.id, title: task.title, schedule_type: task.schedule_type })
    }

    console.log(`[dispatch-agent-tasks] dispatched ${dispatched.length} tasks at ${nowIso}`)
    return new Response(JSON.stringify({ ok: true, count: dispatched.length, dispatched, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[dispatch-agent-tasks] error:', e)
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
