import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching ManyChat integration for tenant:', tenantId);

    // Get ManyChat API key from tenant_integrations
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .maybeSingle();

    if (integrationError) {
      console.error('Error fetching integration:', integrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch integration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration || !integration.is_active || !integration.api_key) {
      console.log('ManyChat integration not active or API key missing');
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch tags from ManyChat API
    console.log('Fetching tags from ManyChat API');
    const manychatResponse = await fetch('https://api.manychat.com/fb/page/getTags', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!manychatResponse.ok) {
      const errorText = await manychatResponse.text();
      console.error('ManyChat API error:', manychatResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch tags from ManyChat',
          details: errorText 
        }),
        { status: manychatResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tagsData = await manychatResponse.json();
    console.log('Successfully fetched tags:', tagsData);

    return new Response(
      JSON.stringify({ tags: tagsData.data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-manychat-tags:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
