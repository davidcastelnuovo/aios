// Auto-creates a Google Calendar event for a newly-created task.
// Called as a background fire-and-forget from run-ai-agent after `create_task`.
// Uses service role — no user JWT required.
// Route: POST /functions/v1/create-task-calendar-event
// Body:  { task_id: string }
// Auth:  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshCalendarToken(
  supabase: any,
  userId: string,
  tokenData: any,
): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Missing Google OAuth credentials')

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('Failed to refresh Google Calendar token')

  const newExpiresAt = new Date(Date.now() + (j.expires_in ?? 3600) * 1000)
  await supabase
    .from('calendar_tokens')
    .update({ access_token: j.access_token, expires_at: newExpiresAt.toISOString(), updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return j.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Verify caller uses service role key
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ') || authHeader.slice(7) !== serviceKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { task_id } = await req.json()
    if (!task_id) {
      return new Response(JSON.stringify({ error: 'task_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // 1. Fetch the task
    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, title, notes, due_date, due_time, duration_minutes, campaigner_id, client_id, google_calendar_event_id')
      .eq('id', task_id)
      .single()

    if (taskErr || !task) {
      return new Response(JSON.stringify({ error: 'Task not found', details: taskErr?.message }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Only sync tasks that have both due_date and due_time
    if (!task.due_date || !task.due_time) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Task has no due_date or due_time' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Already synced
    if (task.google_calendar_event_id) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Task already has a calendar event', event_id: task.google_calendar_event_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Find the user linked to this campaigner
    let userId: string | null = null
    if (task.campaigner_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('campaigner_id', task.campaigner_id)
        .maybeSingle()
      userId = profile?.id ?? null
    }

    if (!userId) {
      // Fallback: use the tenant owner's calendar
      const { data: ownerRole } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'owner')
        .maybeSingle()
      userId = ownerRole?.user_id ?? null
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Could not resolve a user to sync calendar for' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Get calendar token
    const { data: tokenData, error: tokenErr } = await supabase
      .from('calendar_tokens')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: 'Google Calendar not connected for this user', user_id: userId }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Refresh token if expired
    let accessToken: string = tokenData.access_token
    if (new Date(tokenData.expires_at) <= new Date()) {
      accessToken = await refreshCalendarToken(supabase, userId, tokenData)
    }

    // 5. Build event — due_time is HH:MM:SS from Postgres time column
    const startDateTime = new Date(`${task.due_date}T${task.due_time}`)
    const durationMs = (task.duration_minutes ?? 30) * 60 * 1000
    const endDateTime = new Date(startDateTime.getTime() + durationMs)

    // Build description: include client link if present
    let description = task.notes ?? ''
    if (task.client_id) {
      description = description ? `${description}\n\nלקוח: ${task.client_id}` : `לקוח: ${task.client_id}`
    }
    if (!description) description = 'משימה ממערכת Marketing Captain'

    const event = {
      summary: task.title,
      description,
      start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Jerusalem' },
      end:   { dateTime: endDateTime.toISOString(),   timeZone: 'Asia/Jerusalem' },
    }

    // 6. Create Google Calendar event
    const calRes = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      },
    )

    if (!calRes.ok) {
      const errBody = await calRes.json()
      console.error('[create-task-calendar-event] Google API error:', errBody)
      return new Response(JSON.stringify({ error: 'Google Calendar API error', details: errBody?.error?.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const calData = await calRes.json()

    // 7. Store event ID on the task
    await supabase
      .from('tasks')
      .update({ google_calendar_event_id: calData.id })
      .eq('id', task_id)

    console.log(`[create-task-calendar-event] Created event ${calData.id} for task ${task_id}`)

    return new Response(JSON.stringify({ success: true, event_id: calData.id, html_link: calData.htmlLink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[create-task-calendar-event] Error:', err)
    return new Response(JSON.stringify({ error: err?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
