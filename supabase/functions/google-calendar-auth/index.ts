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

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;
      if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID secret');

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

      // Redirect back to the app - return HTML that closes the popup
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Calendar Connected</title>
            <script>
              window.opener?.postMessage({ type: 'calendar_connected' }, '*');
              setTimeout(() => window.close(), 1000);
            </script>
          </head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>✅ היומן התחבר בהצלחה!</h1>
            <p>החלון ייסגר אוטומטית...</p>
          </body>
        </html>
      `, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // For all other actions, require authentication
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      throw new Error('No authorization header provided');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { 
            authorization: authHeader
          } 
        } 
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Unauthorized - user not authenticated');
    }
    
    console.log('Authenticated user:', user.id, user.email);

    // Handle disconnect separately (DELETE with no body)
    if (req.method === 'DELETE') {
      console.log('Disconnecting calendar for user:', user.id);
      const { error: deleteError } = await supabaseClient
        .from('calendar_tokens')
        .delete()
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      console.log('Calendar disconnected successfully for user:', user.id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestBody = await req.json();
    const action = requestBody.action;

    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-calendar-auth?action=callback`;

    console.log('Calendar auth request:', { action, userId: user.id });

    // Initial auth request - redirect to Google
    if (action === 'init') {
      if (!clientId) {
        console.error('GOOGLE_CLIENT_ID is missing!');
        throw new Error('Missing GOOGLE_CLIENT_ID secret');
      }
      
      console.log('Creating auth URL for user:', user.id, user.email);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/calendar',
        access_type: 'offline',
        prompt: 'consent',
        state: user.id, // Pass user ID in state for callback
      })}`;

      console.log('Auth URL created successfully, redirecting to Google auth...');

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
