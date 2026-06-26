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


  // OAuth configuration
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-analytics-auth?action=oauth_callback`;

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
      const { tenantId, userId, addNew, origin } = await req.json();
      
      if (!tenantId || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing tenantId or userId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Google Analytics scopes
      const scopes = [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' ');

      const state = btoa(JSON.stringify({ tenantId, userId, addNew: !!addNew, origin: origin || null }));

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      // Force account selection when adding a new account
      if (addNew) {
        authUrl.searchParams.set('login_hint', '');
      }
      authUrl.searchParams.set('state', state);


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

    let stateOrigin: string | null = null;
    let stateTenantId: string | null = null;
    if (state) {
      try {
        const parsed = JSON.parse(atob(state));
        stateOrigin = parsed.origin || null;
        stateTenantId = parsed.tenantId || null;
      } catch { /* noop */ }
    }
    // Strip any trailing slash so `${APP_BASE}/t/...` never produces a double slash.
    const APP_BASE = (stateOrigin || Deno.env.get('APP_URL') || 'https://after-lead.com').replace(/\/+$/, '');

    if (error) {
      const slug = stateTenantId ? await getTenantSlug(stateTenantId) : 'app';
      const redirectUrl = `${APP_BASE}/t/${slug}/integrations?error=${error}`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    }

    if (!code || !state) {
      return new Response('Missing code or state', { status: 400 });
    }

    try {
      const { tenantId, userId, addNew } = JSON.parse(atob(state));
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

      // Fetch the Google email for this account
      let googleEmail = '';
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        googleEmail = userInfo.email || '';
      } catch (e) {
        console.error('Failed to fetch Google user info:', e);
      }

      const { data: allGa, error: allGaError } = await supabase
        .from('tenant_integrations')
        .select('id, user_id, settings')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'google_analytics');

      if (allGaError) {
        throw allGaError;
      }

      const existingForUser = allGa?.find((row: any) => row.user_id === userId) || null;
      const existingForEmail = googleEmail
        ? allGa?.find((row: any) => row.settings?.google_email === googleEmail) || null
        : null;
      const existingIntegration = existingForEmail || existingForUser;
      const existingSettings = (existingIntegration?.settings as Record<string, unknown> | null) || null;

      const integrationData = {
        is_active: true,
        api_key: tokens.access_token,
        settings: {
          ...existingSettings,
          refresh_token: tokens.refresh_token || existingSettings?.refresh_token,
          expires_at: expiresAt,
          connected_at: new Date().toISOString(),
          google_email: googleEmail || existingSettings?.google_email || '',
          // Clear any stale reconnect flags now that the user has re-authorized.
          needs_reauth: false,
          reauth_reason: null,
          reauth_marked_at: null,
        },
        updated_at: new Date().toISOString(),
      };

      let saveError;
      if (existingIntegration) {
        const { error } = await supabase
          .from('tenant_integrations')
          .update(integrationData)
          .eq('id', existingIntegration.id);
        saveError = error;
      } else {
        const { error } = await supabase
          .from('tenant_integrations')
          .insert({
            tenant_id: tenantId,
            user_id: userId,
            integration_type: 'google_analytics',
            ...integrationData,
          });
        saveError = error;
      }

      if (saveError) {
        console.error('Error saving tokens:', saveError);
        throw saveError;
      }

      const redirectUrl = `${APP_BASE}/t/${tenantSlug}/integrations?google_analytics=connected`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      const slug = stateTenantId ? await getTenantSlug(stateTenantId) : 'app';
      const redirectUrl = `${APP_BASE}/t/${slug}/integrations?error=auth_failed`;
      return new Response(null, {
        status: 302,
        headers: { Location: redirectUrl }
      });
    }
  }

  // Get Google Analytics properties
  if (action === 'get_properties') {
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
      const ownerEmail = settings?.google_email || null;

      const refreshAccessToken = async (): Promise<{ ok: boolean; reason?: string }> => {
        if (!settings?.refresh_token) return { ok: false, reason: 'missing_refresh_token' };
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
        const refreshData = await refreshResponse.json().catch(() => ({}));
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
          return { ok: true };
        }
        return { ok: false, reason: refreshData.error || 'refresh_failed' };
      };

      // Proactive refresh if expired
      if (settings?.expires_at && new Date(settings.expires_at) < new Date()) {
        await refreshAccessToken();
      }

      // Fetch GA4 properties using Admin API
      const fetchAccounts = () =>
        fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

      let accountsResponse = await fetchAccounts();
      let accountsData: any = await accountsResponse.json().catch(() => ({}));

      // If credentials invalid, try one forced refresh and retry once.
      const looksUnauthorized =
        accountsResponse.status === 401 ||
        accountsData?.error?.code === 401 ||
        /invalid.*credential|invalid_grant|unauthorized/i.test(accountsData?.error?.message || '');

      if (looksUnauthorized) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.ok) {
          accountsResponse = await fetchAccounts();
          accountsData = await accountsResponse.json().catch(() => ({}));
        } else {
          return new Response(
            JSON.stringify({
              properties: [],
              needs_reconnect: true,
              owner_email: ownerEmail,
              reason: refreshResult.reason || 'token_revoked',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (accountsData?.error) {
        const stillUnauthorized =
          accountsData.error.code === 401 ||
          /invalid.*credential|invalid_grant|unauthorized/i.test(accountsData.error.message || '');
        if (stillUnauthorized) {
          return new Response(
            JSON.stringify({
              properties: [],
              needs_reconnect: true,
              owner_email: ownerEmail,
              reason: 'token_revoked',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Non-auth Google error (e.g. 403 / API not enabled / quota). Do NOT crash
        // with an opaque 500 — log the full error for diagnosis and fall back to any
        // previously cached property list so the UI stays usable.
        console.error('GA get_properties Google API error:', JSON.stringify(accountsData.error));
        const cachedOnError = Array.isArray(settings?.available_properties) ? settings.available_properties : [];
        return new Response(
          JSON.stringify({
            properties: cachedOnError,
            needs_reconnect: cachedOnError.length === 0,
            owner_email: ownerEmail,
            reason: 'google_api_error',
            error_detail: accountsData.error.message || String(accountsData.error),
            error_code: accountsData.error.code ?? null,
            error_status: accountsData.error.status ?? null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract properties from account summaries
      const properties: any[] = [];
      if (accountsData.accountSummaries) {
        for (const account of accountsData.accountSummaries) {
          if (account.propertySummaries) {
            for (const prop of account.propertySummaries) {
              properties.push({
                id: prop.property,
                name: prop.displayName,
                accountName: account.displayName,
              });
            }
          }
        }
      }

      // Cache the fresh list so the UI can fall back to it if a future call fails.
      try {
        await supabase
          .from('tenant_integrations')
          .update({
            settings: { ...settings, available_properties: properties },
          })
          .eq('id', integrationId);
      } catch (_e) { /* non-fatal */ }

      return new Response(
        JSON.stringify({ properties, owner_email: ownerEmail }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
  } catch (error: any) {
    console.error('Error fetching properties:', error);
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
