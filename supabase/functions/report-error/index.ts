import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENCLAW_WEBHOOK = Deno.env.get('OPENCLAW_WEBHOOK_URL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { error_message, error_stack, source, context, url, tenant_id } = await req.json()

    if (!error_message) throw new Error('error_message is required')

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user from token if available
    let userId: string | null = null
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      userId = user?.id || null
    }

    // Save to DB
    const { data: errorLog, error: insertError } = await supabase
      .from('error_logs')
      .insert({
        tenant_id: tenant_id || null,
        source: source || 'frontend',
        error_message,
        error_stack: error_stack || null,
        context: context || {},
        url: url || null,
        user_id: userId,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Forward to OpenClaw if webhook configured
    if (OPENCLAW_WEBHOOK) {
      try {
        const payload = {
          event: 'error_reported',
          error_id: errorLog.id,
          source: source || 'frontend',
          error_message,
          error_stack,
          url,
          context,
          tenant_id,
          timestamp: new Date().toISOString(),
        }

        await fetch(`${OPENCLAW_WEBHOOK}/api/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🚨 שגיאה ב-AfterLead\n\nמקור: ${source || 'frontend'}\nשגיאה: ${error_message}\n${url ? `URL: ${url}` : ''}\n${error_stack ? `\nStack:\n${error_stack.slice(0, 500)}` : ''}`,
          }),
          signal: AbortSignal.timeout(5000),
        })

        // Mark as sent
        await supabase
          .from('error_logs')
          .update({ sent_to_agent: true })
          .eq('id', errorLog.id)

      } catch (webhookErr) {
        console.error('Failed to notify OpenClaw:', webhookErr)
        // Don't fail the request if webhook fails
      }
    }

    return new Response(
      JSON.stringify({ success: true, error_id: errorLog.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('report-error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
