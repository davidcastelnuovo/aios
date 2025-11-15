import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ManyChatMessage {
  id: string;
  text: string;
  type: string;
  created_time: number;
  sender: {
    id: string;
    type: string; // 'subscriber' or 'page'
  };
}

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

    const { subscriberId, tenantId, clientId, leadId } = await req.json();

    if (!subscriberId || !tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: subscriberId, tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clientId && !leadId) {
      return new Response(
        JSON.stringify({ error: 'Either clientId or leadId must be provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing conversation for subscriber:', { subscriberId, tenantId, clientId, leadId });

    // Get ManyChat API key
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .maybeSingle();

    if (integrationError || !integration || !integration.is_active || !integration.api_key) {
      console.error('ManyChat integration not configured');
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get subscriber info including recent messages from ManyChat API
    console.log('Fetching subscriber info from ManyChat');
    const manychatResponse = await fetch(
      `https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${subscriberId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${integration.api_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!manychatResponse.ok) {
      const errorText = await manychatResponse.text();
      console.error('ManyChat API error:', manychatResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch subscriber info from ManyChat',
          details: errorText 
        }),
        { status: manychatResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscriberData = await manychatResponse.json();
    console.log('Received subscriber data:', subscriberData);

    // Extract messages from the subscriber data
    // ManyChat API returns last_messages or conversation in the subscriber info
    const messages: ManyChatMessage[] = subscriberData.data?.last_messages || [];
    
    if (messages.length === 0) {
      console.log('No messages found in subscriber data');
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No new messages to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${messages.length} messages to process`);

    // Get existing message IDs from our database to avoid duplicates
    const { data: existingMessages } = await supabase
      .from('chat_messages')
      .select('raw_provider_data')
      .eq('tenant_id', tenantId)
      .or(clientId ? `client_id.eq.${clientId}` : `lead_id.eq.${leadId}`)
      .not('raw_provider_data', 'is', null);

    const existingMessageIds = new Set(
      existingMessages?.map(m => (m.raw_provider_data as any)?.id).filter(Boolean) || []
    );

    // Filter only new messages (from last 10 minutes to catch template messages)
    const tenMinutesAgo = Date.now() / 1000 - 600; // 10 minutes in seconds
    const newMessages = messages.filter(msg => 
      !existingMessageIds.has(msg.id) && 
      msg.created_time > tenMinutesAgo
    );

    console.log(`Found ${newMessages.length} new messages to sync (out of ${messages.length} total)`);

    if (newMessages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, message: 'No new messages to sync' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new messages into database
    const messagesToInsert = newMessages.map(msg => ({
      client_id: clientId || null,
      lead_id: leadId || null,
      tenant_id: tenantId,
      message_text: msg.text || '',
      direction: msg.sender.type === 'page' ? 'outbound' : 'inbound',
      channel: 'whatsapp',
      raw_provider_data: msg,
      created_at: new Date(msg.created_time * 1000).toISOString(),
    }));

    const { error: insertError, data: insertedMessages } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting messages:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save messages', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully synced ${insertedMessages?.length || 0} messages`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: insertedMessages?.length || 0,
        messages: insertedMessages 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-manychat-conversation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
