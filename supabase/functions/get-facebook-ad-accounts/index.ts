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

    // Get Facebook access token from tenant_integrations
    const { data: integration } = await supabase
      .from('tenant_integrations')
      .select('api_key, settings')
      .eq('tenant_id', tenantId)
      .in('integration_type', ['facebook', 'facebook_lead_ads'])
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (!integration?.api_key) {
      return new Response(JSON.stringify({ 
        error: 'Facebook not configured',
        message: 'יש להגדיר תחילה את האינטגרציה עם פייסבוק'
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = integration.api_key;
    
    // Fetch ad accounts from Facebook Graph API with pagination
    let allAdAccounts: any[] = [];
    let nextUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_status,currency,amount_spent&limit=100&access_token=${accessToken}`;
    
    while (nextUrl) {
      const response = await fetch(nextUrl);
      const data = await response.json();
      
      if (data.error) {
        console.error('Facebook API error:', data.error);
        return new Response(JSON.stringify({ 
          error: 'Facebook API error',
          details: data.error.message
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (data.data) {
        allAdAccounts = [...allAdAccounts, ...data.data];
      }
      
      nextUrl = data.paging?.next || null;
    }

    console.log(`Fetched ${allAdAccounts.length} ad accounts for tenant ${tenantId}`);

    return new Response(JSON.stringify({ 
      ad_accounts: allAdAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        account_status: acc.account_status,
        currency: acc.currency,
        amount_spent: acc.amount_spent
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
