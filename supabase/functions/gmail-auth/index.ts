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

    // OAuth callback
    if (queryAction === 'callback') {
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code provided');

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-auth?action=callback`;
      if (!clientId || !clientSecret) throw new Error('Missing Google credentials');

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      if (!tokens.access_token || !tokens.refresh_token) {
        console.error('Token error:', tokens);
        throw new Error('Failed to get tokens from Google');
      }

      // state = userId|tenantId
      const stateParam = url.searchParams.get('state') || '';
      const [userId, tenantId] = stateParam.split('|');
      if (!userId || !tenantId) throw new Error('Invalid state parameter');

      // Fetch Google email
      let googleEmail = null;
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` },
        });
        if (res.ok) {
          const info = await res.json();
          googleEmail = info.email;
        }
      } catch (e) {
        console.error('Failed to fetch user info:', e);
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));

      const { error: dbError } = await supabaseClient
        .from('gmail_tokens')
        .upsert({
          user_id: userId,
          tenant_id: tenantId,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt.toISOString(),
          google_email: googleEmail,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (dbError) {
        console.error('DB error:', dbError);
        throw dbError;
      }

      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Gmail Connected</title>
            <script>
              window.opener?.postMessage({ type: 'gmail_connected' }, '*');
              setTimeout(() => window.close(), 1000);
            </script>
          </head>
          <body style="font-family: system-ui; text-align: center; padding: 50px;">
            <h1>✅ Gmail התחבר בהצלחה!</h1>
            <p>החלון ייסגר אוטומטית...</p>
          </body>
        </html>
      `, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Authenticated actions
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader) throw new Error('No authorization header');

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const requestBody = await req.json();
    const action = requestBody.action;

    if (action === 'init') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
      if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID');

      const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/gmail-auth?action=callback`;
      const tenantId = requestBody.tenantId;
      if (!tenantId) throw new Error('Missing tenantId');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify',
        access_type: 'offline',
        prompt: 'consent',
        state: `${user.id}|${tenantId}`,
      })}`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'status') {
      const { data: tokenData } = await anonClient
        .from('gmail_tokens')
        .select('google_email')
        .eq('user_id', user.id)
        .single();

      return new Response(JSON.stringify({
        connected: !!tokenData,
        google_email: tokenData?.google_email || null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      const { error } = await serviceClient
        .from('gmail_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
