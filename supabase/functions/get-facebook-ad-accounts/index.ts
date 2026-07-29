import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { data: tenantId } = await supabase.rpc('get_user_tenant_id', { _user_id: user.id });
    if (!tenantId) return jsonResponse({ error: 'No tenant found' }, 403);

    const url = new URL(req.url);
    const requestedIntegrationId = url.searchParams.get('integration_id') || null;
    const rawAdAccountId = url.searchParams.get('ad_account_id')?.trim() || '';
    const requestedAdAccountId = rawAdAccountId.replace(/^act_/i, '').replace(/\D/g, '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const integrationFields = 'id, api_key, settings, shared_from_integration_id, user_id, connection_visibility, tenant_id';
    let integration: any = null;

    if (requestedIntegrationId) {
      const { data: specific } = await supabaseAdmin
        .from('tenant_integrations')
        .select(integrationFields)
        .eq('id', requestedIntegrationId)
        .eq('is_active', true)
        .maybeSingle();

      if (specific) {
        const sameTenant = specific.tenant_id === tenantId;
        const directlyAccessible = specific.user_id === user.id || specific.connection_visibility === 'org' || specific.user_id === null;
        let sharedPermission = false;

        if (specific.connection_visibility === 'shared') {
          const { data: permission } = await supabaseAdmin
            .from('integration_user_permissions')
            .select('id')
            .eq('integration_id', requestedIntegrationId)
            .eq('user_id', user.id)
            .maybeSingle();
          sharedPermission = !!permission;
        }

        if (sameTenant && (directlyAccessible || sharedPermission)) integration = specific;
      }

      if (!integration) return jsonResponse({ error: 'Integration not found or access denied', message: 'אין גישה לחיבור המבוקש' }, 403);
    } else {
      const { data: ownIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select(integrationFields)
        .eq('tenant_id', tenantId)
        .in('integration_type', ['facebook', 'facebook_lead_ads'])
        .eq('is_active', true)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      integration = ownIntegration;

      if (!integration?.api_key) {
        const { data: orgIntegration } = await supabaseAdmin
          .from('tenant_integrations')
          .select(integrationFields)
          .eq('tenant_id', tenantId)
          .in('integration_type', ['facebook', 'facebook_lead_ads'])
          .eq('is_active', true)
          .eq('connection_visibility', 'org')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        integration = orgIntegration;
      }

      if (!integration?.api_key) {
        const { data: fallback } = await supabaseAdmin
          .from('tenant_integrations')
          .select(integrationFields)
          .eq('tenant_id', tenantId)
          .in('integration_type', ['facebook', 'facebook_lead_ads'])
          .eq('is_active', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        integration = fallback;
      }
    }

    if (integration?.shared_from_integration_id && !integration?.api_key) {
      const { data: sourceIntegration } = await supabaseAdmin
        .from('tenant_integrations')
        .select('api_key, settings')
        .eq('id', integration.shared_from_integration_id)
        .maybeSingle();
      if (sourceIntegration?.api_key) integration = { ...integration, api_key: sourceIntegration.api_key };
    }

    if (!integration?.api_key) {
      return jsonResponse({ error: 'Facebook not configured', message: 'יש להגדיר תחילה את האינטגרציה עם פייסבוק' }, 400);
    }

    const accessToken = integration.api_key;
    const fields = 'id,name,account_status,currency,amount_spent,business';

    // Fast path: validate exactly one account. This avoids enumerating every Business Manager account.
    if (rawAdAccountId) {
      if (!requestedAdAccountId) return jsonResponse({ error: 'Invalid ad account id', message: 'מזהה חשבון המודעות אינו תקין' }, 400);

      const graphUrl = new URL(`https://graph.facebook.com/v21.0/act_${requestedAdAccountId}`);
      graphUrl.searchParams.set('fields', fields);
      graphUrl.searchParams.set('access_token', accessToken);

      const graphResponse = await fetch(graphUrl);
      const graphData: any = await graphResponse.json();

      if (!graphResponse.ok || graphData.error) {
        const message = graphData?.error?.message || 'Facebook account validation failed';
        console.warn('Facebook direct account validation failed', { requestedAdAccountId, message });
        return jsonResponse({ error: 'Ad account validation failed', message: 'לא ניתן לגשת לחשבון המודעות. בדוק את המזהה ואת הרשאות החיבור.', facebook_message: message }, graphResponse.status === 404 ? 404 : 400);
      }

      const business = graphData.business || null;
      const account = {
        id: graphData.id || `act_${requestedAdAccountId}`,
        name: graphData.name || `act_${requestedAdAccountId}`,
        account_status: graphData.account_status,
        currency: graphData.currency || 'ILS',
        amount_spent: graphData.amount_spent,
        business_id: business?.id || null,
        business_name: business?.name || null,
      };

      return jsonResponse({
        ad_account: account,
        ad_accounts: [account],
        integration_id: integration.id,
        integration_visibility: integration.connection_visibility || 'private',
      });
    }

    // Compatibility fallback for older callers that still expect enumeration.
    const fetchEdge = async (edgeUrl: string): Promise<any[]> => {
      const rows: any[] = [];
      let next: string | null = edgeUrl;
      try {
        while (next) {
          const response = await fetch(next);
          const data: any = await response.json();
          if (!response.ok || data.error) break;
          if (Array.isArray(data.data)) rows.push(...data.data);
          next = data.paging?.next || null;
        }
      } catch (error: any) {
        console.warn('Facebook edge fetch failed', error?.message);
      }
      return rows;
    };

    const owned = await fetchEdge(`https://graph.facebook.com/v21.0/me/adaccounts?fields=${fields}&limit=100&access_token=${accessToken}`);
    const businesses = await fetchEdge(`https://graph.facebook.com/v21.0/me/businesses?fields=id,name&limit=100&access_token=${accessToken}`);
    const businessAccounts: any[] = [];

    for (const business of businesses) {
      const [clientAccounts, ownedAccounts] = await Promise.all([
        fetchEdge(`https://graph.facebook.com/v21.0/${business.id}/client_ad_accounts?fields=${fields}&limit=200&access_token=${accessToken}`),
        fetchEdge(`https://graph.facebook.com/v21.0/${business.id}/owned_ad_accounts?fields=${fields}&limit=200&access_token=${accessToken}`),
      ]);
      for (const account of [...clientAccounts, ...ownedAccounts]) {
        businessAccounts.push({ ...account, business_id: business.id, business_name: business.name });
      }
    }

    const byId = new Map<string, any>();
    for (const account of [...owned, ...businessAccounts]) {
      if (account?.id && !byId.has(account.id)) byId.set(account.id, account);
    }

    return jsonResponse({
      ad_accounts: [...byId.values()].map((account) => ({
        id: account.id,
        name: account.name,
        account_status: account.account_status,
        currency: account.currency,
        amount_spent: account.amount_spent,
        business_id: account.business_id || account.business?.id || null,
        business_name: account.business_name || account.business?.name || null,
      })),
      integration_id: integration.id,
      integration_visibility: integration.connection_visibility || 'private',
    });
  } catch (error: any) {
    console.error('Error in get-facebook-ad-accounts:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});
