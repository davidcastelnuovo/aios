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

    const { summary, description, start, end } = await req.json();
    console.log('Creating calendar event:', { summary, start, end, userId: user.id });

    if (!summary || !start) {
      throw new Error('Missing required fields: summary and start are required');
    }

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

      // Update token in database
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

    // Create event in Google Calendar
    const event = {
      summary,
      description: description || '',
      start: {
        dateTime: start,
        timeZone: 'Asia/Jerusalem',
      },
      end: {
        dateTime: end || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
    };

    console.log('Sending event to Google Calendar API...');

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

    const eventData = await calendarResponse.json();
    
    if (!calendarResponse.ok) {
      console.error('Google Calendar API error:', eventData);
      throw new Error(eventData.error?.message || 'Failed to create event');
    }

    console.log('Event created successfully:', eventData.id);

    return new Response(JSON.stringify({ 
      success: true, 
      eventId: eventData.id,
      htmlLink: eventData.htmlLink 
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
