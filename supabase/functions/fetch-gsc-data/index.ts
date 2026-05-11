import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID') || '';
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

  try {
    const { integrationId, siteUrl, startDate, endDate, keywords, aggregateAll } = await req.json();

    if (!integrationId || !siteUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing integrationId or siteUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get integration
    const { data: integration, error: intErr } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('id', integrationId)
      .single();

    if (intErr || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Refresh token if needed
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
          .eq('id', integration.id);
        return { ok: true };
      }
      return { ok: false, reason: refreshData.error || 'refresh_failed' };
    };

    if (settings?.expires_at && new Date(settings.expires_at) < new Date()) {
      await refreshAccessToken();
    }

    // Default date range: last 28 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Build request body for GSC API
    const requestBody: any = {
      startDate: start,
      endDate: end,
      dimensions: ['query'],
      rowLimit: 1000,
      dataState: 'final',
    };

    // If specific keywords provided, filter by them
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      // GSC API doesn't support exact multi-keyword filter natively,
      // so we fetch all and filter client-side
    }

    // Encode siteUrl for the API
    const encodedSiteUrl = encodeURIComponent(siteUrl);
    const gscApiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;

    // Pagination: when aggregateAll=true, loop up to 5 pages (5,000 rows max).
    // Otherwise, fetch a single page (1,000 rows).
    const maxPages = aggregateAll ? 5 : 1;
    const pageSize = 1000;
    const collectedRows: any[] = [];

    for (let page = 0; page < maxPages; page++) {
      const pagedBody = { ...requestBody, rowLimit: pageSize, startRow: page * pageSize };
      const doFetch = () => fetch(gscApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pagedBody),
      });

      let gscResponse = await doFetch();
      let gscData = await gscResponse.json().catch(() => ({}));

      // Retry once after refresh on 401/invalid credentials.
      const looksUnauthorized =
        gscResponse.status === 401 ||
        gscData?.error?.code === 401 ||
        /invalid.*credential|invalid_grant|unauthorized/i.test(gscData?.error?.message || '');

      if (looksUnauthorized) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.ok) {
          gscResponse = await doFetch();
          gscData = await gscResponse.json().catch(() => ({}));
        } else {
          return new Response(
            JSON.stringify({
              rows: [],
              totalRows: 0,
              needs_reconnect: true,
              owner_email: ownerEmail,
              reason: refreshResult.reason || 'token_revoked',
              siteUrl,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (!gscResponse.ok) {
        console.error('GSC API error:', gscData);
        const stillUnauthorized =
          gscResponse.status === 401 ||
          gscData?.error?.code === 401 ||
          /invalid.*credential|invalid_grant|unauthorized/i.test(gscData?.error?.message || '');
        if (stillUnauthorized) {
          return new Response(
            JSON.stringify({
              rows: [],
              totalRows: 0,
              needs_reconnect: true,
              owner_email: ownerEmail,
              reason: 'token_revoked',
              siteUrl,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const isPermissionDenied = gscResponse.status === 403;
        return new Response(
          JSON.stringify({
            error: gscData.error?.message || 'GSC API error',
            permissionDenied: isPermissionDenied,
            siteUrl,
            details: gscData,
          }),
          { status: gscResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const pageRows = Array.isArray(gscData.rows) ? gscData.rows : [];
      collectedRows.push(...pageRows);

      // Stop early if we got less than a full page (no more data).
      if (pageRows.length < pageSize) break;
    }

    // Transform response
    const rows = collectedRows.map((row: any) => ({
      keyword: row.keys?.[0] || '',
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr ? Math.round(row.ctr * 10000) / 100 : 0,
      position: row.position ? Math.round(row.position * 10) / 10 : 0,
    }));

    // Filter by specific keywords if provided
    let filteredRows = rows;
    if (keywords && Array.isArray(keywords) && keywords.length > 0) {
      const keywordSet = new Set(keywords.map((k: string) => k.toLowerCase().trim()));
      filteredRows = rows.filter((r: any) => keywordSet.has(r.keyword.toLowerCase().trim()));
    }

    return new Response(
      JSON.stringify({
        rows: filteredRows,
        totalRows: filteredRows.length,
        dateRange: { start, end },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching GSC data:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
