import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Get Facebook Master App credentials from environment variables
  function getFacebookCredentials(): { appId: string; appSecret: string } | null {
    const envAppId = Deno.env.get('FACEBOOK_APP_ID');
    const envAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    
    if (envAppId && envAppSecret) {
      console.log('Using Facebook Master App credentials');
      return { appId: envAppId, appSecret: envAppSecret };
    }
    
    console.error('Facebook Master App credentials not configured');
    return null;
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');
    
    // Also check for action in body for POST requests
    let bodyData: any = null;
    if (req.method === 'POST' && !action) {
      try {
        const clonedReq = req.clone();
        bodyData = await clonedReq.json();
        if (bodyData?.action) {
          action = bodyData.action;
        }
      } catch {
        // Body parsing failed, continue with URL action
      }
    }
    
    console.log('Facebook auth action:', action);

    // Generate OAuth URL
    if (action === 'get_auth_url') {
      const { tenant_id, integration_type, redirect_uri, user_id } = await req.json();
      
      const credentials = getFacebookCredentials();
      if (!credentials) {
        return new Response(
          JSON.stringify({ error: 'Facebook integration not configured. Please contact system administrator.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: 'tenant_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Permissions needed for Lead Ads
      const scopes = [
        'pages_manage_ads',
        'leads_retrieval',
        'pages_read_engagement',
        'pages_show_list',
        'ads_management', // For CAPI
      ].join(',');

      // Use a FIXED redirect_uri pointing to the Edge Function callback
      // This way we only need to add ONE redirect_uri in Facebook App settings
      const centralCallbackUrl = `${supabaseUrl}/functions/v1/facebook-auth?action=oauth_callback`;

      // Store state for security - include the original redirect_uri for later redirect
      const state = crypto.randomUUID();
      
      // Store state in database temporarily with the frontend redirect_uri
      await supabase
        .from('tenant_settings')
        .upsert({
          tenant_id,
          setting_key: `facebook_oauth_state_${state}`,
          setting_value: { 
            user_id, 
            integration_type: integration_type || 'facebook_lead_ads',
            frontend_redirect_uri: redirect_uri, // Where to redirect user after success
            created_at: new Date().toISOString(),
          },
        });

      const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
      authUrl.searchParams.set('client_id', credentials.appId);
      authUrl.searchParams.set('redirect_uri', centralCallbackUrl); // Fixed central callback
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', `${tenant_id}:${state}`);
      authUrl.searchParams.set('response_type', 'code');

      console.log('Generated auth URL with central callback:', centralCallbackUrl);

      return new Response(
        JSON.stringify({ auth_url: authUrl.toString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle OAuth callback directly from Facebook (browser redirect)
    if (action === 'oauth_callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        console.error('Facebook OAuth error:', error, errorDescription);
        // Redirect to a generic error page or show error
        return new Response(
          `<html><body><script>window.location.href = '/?facebook_error=${encodeURIComponent(errorDescription || error)}';</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      if (!code || !state) {
        return new Response(
          '<html><body><h1>Error: Missing code or state</h1></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Parse state
      const [tenantId, stateToken] = state.split(':');

      // Verify state
      const { data: stateData } = await supabase
        .from('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_key', `facebook_oauth_state_${stateToken}`)
        .single();

      if (!stateData) {
        return new Response(
          '<html><body><h1>Error: Invalid or expired state</h1></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      const { user_id, integration_type, frontend_redirect_uri } = stateData.setting_value as any;

      // Clean up state
      await supabase
        .from('tenant_settings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('setting_key', `facebook_oauth_state_${stateToken}`);

      // Get Master App credentials
      const credentials = getFacebookCredentials();
      if (!credentials) {
        return new Response(
          '<html><body><h1>Error: Facebook integration not configured</h1></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      // Use the SAME central callback URL for token exchange
      const centralCallbackUrl = `${supabaseUrl}/functions/v1/facebook-auth?action=oauth_callback`;

      // Exchange code for access token
      const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', credentials.appId);
      tokenUrl.searchParams.set('redirect_uri', centralCallbackUrl);
      tokenUrl.searchParams.set('client_secret', credentials.appSecret);
      tokenUrl.searchParams.set('code', code);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokenData);
        const errorMsg = tokenData.error?.message || 'Failed to exchange code for token';
        // Extract base URL from frontend_redirect_uri for error redirect
        const baseUrl = frontend_redirect_uri ? new URL(frontend_redirect_uri).origin : '';
        return new Response(
          `<html><body><script>window.location.href = '${baseUrl}/?facebook_error=${encodeURIComponent(errorMsg)}';</script></body></html>`,
          { headers: { 'Content-Type': 'text/html' } }
        );
      }

      const { access_token, expires_in } = tokenData;

      // Get long-lived token
      const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longLivedUrl.searchParams.set('client_id', credentials.appId);
      longLivedUrl.searchParams.set('client_secret', credentials.appSecret);
      longLivedUrl.searchParams.set('fb_exchange_token', access_token);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      const finalToken = longLivedData.access_token || access_token;
      const finalExpiry = longLivedData.expires_in || expires_in;

      // Get user's pages with pagination - Page tokens from long-lived user tokens are PERMANENT!
      let allPages: any[] = [];
      let pagesUrl = `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${finalToken}`;
      
      while (pagesUrl) {
        const pagesResponse = await fetch(pagesUrl);
        const pagesData = await pagesResponse.json();
        
        if (pagesData.data) {
          // Page tokens obtained via long-lived user token are permanent (never expire)
          allPages = allPages.concat(pagesData.data);
        }
        
        pagesUrl = pagesData.paging?.next || null;
      }

      console.log(`User pages fetched: ${allPages.length} total - Page tokens are permanent!`);

      // Check if integration already exists
      const { data: existingInt } = await supabase
        .from('tenant_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', integration_type)
        .maybeSingle();

      // Store or update integration
      const integrationData = {
        tenant_id: tenantId,
        user_id: user_id || null,
        integration_type,
        api_key: finalToken,
        api_token_last_4: finalToken.slice(-4),
        is_active: true,
        settings: {
          pages: allPages,
          token_expires_at: new Date(Date.now() + (finalExpiry || 5184000) * 1000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (existingInt) {
        await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', existingInt.id);
      } else {
        await supabase
          .from('tenant_integrations')
          .insert(integrationData);
      }

      // Redirect user back to their frontend page
      const redirectTo = frontend_redirect_uri || '/';
      // Add success parameter
      const redirectUrl = new URL(redirectTo);
      redirectUrl.searchParams.set('facebook_success', 'true');
      redirectUrl.searchParams.set('pages_count', allPages.length.toString());

      console.log('Redirecting user to:', redirectUrl.toString());

      return new Response(null, {
        status: 302,
        headers: {
          'Location': redirectUrl.toString(),
        },
      });
    }

    // Handle OAuth callback
    if (action === 'callback') {
      const { code, state, redirect_uri } = await req.json();

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'code and state are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse state
      const [tenantId, stateToken] = state.split(':');

      // Verify state
      const { data: stateData } = await supabase
        .from('tenant_settings')
        .select('setting_value')
        .eq('tenant_id', tenantId)
        .eq('setting_key', `facebook_oauth_state_${stateToken}`)
        .single();

      if (!stateData) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired state' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { user_id, integration_type, redirect_uri: storedRedirectUri } = stateData.setting_value as any;

      // Clean up state
      await supabase
        .from('tenant_settings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('setting_key', `facebook_oauth_state_${stateToken}`);

      // Get Master App credentials
      const credentials = getFacebookCredentials();
      if (!credentials) {
        return new Response(
          JSON.stringify({ error: 'Facebook integration not configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Exchange code for access token
      const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      tokenUrl.searchParams.set('client_id', credentials.appId);
      tokenUrl.searchParams.set('redirect_uri', redirect_uri || storedRedirectUri);
      tokenUrl.searchParams.set('client_secret', credentials.appSecret);
      tokenUrl.searchParams.set('code', code);

      const tokenResponse = await fetch(tokenUrl.toString());
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokenData);
        return new Response(
          JSON.stringify({ error: 'Failed to exchange code for token', details: tokenData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { access_token, expires_in } = tokenData;

      // Get long-lived token
      const longLivedUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
      longLivedUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longLivedUrl.searchParams.set('client_id', credentials.appId);
      longLivedUrl.searchParams.set('client_secret', credentials.appSecret);
      longLivedUrl.searchParams.set('fb_exchange_token', access_token);

      const longLivedResponse = await fetch(longLivedUrl.toString());
      const longLivedData = await longLivedResponse.json();

      const finalToken = longLivedData.access_token || access_token;
      const finalExpiry = longLivedData.expires_in || expires_in;

      // Get user's pages
      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${finalToken}`
      );
      const pagesData = await pagesResponse.json();

      console.log('User pages:', pagesData);

      // Check if integration already exists
      const { data: existingInt } = await supabase
        .from('tenant_integrations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('integration_type', integration_type)
        .maybeSingle();

      // Store or update integration
      const integrationData = {
        tenant_id: tenantId,
        user_id: user_id || null,
        integration_type,
        api_key: finalToken,
        api_token_last_4: finalToken.slice(-4),
        is_active: true,
        settings: {
          pages: pagesData.data || [],
          token_expires_at: new Date(Date.now() + (finalExpiry || 5184000) * 1000).toISOString(),
        },
        updated_at: new Date().toISOString(),
      };

      if (existingInt) {
        await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', existingInt.id);
      } else {
        await supabase
          .from('tenant_integrations')
          .insert(integrationData);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          pages: pagesData.data || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get pages for an integration
    if (action === 'get_pages') {
      const { integration_id } = await req.json();

      const { data: integration, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('id', integration_id)
        .single();

      if (error || !integration) {
        return new Response(
          JSON.stringify({ error: 'Integration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pagesResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?access_token=${integration.api_key}`
      );
      const pagesData = await pagesResponse.json();

      if (!pagesResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch pages', details: pagesData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ pages: pagesData.data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lead forms for a page
    if (action === 'get_lead_forms') {
      const { integration_id, page_id } = await req.json();

      const { data: integration, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('id', integration_id)
        .single();

      if (error || !integration) {
        return new Response(
          JSON.stringify({ error: 'Integration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // First get page access token
      const settings = integration.settings as any;
      const pages = settings?.pages || [];
      const page = pages.find((p: any) => p.id === page_id);
      const pageAccessToken = page?.access_token || integration.api_key;

      const formsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/leadgen_forms?access_token=${pageAccessToken}`
      );
      const formsData = await formsResponse.json();

      if (!formsResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch forms', details: formsData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ forms: formsData.data || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Subscribe to page webhooks
    if (action === 'subscribe_page') {
      const data = bodyData || await req.json();
      const { integration_id, page_id } = data;

      const { data: integration, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('id', integration_id)
        .single();

      if (error || !integration) {
        return new Response(
          JSON.stringify({ error: 'Integration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const settings = integration.settings as any;
      const pages = settings?.pages || [];
      const page = pages.find((p: any) => p.id === page_id);
      const pageAccessToken = page?.access_token;

      if (!pageAccessToken) {
        return new Response(
          JSON.stringify({ error: 'Page access token not found' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Subscribe page to leadgen webhook
      const subscribeResponse = await fetch(
        `https://graph.facebook.com/v21.0/${page_id}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageAccessToken}`,
        { method: 'POST' }
      );
      const subscribeData = await subscribeResponse.json();

      if (!subscribeResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to subscribe page', details: subscribeData }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update integration settings with selected page
      await supabase
        .from('tenant_integrations')
        .update({
          settings: {
            ...settings,
            page_id,
            page_name: page?.name,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration_id);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in facebook-auth:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
