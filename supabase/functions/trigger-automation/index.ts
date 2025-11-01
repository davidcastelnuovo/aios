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
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  // Replace variables in body template
  let body = config.body_template || JSON.stringify(data)
  if (typeof body === 'string') {
    // Replace {{variable}} with actual values
    body = body.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return data[key.trim()] || match
    })
  }

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers: headers,
    body: body,
  })

  const responseText = await response.text()
  
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
