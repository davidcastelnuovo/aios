import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'No tenant found' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Optional: caller can specify a specific integration_id to use
    const url = new URL(req.url);
    const requestedIntegrationId = url.searchParams.get('integration_id') || null;

    // Use service role to bypass RLS for reliable token retrieval
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let integration: any = null;

    if (requestedIntegrationId) {
      // Fetch the specific integration and verify the user has access
      const { data: specific } = await supabaseAdmin
        .from('tenant_integrations')
        .select('id, api_key, settings, shared_from_integration_id, user_id, connection_visibility, tenant_id')
        .eq('id', requestedIntegrationId)
        .eq('is_active', true)
        .maybeSingle();

      if (specific) {
        const canAccess =
          specific.user_id === user.id ||
          specific.connection_visibility === 'org' ||
          specific.user_id === null;

        if (!canAccess && specific.connection_visibility === 'shared') {
          const { data: perm } = await supabaseAdmin
            .from('integration_user_permissions')
            .select('id')
            .eq('integration_id', requestedIntegrationId)
            .eq('user_id', user.id)
            .maybeSingle();
          if (perm) integration = specific;
        } else if (canAccess) {
          integration = specific;
        }
      }

      if (!integration) {
        return new Response(JSON.stringify({
          error: 'Integration not found or access denied',
          message: 'אין גישה לחיבור המבוקש',
        }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Auto-select: prefer the user's own connection, then org-visible, then shared
      // 1. User's own connection
      const { data: ownIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('id, api_key, settings, shared_from_integration_id, user_id, connection_visibility')
        .eq('tenant_id', tenantId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ownIntegration?.api_key) {
        integration = ownIntegration;
      } else {
        // 2. Org-visible connections
        const { data: orgIntegration } = await supabaseAdmin
          .from('tenant_integrations')
          .select('id, api_key, settings, shared_from_integration_id, user_id, connection_visibility')
          .eq('tenant_id', tenantId)
          .in('integration_type', ['facebook', 'facebook_lead_ads'])
          .eq('is_active', true)
          .eq('connection_visibility', 'org')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (orgIntegration?.api_key) {
          integration = orgIntegration;
        } else {
          // 3. Shared with this specific user
          const { data: permissions } = await supabaseAdmin
            .from('integration_user_permissions')
            .select('integration_id')
            .eq('user_id', user.id);

          const sharedIds = (permissions || []).map((p: any) => p.integration_id);

          if (sharedIds.length > 0) {
            const { data: sharedIntegration } = await supabaseAdmin
              .from('tenant_integrations')
              .select('id, api_key, settings, shared_from_integration_id, user_id, connection_visibility')
              .eq('tenant_id', tenantId)
              .in('integration_type', ['facebook', 'facebook_lead_ads'])
              .eq('is_active', true)
              .in('id', sharedIds)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (sharedIntegration?.api_key) {
              integration = sharedIntegration;
            }
          }

          // 4. Fallback: any active integration for this tenant (legacy behaviour)
          if (!integration) {
            const { data: fallback } = await supabaseAdmin
              .from('tenant_integrations')
              .select('id, api_key, settings, shared_from_integration_id, user_id, connection_visibility')
              .eq('tenant_id', tenantId)
              .in('integration_type', ['facebook', 'facebook_lead_ads'])
              .eq('is_active', true)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            integration = fallback;
          }
        }
      }
    }

    console.log('Facebook integration lookup:', {
      tenantId,
      userId: user.id,
      requestedId: requestedIntegrationId,
      found: !!integration,
      hasToken: !!integration?.api_key,
      visibility: integration?.connection_visibility,
      sharedFrom: integration?.shared_from_integration_id,
    });

    // If this is a cross-tenant shared integration, fetch the source token
    if (integration?.shared_from_integration_id && !integration?.api_key) {
      const { data: sourceIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key, settings')
        .eq('id', integration.shared_from_integration_id)
        .maybeSingle();

      console.log('Shared source lookup:', { sourceId: integration.shared_from_integration_id, hasToken: !!sourceIntegration?.api_key });
      if (sourceIntegration?.api_key) {
        integration = { ...integration, api_key: sourceIntegration.api_key };
      }
    }

    if (!integration?.api_key) {
      return new Response(JSON.stringify({
        error: 'Facebook not configured',
        message: 'יש להגדיר תחילה את האינטגרציה עם פייסבוק',
        debug: { tenantId, foundIntegration: !!integration }
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.api_key;
    const FIELDS = 'id,name,account_status,currency,amount_spent';

    // Paginate a Graph edge, returning all rows. Never throws.
    const fetchEdge = async (url: string): Promise<any[]> => {
      const out: any[] = [];
      let next: string | null = url;
      try {
        while (next) {
          const r = await fetch(next);
          if (!(r.headers.get('content-type') || '').includes('application/json')) break;
          const d: any = await r.json();
          if (d.error) { console.warn('FB edge error:', d.error?.message); break; }
          if (Array.isArray(d.data)) out.push(...d.data);
          next = d.paging?.next || null;
        }
      } catch (e: any) { console.warn('FB edge fetch failed:', e?.message); }
      return out;
    };

    // 1) Ad accounts the token user OWNS directly.
    const owned = await fetchEdge(`https://graph.facebook.com/v21.0/me/adaccounts?fields=${FIELDS}&limit=100&access_token=${accessToken}`);

    // 2) Agency case: accounts shared via Business Manager.
    const businesses = await fetchEdge(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=100&access_token=${accessToken}`);
    const bmAccounts: any[] = [];
    for (const biz of businesses) {
      const [clientAcc, ownedAcc] = await Promise.all([
        fetchEdge(`https://graph.facebook.com/v21.0/${biz.id}/client_ad_accounts?fields=${FIELDS}&limit=200&access_token=${accessToken}`),
        fetchEdge(`https://graph.facebook.com/v21.0/${biz.id}/owned_ad_accounts?fields=${FIELDS}&limit=200&access_token=${accessToken}`),
      ]);
      for (const a of [...clientAcc, ...ownedAcc]) bmAccounts.push({ ...a, business_id: biz.id, business_name: biz.name });
    }

    // Merge + dedupe by account id
    const byId = new Map<string, any>();
    for (const a of [...owned, ...bmAccounts]) {
      if (!a?.id) continue;
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    const allAdAccounts = [...byId.values()];

    console.log('FB ad-account discovery:', {
      owned: owned.length,
      businesses: businesses.length,
      viaBusinessManager: bmAccounts.length,
      total: allAdAccounts.length,
      integrationId: integration.id,
    });

    return new Response(JSON.stringify({
      ad_accounts: allAdAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        account_status: acc.account_status,
        currency: acc.currency,
        amount_spent: acc.amount_spent,
        business_id: acc.business_id || null,
        business_name: acc.business_name || null,
      })),
      integration_id: integration.id,
      integration_visibility: integration.connection_visibility || 'private',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in get-facebook-ad-accounts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
