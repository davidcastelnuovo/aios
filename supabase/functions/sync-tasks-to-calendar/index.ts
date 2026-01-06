import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Starting bulk sync for user:', user.id);

    // Get user's calendar tokens
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('calendar_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenData) {
      throw new Error('Calendar not connected. Please connect your Google Calendar first.');
    }

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);

    // Refresh token if expired
    if (expiresAt <= new Date()) {
      console.log('Token expired, refreshing...');
      
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new Error('Missing Google OAuth credentials');
      }

      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokenData.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (!refreshData.access_token) {
        throw new Error('Failed to refresh access token');
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000));

      await supabaseClient
        .from('calendar_tokens')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      console.log('Token refreshed successfully');
    }

    // Get user's tenant
    const { data: tenantUser } = await supabaseClient
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!tenantUser) {
      throw new Error('User not associated with any tenant');
    }

    // Get tasks with date and time that are not done
    const { data: tasks, error: tasksError } = await supabaseClient
      .from('tasks')
      .select('id, title, due_date, due_time, duration_minutes')
      .eq('tenant_id', tenantUser.tenant_id)
      .not('due_date', 'is', null)
      .not('due_time', 'is', null)
      .neq('status', 'done')
      .order('due_date')
      .order('due_time');

    if (tasksError) {
      throw new Error('Failed to fetch tasks: ' + tasksError.message);
    }

    console.log(`Found ${tasks?.length || 0} tasks to sync`);

    const results = {
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const task of tasks || []) {
      try {
        // Parse time (format: HH:MM:SS)
        const timeParts = task.due_time.split(':');
        const startDateTime = new Date(`${task.due_date}T${task.due_time}`);
        const durationMs = (task.duration_minutes || 30) * 60 * 1000;
        const endDateTime = new Date(startDateTime.getTime() + durationMs);

        const event = {
          summary: task.title,
          description: 'משימה ממערכת Marketing Captain',
          start: {
            dateTime: startDateTime.toISOString(),
            timeZone: 'Asia/Jerusalem',
          },
          end: {
            dateTime: endDateTime.toISOString(),
            timeZone: 'Asia/Jerusalem',
          },
        };

        const calendarResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        );

        if (calendarResponse.ok) {
          results.synced++;
          console.log(`Synced task: ${task.title}`);
        } else {
          const errorData = await calendarResponse.json();
          results.failed++;
          results.errors.push(`${task.title}: ${errorData.error?.message || 'Unknown error'}`);
          console.error(`Failed to sync task ${task.title}:`, errorData);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        results.failed++;
        results.errors.push(`${task.title}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log('Sync completed:', results);

    return new Response(JSON.stringify({ 
      success: true, 
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
