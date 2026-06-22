import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEVELOPER_TOKEN = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN') || '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

interface GoogleAdsRecord {
  date: string;
  campaign_id: string;
  campaign_name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cost: number;
  conversions: number;
  conversions_value: number;
  cost_per_conversion: number;
  roas: number;
  // Verified leads from connected WordPress site (Elementor submissions with matching gad_campaignid)
  verified_leads?: number;
  verified_source?: string; // site URL we verified against, for transparency
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Service-role client for writes (bypass RLS - tables can be in different tenants than the requester)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Allow service-role internal calls (e.g. from cron) to bypass user auth.
    // The caller must include x-internal-cron: true AND a valid service role bearer token.
    const isInternalCron = req.headers.get('x-internal-cron') === 'true';
    const authHeader = req.headers.get('Authorization') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const hasServiceRole = !!serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`;

    let user: { id: string | null };
    if (isInternalCron && hasServiceRole) {
      // System cron: created_by must be NULL (placeholder UUID violates FK to auth.users)
      user = { id: null };
    } else {
      const { data: { user: authedUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authedUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = authedUser;
    }

    const { table_id } = await req.json();
    
    if (!table_id) {
      return new Response(JSON.stringify({ error: 'table_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get table with integration settings
    const { data: table, error: tableError } = await supabase
      .from('crm_tables')
      .select('*')
      .eq('id', table_id)
      .maybeSingle();

    if (tableError || !table) {
      return new Response(JSON.stringify({ error: 'Table not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const tableTenantId = table.tenant_id;

    if (table.integration_type !== 'google_ads') {
      return new Response(JSON.stringify({ error: 'Table is not a Google Ads table' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const settings = table.integration_settings || {};
    const dataSource = settings.data_source || 'direct_api';
    
    // Check if this table uses Make.com or Webhook for syncing
    if (dataSource === 'make_api' || dataSource === 'webhook') {
      return new Response(JSON.stringify({ 
        error: 'This table uses Make.com for data sync',
        message: 'טבלה זו משתמשת ב-Make.com לסנכרון נתונים. הגדר Scenario ב-Make.com כדי לסנכרן את הנתונים.',
        data_source: dataSource
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const customerId = settings.customer_id;
    const dateRange = settings.date_range || 'last_30_days';

    if (!customerId) {
      return new Response(JSON.stringify({ error: 'No Google Ads account configured' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get access token — try table tenant first, then fall back to source tenants
    // of cross-tenant agency access (e.g. table in tenant A using Google Ads connected in tenant B
    // because agency is shared via agency_tenant_access).
    let { data: integration } = await supabase
      .from('tenant_integrations')
      .select('*')
      .eq('tenant_id', tableTenantId)
      .eq('integration_type', 'google_ads')
      .eq('is_active', true)
      .maybeSingle();

    if (!integration?.api_key) {
      const { data: accessRows } = await supabase
        .from('agency_tenant_access')
        .select('source_tenant_id')
        .eq('accessing_tenant_id', tableTenantId);
      const sourceTenantIds = (accessRows || [])
        .map((r: any) => r.source_tenant_id)
        .filter((id: any) => !!id && id !== tableTenantId);

      if (sourceTenantIds.length > 0) {
        const { data: fallbackIntegrations } = await supabase
          .from('tenant_integrations')
          .select('*')
          .in('tenant_id', sourceTenantIds)
          .eq('integration_type', 'google_ads')
          .eq('is_active', true);
        integration = (fallbackIntegrations || []).find((i: any) => i.api_key) || null;
      }
    }

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Google Ads not connected' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Mutable settings reference for refresh logic
    let integrationSettings: any = integration.settings || {};
    let accessToken: string = integration.api_key;

    // Refresh if expired/near expiry, OR forced (after a 401).
    async function ensureFreshToken(force = false): Promise<{ ok: boolean; needsReauth?: boolean; error?: string }> {
      const refreshTokenStr = integrationSettings?.refresh_token;
      if (!refreshTokenStr) return { ok: true }; // nothing to do (legacy connection)

      const expiresAtMs = integrationSettings?.expires_at ? new Date(integrationSettings.expires_at).getTime() : 0;
      const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
      const stale = !expiresAtMs || expiresAtMs < fiveMinFromNow;
      if (!force && !stale) return { ok: true };

      const refreshResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshTokenStr,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshResp.json().catch(() => ({}));

      if (!refreshResp.ok || !refreshData.access_token) {
        const err = refreshData?.error || 'refresh_failed';
        const errDesc = refreshData?.error_description || '';
        const isPermanent = err === 'invalid_grant' || err === 'unauthorized_client' || err === 'invalid_client';
        // Mark needs_reauth on permanent failures so the UI can prompt reconnection
        await supabaseAdmin
          .from('tenant_integrations')
          .update({
            is_active: isPermanent ? false : integration.is_active,
            settings: {
              ...integrationSettings,
              needs_reauth: isPermanent ? true : (integrationSettings?.needs_reauth || false),
              last_auth_error: `${err}${errDesc ? ': ' + errDesc : ''}`,
              last_auth_error_at: new Date().toISOString(),
            },
          })
          .eq('id', integration.id);
        console.error('[sync-google-ads] token refresh failed:', err, errDesc);
        return { ok: false, needsReauth: isPermanent, error: errDesc || err };
      }

      accessToken = refreshData.access_token;
      const newExpiresAt = new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString();
      integrationSettings = {
        ...integrationSettings,
        expires_at: newExpiresAt,
      };
      delete integrationSettings.needs_reauth;
      delete integrationSettings.last_auth_error;
      delete integrationSettings.last_auth_error_at;

      await supabaseAdmin
        .from('tenant_integrations')
        .update({
          api_key: accessToken,
          is_active: true,
          settings: integrationSettings,
        })
        .eq('id', integration.id);

      return { ok: true };
    }

    // Proactive refresh once before any API call
    {
      const r = await ensureFreshToken(false);
      if (!r.ok) {
        return new Response(JSON.stringify({
          error: r.needsReauth ? 'needs_reauth' : 'token_refresh_failed',
          message: r.needsReauth
            ? 'החיבור ל-Google Ads בוטל או פג תוקף. יש לחבר מחדש.'
            : 'נכשל רענון של ה-token מול Google.',
          details: r.error,
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Wrapper: any Google Ads call goes through this so 401 triggers a forced refresh + one retry.
    const adsFetch = async (url: string, init: RequestInit): Promise<Response> => {
      const baseHeaders = { ...(init.headers as Record<string, string> || {}) };
      let res = await fetch(url, { ...init, headers: { ...baseHeaders, 'Authorization': `Bearer ${accessToken}` } });
      if (res.status === 401) {
        const r = await ensureFreshToken(true);
        if (!r.ok) return res; // surface the original 401; outer handler will report needs_reauth
        res = await fetch(url, { ...init, headers: { ...baseHeaders, 'Authorization': `Bearer ${accessToken}` } });
      }
      return res;
    };

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);
    
    switch (dateRange) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'yesterday':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        break;
      case 'this_week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
        break;
      case 'last_7_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        break;
      case 'last_14_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
        break;
      case 'this_month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_30_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        break;
      case 'last_90_days':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');


    // Use Google Ads Query Language to fetch campaign performance.
    // We intentionally use ONLY `metrics.conversions` (primary conversions) — not
    // `metrics.all_conversions` — to match exactly the "Conversions" column shown in
    // the Google Ads web UI. all_conversions includes secondary/cross-device/store visits
    // which over-count compared to what the user sees in the UI.
    const query = `
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate.toISOString().split('T')[0]}' AND '${endDate.toISOString().split('T')[0]}'
      ORDER BY segments.date DESC
    `;

    // Use manager_id (MCC) as login-customer-id if available, otherwise use customerId
    let loginCustomerId = settings.manager_id || customerId;

    let searchResponse = await adsFetch(
      `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: {
          'developer-token': DEVELOPER_TOKEN,
          'login-customer-id': loginCustomerId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      }
    );

    let searchData = await searchResponse.json();
    console.log(`[sync-google-ads] table=${table_id} customer=${customerId} login=${loginCustomerId} status=${searchResponse.status} dateRange=${startDate.toISOString().split('T')[0]}..${endDate.toISOString().split('T')[0]}`);
    console.log(`[sync-google-ads] response preview:`, JSON.stringify(searchData).slice(0, 800));

    // If still 401 after a refresh attempt — refresh_token is bad/revoked
    if (searchResponse.status === 401) {
      return new Response(JSON.stringify({
        error: 'needs_reauth',
        message: 'החיבור ל-Google Ads בוטל או פג תוקף. יש לחבר מחדש.',
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }


    // Helper: detect Google Ads error in any response shape (object, array, or wrapped)
    const detectGAError = (data: any): any | null => {
      if (!data) return null;
      if (data.error) return data.error;
      if (Array.isArray(data) && data.length > 0 && data[0]?.error) return data[0].error;
      return null;
    };

    // Helper: try a list of candidate MCCs and return the first that works
    const tryMccCandidates = async (candidates: string[]): Promise<{ data: any; mcc: string } | null> => {
      for (const mcc of candidates) {
        if (!mcc || mcc === customerId) continue;
        const retryResponse = await adsFetch(
          `https://googleads.googleapis.com/v23/customers/${customerId}/googleAds:searchStream`,
          {
            method: 'POST',
            headers: {
              'developer-token': DEVELOPER_TOKEN,
              'login-customer-id': mcc,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          }
        );
        const retryData = await retryResponse.json();
        if (!detectGAError(retryData)) {
          console.log(`[sync-google-ads] Found working MCC: ${mcc}`);
          return { data: retryData, mcc };
        }
        console.log(`[sync-google-ads] MCC ${mcc} failed:`, JSON.stringify(detectGAError(retryData)).slice(0, 200));
      }
      return null;
    };

    let initialError = detectGAError(searchData);

    // If failed and no manager_id was set, try to discover the MCC
    if (initialError && !settings.manager_id) {
      console.log('[sync-google-ads] First attempt failed, trying to discover MCC for account', customerId);

      // Build a candidate list:
      // 1) Known historical MCCs (hardcoded fallback for this project)
      // 2) Any MCCs already discovered for other tables in this tenant
      // 3) listAccessibleCustomers
      const knownMccs = ['1625878765', '4568787244', '8225555809', '6200958104'];

      const { data: tenantTables } = await supabaseAdmin
        .from('crm_tables')
        .select('integration_settings')
        .eq('tenant_id', tableTenantId)
        .eq('integration_type', 'google_ads');
      const tenantMccs = Array.from(new Set(
        (tenantTables || [])
          .map((t: any) => t.integration_settings?.manager_id)
          .filter(Boolean)
          .map(String)
      ));

      let listMccs: string[] = [];
      try {
        const listResponse = await adsFetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', {
          method: 'GET',
          headers: {
            'developer-token': DEVELOPER_TOKEN,
          },
        });
        const listData = await listResponse.json();
        listMccs = (listData?.resourceNames || [])
          .map((r: any) => typeof r === 'string' ? r.split('/')[1] : null)
          .filter(Boolean);
      } catch (e) {
        console.warn('[sync-google-ads] listAccessibleCustomers failed:', e);
      }

      const candidates = Array.from(new Set([...tenantMccs, ...knownMccs, ...listMccs]));
      console.log(`[sync-google-ads] MCC candidates to try (${candidates.length}):`, candidates);

      const result = await tryMccCandidates(candidates);
      if (result) {
        searchData = result.data;
        loginCustomerId = result.mcc;
        initialError = null;

        // Save discovered manager_id for future syncs
        await supabaseAdmin
          .from('crm_tables')
          .update({
            integration_settings: { ...settings, manager_id: result.mcc }
          })
          .eq('id', table_id);
      }
    }

    const finalError = detectGAError(searchData);
    if (finalError) {
      console.error('Google Ads API error:', finalError);
      return new Response(JSON.stringify({
        error: 'Google Ads API error',
        details: finalError.message || JSON.stringify(finalError)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process results
    const records: GoogleAdsRecord[] = [];
    const batchesArr = Array.isArray(searchData) ? searchData : (searchData?.results ? [searchData] : []);
    console.log(`[sync-google-ads] batches received: ${batchesArr.length}`);

    for (const batch of batchesArr) {
      const results = batch.results || [];
      console.log(`[sync-google-ads] batch results: ${results.length}`);
      for (const result of results) {
        const costMicros = parseInt(result.metrics?.costMicros || '0');
        const cost = costMicros / 1000000; // Convert micros to actual currency
        const conversions = parseFloat(result.metrics?.conversions || '0');
        const conversionsValue = parseFloat(result.metrics?.conversionsValue || '0');
        // ALWAYS use `metrics.conversions` to match the Google Ads UI's "Conversions" column.
        // Previously we fell back to `all_conversions` when conversions==0, but that includes
        // secondary actions (cross-device, store visits, view-through) and over-counted vs UI.
        // If a campaign tracks conversions only via `all_conversions`, the user should see 0
        // here — same as Google Ads UI shows in the primary Conversions column.
        const finalConversions = conversions;
        const roas = cost > 0 ? conversionsValue / cost : 0;

        records.push({
          date: result.segments?.date || '',
          campaign_id: result.campaign?.id || '',
          campaign_name: result.campaign?.name || '',
          impressions: parseInt(result.metrics?.impressions || '0'),
          clicks: parseInt(result.metrics?.clicks || '0'),
          ctr: parseFloat(result.metrics?.ctr || '0') * 100, // Convert to percentage
          cpc: parseInt(result.metrics?.averageCpc || '0') / 1000000,
          cost: cost,
          conversions: finalConversions,
          conversions_value: conversionsValue,
          cost_per_conversion: parseInt(result.metrics?.costPerConversion || '0') / 1000000,
          roas: Math.round(roas * 100) / 100,
        });
      }
    }
    console.log(`[sync-google-ads] total records parsed: ${records.length}`);

    // ============================================================
    // ENRICHMENT: Verify lead counts against connected WordPress site
    // For each campaign_id, count actual Elementor form submissions where
    // gad_campaignid matches. This catches discrepancies between Google Ads
    // "Conversions" and real form submissions on the landing page.
    // ============================================================
    let verifiedSiteUrl: string | null = null;
    try {
      // Find an active WordPress site for this client (table.client_id)
      const tableClientId = (table as any).client_id as string | null;
      if (tableClientId) {
        const { data: wpSites } = await supabaseAdmin
          .from('social_media_wordpress_sites')
          .select('id, site_url, campaign_url_mapping, campaign_form_mapping')
          .eq('client_id', tableClientId)
          .eq('is_active', true)
          .limit(1);

        const site = wpSites?.[0];
        if (site) {
          verifiedSiteUrl = site.site_url;
          // Compute days from date range to limit submission scan
          const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1);

          const { data: subData, error: subErr } = await supabaseAdmin.functions.invoke(
            'fetch-elementor-submissions',
            { body: { site_id: site.id, days: Math.min(daysDiff, 90) } }
          );

          if (!subErr && subData?.success && Array.isArray(subData.submissions)) {
            // Helper: extract URL slug (path segment) from referer
            const extractSlug = (referer: string | null): string => {
              if (!referer) return '';
              try {
                const u = new URL(referer);
                const seg = u.pathname.split('/').filter(Boolean)[0] || '';
                return decodeURIComponent(seg).toLowerCase();
              } catch {
                return '';
              }
            };

            // Hebrew normalization helper for fuzzy campaign↔slug matching
            const normalize = (s: string) =>
              (s || '')
                .toLowerCase()
                .replace(/[-_]/g, ' ')
                .replace(/[^\u0590-\u05FF\w\s]/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            // Build maps:
            //  (a) by exact gad_campaignid -> day -> count
            //  (b) by URL slug -> day -> count  (legacy fallback)
            //  (c) by Elementor form_id -> day -> count  (PRIMARY mapping key)
            //  (d) totals by form for transparency
            const byCampaignId = new Map<string, Map<string, number>>();
            const bySlug = new Map<string, Map<string, number>>();
            const byFormId = new Map<string, Map<string, number>>();
            const formTotals = new Map<string, { total: number; name: string }>();

            for (const sub of subData.submissions) {
              if (sub.source === 'test') continue;
              const day = (sub.created_at || '').slice(0, 10);
              if (!day) continue;

              const cid = sub.gad_campaignid;
              if (cid) {
                if (!byCampaignId.has(cid)) byCampaignId.set(cid, new Map());
                const dm = byCampaignId.get(cid)!;
                dm.set(day, (dm.get(day) || 0) + 1);
              }

              // Index by form_id (primary mapping key)
              const fid = sub.form_id ? String(sub.form_id) : '';
              if (fid) {
                if (!byFormId.has(fid)) byFormId.set(fid, new Map());
                const dm = byFormId.get(fid)!;
                dm.set(day, (dm.get(day) || 0) + 1);
                const cur = formTotals.get(fid);
                formTotals.set(fid, {
                  total: (cur?.total || 0) + 1,
                  name: cur?.name || sub.form_name || fid,
                });
              }

              // Legacy: count slug for google_ads-sourced submissions
              if (sub.source === 'google_ads' || sub.source === 'google') {
                const slug = (sub.slug && sub.slug.length > 0) ? sub.slug : extractSlug(sub.referer);
                if (slug) {
                  if (!bySlug.has(slug)) bySlug.set(slug, new Map());
                  const dm = bySlug.get(slug)!;
                  dm.set(day, (dm.get(day) || 0) + 1);
                }
              }
            }

            // PRIMARY: form_id -> campaign_id mapping
            const formMapping: Record<string, string> = (site as any).campaign_form_mapping || {};
            const campaignIdToForms = new Map<string, string[]>();
            for (const [fid, cid] of Object.entries(formMapping)) {
              if (!cid) continue;
              if (!campaignIdToForms.has(cid)) campaignIdToForms.set(cid, []);
              campaignIdToForms.get(cid)!.push(fid);
            }

            // LEGACY: slug -> campaign_id mapping (kept for backward compat)
            const manualMapping: Record<string, string> = (site as any).campaign_url_mapping || {};
            const campaignIdToSlugs = new Map<string, string[]>();
            for (const [slug, cid] of Object.entries(manualMapping)) {
              if (!cid) continue;
              if (!campaignIdToSlugs.has(cid)) campaignIdToSlugs.set(cid, []);
              campaignIdToSlugs.get(cid)!.push(slug);
            }

            // Annotate each record. Strategy (priority order):
            //  1) Manual FORM→campaign mapping (most reliable - PRIMARY)
            //  2) Exact match by gad_campaignid
            //  3) Legacy slug→campaign mapping (backward compat)
            //  4) Fuzzy match campaign_name ↔ slug
            const slugEntries = Array.from(bySlug.keys()).map((s) => ({ slug: s, tokens: normalize(s).split(' ').filter((t) => t.length > 1) }));

            for (const rec of records) {
              // Strategy 1: manual FORM mapping (PRIMARY)
              const mappedForms = campaignIdToForms.get(rec.campaign_id) || [];
              if (mappedForms.length > 0) {
                let mappedCount = 0;
                for (const fid of mappedForms) {
                  const dm = byFormId.get(fid);
                  if (dm) mappedCount += dm.get(rec.date) || 0;
                }
                rec.verified_leads = mappedCount;
                const formNames = mappedForms.map((fid) => formTotals.get(fid)?.name || fid);
                rec.verified_source = `${site.site_url} (טופס: ${formNames.join(', ')})`;
                continue;
              }

              // Strategy 2: exact campaign_id match
              const dayMapById = byCampaignId.get(rec.campaign_id);
              const exactCount = dayMapById?.get(rec.date) || 0;
              if (exactCount > 0) {
                rec.verified_leads = exactCount;
                rec.verified_source = site.site_url;
                continue;
              }

              // Strategy 3: legacy manual SLUG mapping
              const mappedSlugs = campaignIdToSlugs.get(rec.campaign_id) || [];
              if (mappedSlugs.length > 0) {
                let mappedCount = 0;
                for (const slug of mappedSlugs) {
                  const dm = bySlug.get(slug);
                  if (dm) mappedCount += dm.get(rec.date) || 0;
                }
                rec.verified_leads = mappedCount;
                rec.verified_source = `${site.site_url} (slug: ${mappedSlugs.join(', ')})`;
                continue;
              }

              // Strategy 4: fuzzy fallback - match campaign_name tokens against slug tokens
              const cnTokens = normalize(rec.campaign_name).split(' ').filter((t) => t.length > 1);
              if (cnTokens.length === 0) {
                rec.verified_leads = exactCount;
                continue;
              }
              let bestSlug: string | null = null;
              let bestOverlap = 0;
              for (const { slug, tokens } of slugEntries) {
                const overlap = tokens.filter((t) => cnTokens.includes(t)).length;
                if (overlap > bestOverlap) {
                  bestOverlap = overlap;
                  bestSlug = slug;
                }
              }
              if (bestSlug && bestOverlap >= 1) {
                const dm = bySlug.get(bestSlug)!;
                const fuzzyCount = dm.get(rec.date) || 0;
                rec.verified_leads = fuzzyCount;
                if (fuzzyCount > 0) rec.verified_source = `${site.site_url}/${bestSlug} (fuzzy)`;
              } else {
                rec.verified_leads = 0;
              }
            }
            console.log(`[sync-google-ads] enrichment: ${byCampaignId.size} cids, ${byFormId.size} forms, ${bySlug.size} slugs, ${Object.keys(formMapping).length} form mappings, ${Object.keys(manualMapping).length} slug mappings`);
          } else {
            console.warn('[sync-google-ads] WP enrichment skipped:', subErr?.message || subData?.error);
          }
        } else {
          console.log('[sync-google-ads] no active WP site for client; skipping verification');
        }
      }
    } catch (enrichErr: any) {
      // Non-fatal: continue with raw Google Ads data
      console.warn('[sync-google-ads] enrichment error (non-fatal):', enrichErr?.message);
    }

    // Create fields if they don't exist (use admin client - table may belong to a different tenant)
    const fieldKeys = ['date', 'campaign_name', 'campaign_id', 'impressions', 'clicks', 'ctr', 'cpc', 'cost', 'conversions', 'conversions_value', 'cost_per_conversion', 'roas', 'verified_leads'];
    const fieldNames = ['תאריך', 'שם הקמפיין', 'מזהה קמפיין', 'חשיפות', 'קליקים', 'אחוז קליקים', 'עלות לקליק', 'הוצאה', 'המרות', 'ערך המרות', 'עלות להמרה', 'ROAS', 'לידים באתר'];
    const fieldTypes = ['date', 'text', 'text', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number'];

    for (let i = 0; i < fieldKeys.length; i++) {
      const { data: existingField } = await supabaseAdmin
        .from('crm_fields')
        .select('id')
        .eq('table_id', table_id)
        .eq('key', fieldKeys[i])
        .maybeSingle();

      if (!existingField) {
        const { error: fieldErr } = await supabaseAdmin.from('crm_fields').insert({
          table_id,
          key: fieldKeys[i],
          name: fieldNames[i],
          type: fieldTypes[i],
          position: i,
        });
        if (fieldErr) console.error(`[sync-google-ads] field insert error for ${fieldKeys[i]}:`, fieldErr.message);
      }
    }

    // Delete existing records and insert new ones (admin client to bypass RLS)
    const { error: delErr } = await supabaseAdmin
      .from('crm_records')
      .delete()
      .eq('table_id', table_id)
      .eq('tenant_id', tableTenantId);
    if (delErr) console.error('[sync-google-ads] delete error:', delErr.message);

    // Insert new records (batched)
    let inserted = 0;
    if (records.length > 0) {
      const rows = records.map((record) => ({
        table_id,
        tenant_id: tableTenantId,
        created_by: user.id,
        data: record as any,
      }));
      const { error: insErr, count } = await supabaseAdmin
        .from('crm_records')
        .insert(rows, { count: 'exact' });
      if (insErr) {
        console.error('[sync-google-ads] insert error:', insErr.message);
      } else {
        inserted = count ?? rows.length;
      }
    }
    console.log(`[sync-google-ads] inserted: ${inserted}`);

    // Update last_sync_at (admin to bypass RLS for cross-tenant tables)
    await supabaseAdmin
      .from('crm_tables')
      .update({
        integration_settings: {
          ...settings,
          last_sync_at: new Date().toISOString(),
        }
      })
      .eq('id', table_id);

    return new Response(JSON.stringify({
      success: true,
      records_synced: inserted,
      last_sync_at: new Date().toISOString(),
      verified_against: verifiedSiteUrl,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in sync-google-ads-data:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// (Legacy refreshToken removed — replaced by inline ensureFreshToken with retry + needs_reauth handling.)
