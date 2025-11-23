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
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body:', requestBody);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { clientId, leadId, limit = 100, before } = requestBody;

    if (!clientId && !leadId) {
      console.error('Missing clientId or leadId in request');
      return new Response(
        JSON.stringify({ error: 'clientId or leadId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching messages for:', clientId ? `client: ${clientId}` : `lead: ${leadId}`);

    // Get contact to determine tenant_id
    let tenantId: string;
    
    if (clientId) {
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('tenant_id')
        .eq('id', clientId)
        .single();

      if (clientError || !clientData) {
        console.error('Client not found:', clientError);
        return new Response(JSON.stringify({ error: 'Client not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      tenantId = clientData.tenant_id;
    } else {
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select('tenant_id')
        .eq('id', leadId)
        .single();

      if (leadError || !leadData) {
        console.error('Lead not found:', leadError);
        return new Response(JSON.stringify({ error: 'Lead not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      tenantId = leadData.tenant_id;
    }

    console.log('Contact tenant_id:', tenantId);

    // Verify user has access to this tenant
    const { data: userTenantData, error: userTenantError } = await supabase
      .rpc('get_user_tenant_id', { _user_id: user.id });

    if (userTenantError) {
      console.error('Failed to get user tenant:', userTenantError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user's tenant matches the contact's tenant
    if (tenantId !== userTenantData) {
      console.error('User trying to access messages from different tenant');
      return new Response(
        JSON.stringify({ error: 'Access denied - different tenant' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build query - filter by tenant, connection_user, and contact
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('connection_user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (clientId) {
      query = query.eq('client_id', clientId);
    } else {
      query = query.eq('lead_id', leadId);
    }

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data: messages, error: messagesError } = await query;

    if (messagesError) {
      console.error('Messages fetch error:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages', details: messagesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${messages?.length || 0} messages`);

    return new Response(
      JSON.stringify({ messages: messages || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Get chat history error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
