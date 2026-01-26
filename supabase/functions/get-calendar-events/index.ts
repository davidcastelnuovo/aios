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

    const { timeMin, timeMax, target_user_id } = await req.json();
    
    // Determine which user's calendar to access
    const calendarOwnerId = target_user_id || user.id;
    console.log('Fetching calendar events:', { timeMin, timeMax, requestingUserId: user.id, calendarOwnerId });

    // If accessing another user's calendar, verify permission
    if (target_user_id && target_user_id !== user.id) {
      const { data: hasAccess, error: accessError } = await supabaseClient
        .rpc('user_has_calendar_access', {
          _accessor_user_id: user.id,
          _owner_user_id: target_user_id,
          _required_permission: 'view'
        });

      if (accessError) {
        console.error('Error checking calendar access:', accessError);
        throw new Error('Failed to verify calendar access');
      }

      if (!hasAccess) {
        throw new Error('You do not have permission to view this calendar');
      }
    }

    // Get calendar owner's tokens (using service role for cross-user access)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenData, error: tokenError } = await serviceClient
      .from('calendar_tokens')
      .select('*')
      .eq('user_id', calendarOwnerId)
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
      console.log('Token refresh response:', refreshData);
      
      if (!refreshData.access_token) {
        console.error('Token refresh failed:', refreshData);

        // If Google says the refresh token is invalid or revoked, ask client to reconnect
        if (refreshData.error === 'invalid_grant' || (refreshData.error_description && String(refreshData.error_description).toLowerCase().includes('invalid'))) {
          try {
            await supabaseClient
              .from('calendar_tokens')
              .delete()
              .eq('user_id', user.id);
          } catch (cleanupError) {
            console.error('Failed to cleanup invalid calendar tokens', cleanupError);
          }

          return new Response(JSON.stringify({
            success: false,
            needsReconnect: true,
            error: 'invalid_grant',
            message: 'Google calendar connection expired or was revoked. Please reconnect your calendar.'
          }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        throw new Error(`Failed to refresh access token: ${refreshData.error || 'Unknown error'}`);
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000));

      await serviceClient
        .from('calendar_tokens')
        .update({
          access_token: accessToken,
          expires_at: newExpiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', calendarOwnerId);

      console.log('Token refreshed successfully');
    }

    // Fetch calendar list first
    console.log('Fetching calendar list from Google...');
    const calendarListUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    
    const calendarListResponse = await fetch(calendarListUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!calendarListResponse.ok) {
      const errorData = await calendarListResponse.json();
      console.error('Calendar list API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to fetch calendar list');
    }

    const calendarListData = await calendarListResponse.json();
    const calendars = calendarListData.items || [];
    console.log(`Found ${calendars.length} calendars`);

    // Fetch events from all calendars
    console.log('Fetching events from all calendars...');
    const allEvents: any[] = [];
    
    for (const calendar of calendars) {
      try {
        const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`);
        url.searchParams.append('timeMin', timeMin);
        url.searchParams.append('timeMax', timeMax);
        url.searchParams.append('singleEvents', 'true');
        url.searchParams.append('orderBy', 'startTime');

        const calendarResponse = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (calendarResponse.ok) {
          const eventsData = await calendarResponse.json();
          const events = (eventsData.items || []).map((event: any) => ({
            ...event,
            calendarId: calendar.id,
            calendarName: calendar.summary,
            calendarColor: calendar.backgroundColor || calendar.foregroundColor,
          }));
          allEvents.push(...events);
          console.log(`Fetched ${events.length} events from calendar: ${calendar.summary}`);
        } else {
          console.warn(`Failed to fetch events from calendar ${calendar.summary}`);
        }
      } catch (calError) {
        console.error(`Error fetching events from calendar ${calendar.summary}:`, calError);
      }
    }

    // Sort all events by start time
    allEvents.sort((a, b) => {
      const aStart = new Date(a.start?.dateTime || a.start?.date);
      const bStart = new Date(b.start?.dateTime || b.start?.date);
      return aStart.getTime() - bStart.getTime();
    });

    console.log(`Total events fetched: ${allEvents.length} from ${calendars.length} calendars`);

    return new Response(JSON.stringify({ 
      success: true, 
      events: allEvents,
      calendars: calendars.map((cal: any) => ({
        id: cal.id,
        name: cal.summary,
        color: cal.backgroundColor || cal.foregroundColor,
        primary: cal.primary || false,
      })),
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
