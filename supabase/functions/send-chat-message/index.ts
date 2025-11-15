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
      console.error('❌ Authentication failed:', authError);
      console.log('📋 Authorization header:', req.headers.get('Authorization') ? 'Present' : 'Missing');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        details: authError?.message 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('✅ User authenticated:', user.id);

    const { clientId, leadId, message, channel = 'whatsapp', templateId, templateVariables } = await req.json();

    if ((!clientId && !leadId) || (!message && !templateId)) {
      return new Response(
        JSON.stringify({ error: 'clientId or leadId, and either message or templateId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contact first (includes tenant_id)
    let contact: any;
    let contactTable: string;
    let contactId: string;

    if (clientId) {
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
      contact = client;
      contactTable = 'clients';
      contactId = clientId;
    } else {
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('id, company_name as name, manychat_subscriber_id, tenant_id, agency_id')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        console.error('Lead fetch error:', leadError);
        return new Response(JSON.stringify({ error: 'Lead not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      contact = lead;
      contactTable = 'leads';
      contactId = leadId;
    }

    const tenantId = contact.tenant_id;

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

    if (!contact.manychat_subscriber_id) {
      return new Response(
        JSON.stringify({ error: 'Contact does not have ManyChat subscriber ID configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📤 Sending message to subscriber:', contact.manychat_subscriber_id);
    
    // Get template if templateId provided
    let template = null;
    if (templateId) {
      const { data: templateData, error: templateError } = await supabase
        .from('manychat_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      
      if (templateError || !templateData) {
        console.error('Template fetch error:', templateError);
        return new Response(
          JSON.stringify({ error: 'Template not found or inactive' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!templateData.automation_trigger_name) {
        return new Response(
          JSON.stringify({ error: 'Template does not have automation trigger name configured' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      template = templateData;
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
    let manychatPayload: any;
    let manychatUrl: string;
    
    if (template) {
      // Trigger automation with template
      manychatUrl = 'https://api.manychat.com/fb/sending/sendContent';
      manychatPayload = {
        version: 1,
        subscriber_id: contact.manychat_subscriber_id,
        trigger_name: template.automation_trigger_name,
        context: templateVariables || {}
      };
    } else {
      // Send regular message
      manychatUrl = 'https://api.manychat.com/fb/sending/sendContent';
      manychatPayload = {
        subscriber_id: contact.manychat_subscriber_id,
        data: {
          version: 'v2',
          content: {
            type: channel,
            messages: [{
              type: 'text',
              text: message,
            }],
          },
        },
        message_tag: 'ACCOUNT_UPDATE',
      };
    }

    console.log('📨 ManyChat request URL:', manychatUrl);
    console.log('📨 ManyChat request payload:', JSON.stringify(manychatPayload, null, 2));

    const manychatResponse = await fetch(manychatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(manychatPayload),
    });

    const manychatData = await manychatResponse.json();
    console.log('📥 ManyChat response:', JSON.stringify(manychatData, null, 2));

    if (!manychatResponse.ok) {
      console.error('❌ ManyChat API error:', manychatData);
      console.error('Subscriber ID used:', contact.manychat_subscriber_id);
      console.error('Contact info:', { id: contact.id, name: contact.name });
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send message via ManyChat', 
          details: manychatData,
          subscriberId: contact.manychat_subscriber_id,
          hint: 'The subscriber ID may be incorrect. Check if you need to use a different ID format or if the subscriber exists in ManyChat.'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save message to database
    const insertData: any = {
      tenant_id: tenantId,
      direction: 'outbound',
      message_text: template 
        ? `[Template: ${template.display_name}] ${JSON.stringify(templateVariables || {})}`
        : message,
      channel,
      provider: 'manychat',
      sent_by_user_id: user.id,
      raw_provider_data: manychatData,
    };

    if (clientId) {
      insertData.client_id = clientId;
    } else if (leadId) {
      insertData.lead_id = leadId;
    }

    const { error: saveError } = await supabase
      .from('chat_messages')
      .insert(insertData);

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
