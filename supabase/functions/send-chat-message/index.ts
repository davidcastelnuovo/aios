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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clientId, message, channel = 'whatsapp' } = await req.json();

    if (!clientId || !message) {
      return new Response(
        JSON.stringify({ error: 'clientId and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client first (includes tenant_id)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, manychat_subscriber_id, tenant_id, agency_id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('Client fetch error:', clientError);
      return new Response(JSON.stringify({ error: 'Client not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = client.tenant_id;

    // Verify user has access to this tenant
    const { data: tenantAccess, error: tenantAccessError } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (tenantAccessError || !tenantAccess) {
      return new Response(JSON.stringify({ error: 'Access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!client.manychat_subscriber_id) {
      return new Response(
        JSON.stringify({ error: 'Client does not have ManyChat subscriber ID configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ManyChat API Key from tenant_integrations
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration || !integration.api_key) {
      console.error('Integration error:', integrationError);
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not configured for this tenant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send message via ManyChat API
    const manychatResponse = await fetch('https://api.manychat.com/fb/sending/sendContent', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: client.manychat_subscriber_id,
        data: {
          version: 'v2',
          content: {
            messages: [{
              type: 'text',
              text: message,
            }],
          },
        },
      }),
    });

    const manychatData = await manychatResponse.json();

    if (!manychatResponse.ok) {
      console.error('ManyChat API error:', manychatData);
      return new Response(
        JSON.stringify({ error: 'Failed to send message via ManyChat', details: manychatData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save message to database
    const { error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        client_id: clientId,
        tenant_id: tenantId,
        direction: 'outbound',
        message_text: message,
        channel,
        sent_by_user_id: user.id,
        raw_provider_data: manychatData,
      });

    if (saveError) {
      console.error('Save message error:', saveError);
    }

    return new Response(
      JSON.stringify({ success: true, provider: manychatData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Send chat message error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
