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
    const url = new URL(req.url);
    const queryAction = url.searchParams.get('action');
    
    // For OAuth callback, action comes from URL
    if (queryAction === 'callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        throw new Error('No authorization code provided');
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      // Get user from state parameter if needed, or use service role to update
      console.log('Exchanging code for tokens...');

      const clientId = "152366216077-3ih8o0lpeit12nu99k5tjtfig0l0obdg.apps.googleusercontent.com";
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;
      // Ensure redirectUri matches the one used in the initial auth request

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret!,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      console.log('Token response:', { hasAccessToken: !!tokens.access_token, hasRefreshToken: !!tokens.refresh_token });

      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to get tokens from Google');
      }

      // Get user_id from state or session
      const stateParam = url.searchParams.get('state');
      const userId = stateParam; // We'll pass userId in state

      if (!userId) {
        throw new Error('No user ID in state');
      }

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      // Store tokens in database
      const { error: dbError } = await supabaseClient
        .from('calendar_tokens')
        .upsert({
          user_id: userId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }

      console.log('Tokens stored successfully');

      // Redirect back to the app
      const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovable.app') || '';
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': `${appUrl}/my-profile?calendar_connected=true`,
        },
      });
    }

    // For all other actions, read from body and require authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const requestBody = await req.json();
    const action = requestBody.action;

    const clientId = "152366216077-3ih8o0lpeit12nu99k5tjtfig0l0obdg.apps.googleusercontent.com";
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;

    console.log('Calendar auth request:', { action, userId: user.id });

    // Initial auth request - redirect to Google
    if (action === 'init') {
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar.events',
        access_type: 'offline',
        prompt: 'consent',
        state: user.id, // Pass user ID in state for callback
      })}`;

      console.log('Redirecting to Google auth...');

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check connection status
    if (action === 'status') {
      const { data: tokenData } = await supabaseClient
        .from('calendar_tokens')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({ connected: !!tokenData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Disconnect
    if (action === 'disconnect' && req.method === 'DELETE') {
      await supabaseClient
        .from('calendar_tokens')
        .delete()
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
