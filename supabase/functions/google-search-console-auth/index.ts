import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  console.log('Google Search Console Auth - Action:', action);

  // OAuth configuration
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-search-console-auth?action=oauth_callback`;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return new Response(
      JSON.stringify({ error: 'Google OAuth credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle OAuth initiation
  if (action === 'authorize') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { tenantId, userId } = await req.json();
      
      if (!tenantId || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing tenantId or userId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Google Search Console scopes
      const scopes = [
        'https://www.googleapis.com/auth/webmasters.readonly',
      ].join(' ');

      const state = btoa(JSON.stringify({ tenantId, userId }));

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);

      console.log('Generated auth URL for Google Search Console');

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error generating auth URL:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to generate authorization URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Handle OAuth callback
  if (action === 'oauth_callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    async function getTenantSlug(tenantId: string): Promise<string> {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('slug')
        .eq('id', tenantId)
        .single();
      return tenant?.slug || 'app';
    }

    if (error) {
      const redirectUrl = `${Deno.env.get('APP_URL') || 'https://lovable.dev'}/integrations?error=${error}`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    }

    if (!code || !state) {
      return new Response('Missing code or state', { status: 400 });
    }

    try {
      const { tenantId, userId } = JSON.parse(atob(state));
      const tenantSlug = await getTenantSlug(tenantId);

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

      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        throw new Error(tokens.error_description || tokens.error);
      }

      const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000)).toISOString();

      // Check if integration already exists
      const { data: existing } = await supabase
        .from('tenant_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_search_console')
        .eq('user_id', userId)
        .maybeSingle();

      const integrationData = {
        is_active: true,
        api_key: tokens.access_token,
        settings: {
          refresh_token: tokens.refresh_token,
          expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      let saveError;
      if (existing) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', existing.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            integration_type: 'google_search_console',
            ...integrationData,
          });
        saveError = error;
      }

      if (saveError) {
        console.error('Error saving tokens:', saveError);
        throw saveError;
      }

      const redirectUrl = `${Deno.env.get('APP_URL') || 'https://lovable.dev'}/t/${tenantSlug}/integrations?google_search_console=connected`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      const redirectUrl = `${Deno.env.get('APP_URL') || 'https://lovable.dev'}/integrations?error=auth_failed`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    }
  }

  // Get Search Console sites
  if (action === 'get_sites') {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { integrationId } = await req.json();
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: integration, error: integrationError } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('id', integrationId)
        .single();

      if (integrationError || !integration) {
        throw new Error('Integration not found');
      }

      let accessToken = integration.api_key;
      const settings = integration.settings as any;

      // Check if token needs refresh
      if (settings?.expires_at && new Date(settings.expires_at) < new Date()) {
        console.log('Token expired, refreshing...');
        
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: settings.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        const refreshData = await refreshResponse.json();
        
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
          
          await supabase
            .from('tenant_integrations')
            .update({
              api_key: accessToken,
              settings: { ...settings, expires_at: newExpiresAt },
            })
            .eq('id', integrationId);
        }
      }

      // Fetch Search Console sites
      const sitesResponse = await fetch(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const sitesData = await sitesResponse.json();
      console.log('Search Console sites response:', JSON.stringify(sitesData));

      if (sitesData.error) {
        throw new Error(sitesData.error.message);
      }

      const sites = (sitesData.siteEntry || []).map((site: any) => ({
        siteUrl: site.siteUrl,
        permissionLevel: site.permissionLevel,
      }));

      return new Response(
        JSON.stringify({ sites }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Invalid action' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
