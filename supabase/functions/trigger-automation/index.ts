import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationPayload {
  trigger_type: string
  data: any
  tenant_id: string
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

    const payload: AutomationPayload = await req.json()
    console.log('Automation triggered:', payload)

    // Find active automations matching this trigger
    const { data: automations, error: fetchError } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', payload.trigger_type)
      .eq('tenant_id', payload.tenant_id)
      .eq('active', true)

    if (fetchError) {
      console.error('Error fetching automations:', fetchError)
      throw fetchError
    }

    console.log(`Found ${automations?.length || 0} active automations`)

    // Execute each matching automation
    const results = await Promise.allSettled(
      (automations || []).map(async (automation) => {
        const startTime = Date.now()
        
        try {
          // Check conditions if any
          if (automation.conditions && Object.keys(automation.conditions).length > 0) {
            const conditionsMet = checkConditions(automation.conditions, payload.data)
            if (!conditionsMet) {
              console.log(`Conditions not met for automation ${automation.id}`)
              return
            }
          }

          // Execute action based on type
          let response: any
          if (automation.action_type === 'webhook') {
            response = await executeWebhook(automation.configuration, payload.data)
          } else if (automation.action_type === 'email') {
            response = await executeEmail(automation.configuration, payload.data)
          } else if (automation.action_type === 'notification') {
            response = await executeNotification(automation.configuration, payload.data)
          } else if (automation.action_type === 'update_status') {
            response = await executeStatusUpdate(supabase, automation.configuration, payload.data)
          }

          const executionTime = Date.now() - startTime

          // Log success
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: true,
            payload: payload.data,
            response: response,
            execution_time_ms: executionTime,
          })

          return { success: true, automation_id: automation.id }
        } catch (error) {
          const executionTime = Date.now() - startTime
          console.error(`Error executing automation ${automation.id}:`, error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Log failure
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: false,
            error_message: errorMessage,
            payload: payload.data,
            execution_time_ms: executionTime,
          })

          return { success: false, automation_id: automation.id, error: errorMessage }
        }
      })
    )

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason }),
        executed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in trigger-automation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// Helper function to check conditions
function checkConditions(conditions: any, data: any): boolean {
  try {
    // Simple condition checking - can be extended
    for (const [key, value] of Object.entries(conditions)) {
      if (data[key] !== value) {
        return false
      }
    }
    return true
  } catch (error) {
    console.error('Error checking conditions:', error)
    return false
  }
}

// Execute webhook action
async function executeWebhook(config: any, data: any) {
  console.log('Executing webhook:', config.url)
  console.log('Webhook data:', data)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  // Send data as flat JSON object with individual fields
  // This makes it easy to map fields in Make.com
  const bodyData = JSON.stringify(data)

  console.log('Webhook body:', bodyData)

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers: headers,
    body: bodyData,
  })

  const responseText = await response.text()
  console.log('Webhook response:', { status: response.status, body: responseText })
  
  return {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
  }
}

// Execute email action (placeholder)
async function executeEmail(config: any, data: any) {
  console.log('Email action not yet implemented')
  return { message: 'Email action not implemented' }
}

// Execute notification action (placeholder)
async function executeNotification(config: any, data: any) {
  console.log('Notification action not yet implemented')
  return { message: 'Notification action not implemented' }
}

// Execute status update action
async function executeStatusUpdate(supabase: any, config: any, data: any) {
  console.log('Executing status update:', config)
  
  const { entity, status } = config
  const recordId = data.id
  
  if (!recordId) {
    throw new Error('No record ID provided for status update')
  }
  
  // Determine which table to update
  const table = entity === 'lead' ? 'leads' : 'tasks'
  
  console.log(`Updating ${table} ${recordId} to status: ${status}`)
  
  const { data: updateResult, error } = await supabase
    .from(table)
    .update({ status: status })
    .eq('id', recordId)
    .select()
    .single()
  
  if (error) {
    console.error(`Error updating ${table} status:`, error)
    throw error
  }
  
  console.log(`Successfully updated ${table} status:`, updateResult)
  
  return {
    success: true,
    entity: entity,
    recordId: recordId,
    newStatus: status,
    updated: updateResult
  }
}
