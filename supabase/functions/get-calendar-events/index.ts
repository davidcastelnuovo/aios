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

    const { timeMin, timeMax } = await req.json();
    console.log('Fetching calendar events:', { timeMin, timeMax, userId: user.id });

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

    // Fetch events from Google Calendar
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.append('timeMin', timeMin);
    url.searchParams.append('timeMax', timeMax);
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    console.log('Fetching events from Google Calendar API...');

    const calendarResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const eventsData = await calendarResponse.json();
    
    if (!calendarResponse.ok) {
      console.error('Google Calendar API error:', eventsData);
      throw new Error(eventsData.error?.message || 'Failed to fetch events');
    }

    console.log('Events fetched successfully:', eventsData.items?.length || 0);

    return new Response(JSON.stringify({ 
      success: true, 
      events: eventsData.items || []
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
