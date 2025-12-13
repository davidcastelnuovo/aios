import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔍 Checking for overdue tasks...')

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]
    console.log(`📅 Today's date: ${today}`)

    // Find all tasks that:
    // 1. Have a due_date that has passed (before today)
    // 2. Are not completed (status != 'done')
    // 3. Haven't been notified yet (overdue_notified_at IS NULL)
    const { data: overdueTasks, error: fetchError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        status,
        tenant_id,
        notes,
        priority,
        campaigner_id,
        client_id,
        lead_id,
        agency_id,
        campaigners:campaigner_id (id, full_name, email, phone),
        clients:client_id (id, name, contact_name, phone, email),
        leads:lead_id (id, company_name, contact_name, phone, email),
        agencies:agency_id (id, name)
      `)
      .lt('due_date', today)
      .neq('status', 'done')
      .is('overdue_notified_at', null)

    if (fetchError) {
      console.error('❌ Error fetching overdue tasks:', fetchError)
      throw fetchError
    }

    console.log(`📋 Found ${overdueTasks?.length || 0} overdue tasks to process`)

    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No overdue tasks found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Group tasks by tenant to trigger automations
    const tasksByTenant: Record<string, any[]> = {}
    for (const task of overdueTasks) {
      if (!task.tenant_id) continue
      if (!tasksByTenant[task.tenant_id]) {
        tasksByTenant[task.tenant_id] = []
      }
      tasksByTenant[task.tenant_id].push(task)
    }

    console.log(`📊 Processing tasks for ${Object.keys(tasksByTenant).length} tenants`)

    // Trigger automation for each tenant's overdue tasks
    const results: any[] = []
    
    for (const [tenantId, tasks] of Object.entries(tasksByTenant)) {
      console.log(`🏢 Processing ${tasks.length} overdue tasks for tenant ${tenantId}`)
      
      for (const task of tasks) {
        try {
          // Calculate days overdue
          const dueDate = new Date(task.due_date)
          const todayDate = new Date(today)
          const daysOverdue = Math.floor((todayDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          
          console.log(`⏰ Task "${task.title}" is ${daysOverdue} days overdue`)

          // Prepare payload for automation
          const payload = {
            trigger_type: 'task_overdue',
            tenant_id: tenantId,
            data: {
              id: task.id,
              title: task.title,
              due_date: task.due_date,
              days_overdue: daysOverdue,
              status: task.status,
              priority: task.priority,
              notes: task.notes,
              tenant_id: tenantId,
              campaigner_id: task.campaigner_id,
              client_id: task.client_id,
              lead_id: task.lead_id,
              agency_id: task.agency_id,
              campaigner: task.campaigners,
              client: task.clients,
              lead: task.leads,
              agency: task.agencies,
            }
          }

          // Call trigger-automation function
          const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
          })

          const triggerResult = await triggerResponse.json()
          console.log(`✅ Automation triggered for task ${task.id}:`, triggerResult)

          // Mark task as notified
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ overdue_notified_at: new Date().toISOString() })
            .eq('id', task.id)

          if (updateError) {
            console.error(`❌ Error marking task ${task.id} as notified:`, updateError)
          } else {
            console.log(`📝 Marked task ${task.id} as notified`)
          }

          results.push({
            task_id: task.id,
            task_title: task.title,
            days_overdue: daysOverdue,
            automation_result: triggerResult,
            success: true
          })
        } catch (taskError) {
          console.error(`❌ Error processing task ${task.id}:`, taskError)
          results.push({
            task_id: task.id,
            task_title: task.title,
            success: false,
            error: taskError instanceof Error ? taskError.message : 'Unknown error'
          })
        }
      }
    }

    console.log(`🎉 Finished processing ${results.length} overdue tasks`)

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} overdue tasks`,
        processed: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('❌ Error in check-overdue-tasks:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
