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

    // Use service role to bypass RLS for reliable token retrieval (we already authenticated the user above)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Facebook access token from tenant_integrations (including shared)
    let { data: integration, error: intError } = await supabaseAdmin
      .from('tenant_integrations')
      .select('id, api_key, settings, shared_from_integration_id')
      .eq('tenant_id', tenantId)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    console.log('Facebook integration lookup:', { tenantId, found: !!integration, hasToken: !!integration?.api_key, sharedFrom: integration?.shared_from_integration_id, error: intError?.message });

    // If this is a shared integration, fetch the source integration's token
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

    // Paginate a Graph edge, returning all rows. Never throws — a missing permission on
    // one edge must not break discovery via the others.
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

    // 2) Agency case: accounts shared via Business Manager. me/adaccounts does NOT surface
    //    accounts a Business merely has access to (client accounts), so walk each business the
    //    user belongs to and pull both client_ad_accounts and owned_ad_accounts.
    const businesses = await fetchEdge(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=100&access_token=${accessToken}`);
    const bmAccounts: any[] = [];
    for (const biz of businesses) {
      const [clientAcc, ownedAcc] = await Promise.all([
        fetchEdge(`https://graph.facebook.com/v21.0/${biz.id}/client_ad_accounts?fields=${FIELDS}&limit=200&access_token=${accessToken}`),
        fetchEdge(`https://graph.facebook.com/v21.0/${biz.id}/owned_ad_accounts?fields=${FIELDS}&limit=200&access_token=${accessToken}`),
      ]);
      for (const a of [...clientAcc, ...ownedAcc]) bmAccounts.push({ ...a, business_id: biz.id, business_name: biz.name });
    }

    // Merge + dedupe by account id (owned-direct first, then Business Manager).
    const byId = new Map<string, any>();
    for (const a of [...owned, ...bmAccounts]) {
      if (!a?.id) continue;
      if (!byId.has(a.id)) byId.set(a.id, a);
    }
    const allAdAccounts = [...byId.values()];

    console.log('FB ad-account discovery:', { owned: owned.length, businesses: businesses.length, viaBusinessManager: bmAccounts.length, total: allAdAccounts.length });

    return new Response(JSON.stringify({
      ad_accounts: allAdAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        account_status: acc.account_status,
        currency: acc.currency,
        amount_spent: acc.amount_spent,
        business_id: acc.business_id || null,
        business_name: acc.business_name || null,
      }))
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
