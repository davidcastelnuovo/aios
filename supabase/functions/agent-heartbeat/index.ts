import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    
    // Get all tenants with heartbeat enabled
    const { data: settings, error: settingsError } = await supabase
      .from('tenant_heartbeat_settings')
      .select('*')
      .eq('enabled', true)

    if (settingsError) throw settingsError
    if (!settings || settings.length === 0) {
      return new Response(JSON.stringify({ message: 'No tenants with heartbeat enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []

    for (const setting of settings) {
      const tenantId = setting.tenant_id
      const allowedActions = (setting.allowed_actions || []) as string[]
      
      // Check active hours
      const now = new Date()
      const currentHour = now.getUTCHours() + 3 // Israel timezone offset
      if (currentHour < setting.active_hours_start || currentHour >= setting.active_hours_end) {
        results.push({ tenant_id: tenantId, skipped: true, reason: 'outside active hours' })
        continue
      }

      const actionsLog: any[] = []
      let tasksReviewed = 0

      // 1. Find overdue tasks
      const { data: overdueTasks } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, due_time, assigned_agent, campaigner_id, campaigners(full_name, phone)')
        .eq('tenant_id', tenantId)
        .in('status', ['open', 'in_progress'])
        .lt('due_date', now.toISOString().split('T')[0])
        .limit(50)

      tasksReviewed += overdueTasks?.length || 0

      // 2. Find stale agent tasks (assigned but no updates in 24h)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const { data: staleTasks } = await supabase
        .from('tasks')
        .select('id, title, assigned_agent, campaigner_id')
        .eq('tenant_id', tenantId)
        .not('assigned_agent', 'is', null)
        .eq('status', 'in_progress')
        .lt('updated_at', oneDayAgo)
        .limit(20)

      tasksReviewed += staleTasks?.length || 0

      // 3. Send WhatsApp reminders for overdue tasks
      if (allowedActions.includes('reminders') && overdueTasks && overdueTasks.length > 0) {
        for (const task of overdueTasks.slice(0, 5)) {
          const campaigner = task.campaigners as any
          if (campaigner?.phone) {
            try {
              await fetch(`${SUPABASE_URL}/functions/v1/send-green-api-message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({
                  phone: campaigner.phone,
                  message: `תזכורת: המשימה "${task.title}" באיחור. נא לטפל בהקדם.`,
                  tenantId,
                }),
              })
              actionsLog.push({ type: 'reminder_sent', task_id: task.id, task_title: task.title, to: campaigner.full_name })
            } catch (e) {
              actionsLog.push({ type: 'reminder_failed', task_id: task.id, error: e instanceof Error ? e.message : 'unknown' })
            }
          }
        }
      }

      // 4. Release stale agent tasks
      if (allowedActions.includes('status_update') && staleTasks && staleTasks.length > 0) {
        for (const task of staleTasks) {
          await supabase.from('tasks')
            .update({ assigned_agent: null })
            .eq('id', task.id)
          await supabase.from('task_updates').insert({
            task_id: task.id, user_id: 'system', tenant_id: tenantId,
            content: `Heartbeat: המשימה שוחררה מהסוכן ${task.assigned_agent} בגלל חוסר פעילות 24+ שעות`,
            update_type: 'agent_action',
          })
          actionsLog.push({ type: 'stale_task_released', task_id: task.id, task_title: task.title })
        }
      }

      // 5. Generate daily summary
      const summary = [
        `סקירת Heartbeat - ${now.toISOString().split('T')[0]}`,
        `משימות שנסקרו: ${tasksReviewed}`,
        `משימות באיחור: ${overdueTasks?.length || 0}`,
        `משימות חסומות (סוכן): ${staleTasks?.length || 0}`,
        `פעולות שבוצעו: ${actionsLog.length}`,
      ].join('\n')

      // 6. Log heartbeat
      await supabase.from('heartbeat_logs').insert({
        tenant_id: tenantId,
        tasks_reviewed: tasksReviewed,
        actions_taken: actionsLog,
        summary,
      })

      results.push({ tenant_id: tenantId, tasks_reviewed: tasksReviewed, actions: actionsLog.length, summary })
    }

    return new Response(JSON.stringify({ success: true, tenants_processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Heartbeat error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
