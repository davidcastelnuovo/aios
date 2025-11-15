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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant_id
    const { data: tenantUser } = await supabase
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single();

    if (!tenantUser) {
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenantUser.tenant_id;

    console.log('Starting sync for tenant:', tenantId);

    let clientsMatched = 0;
    let leadsMatched = 0;
    let processedSubscribers = new Set<string>();

    // Get all chat messages with raw_provider_data for this tenant
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('raw_provider_data')
      .eq('tenant_id', tenantId)
      .not('raw_provider_data', 'is', null);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    console.log(`Found ${messages?.length || 0} messages to process`);

    // Process each message to extract subscriber info
    for (const message of messages || []) {
      try {
        const providerData = message.raw_provider_data as any;
        const subscriber = providerData?.subscriber;
        
        if (!subscriber || !subscriber.id) continue;

        // Skip if already processed this subscriber
        if (processedSubscribers.has(subscriber.id)) continue;
        processedSubscribers.add(subscriber.id);

        // Extract phone from subscriber data
        let phone = subscriber.phone;
        
        // Try to find phone in various possible locations in the data
        if (!phone && subscriber.phone_number) {
          phone = subscriber.phone_number;
        }
        if (!phone && subscriber.whatsapp_phone_number) {
          phone = subscriber.whatsapp_phone_number;
        }

        if (!phone) {
          console.log(`No phone found for subscriber ${subscriber.id}`);
          continue;
        }

        // Normalize phone number (remove spaces, dashes, etc.)
        const normalizedPhone = phone.replace(/[\s\-\(\)+]/g, '');
        console.log(`Processing subscriber ${subscriber.id} with phone ${normalizedPhone}`);

        // First, try to match with existing clients by phone
        const { data: matchingClients } = await supabase
          .from('clients')
          .select('id, phone')
          .eq('tenant_id', tenantId)
          .not('phone', 'is', null);

        let clientMatched = false;
        for (const client of matchingClients || []) {
          const clientNormalizedPhone = client.phone?.replace(/[\s\-\(\)+]/g, '') || '';
          if (clientNormalizedPhone && (normalizedPhone.includes(clientNormalizedPhone) || clientNormalizedPhone.includes(normalizedPhone))) {
            // Update client with ManyChat subscriber ID if not already set
            const { data: existingClient } = await supabase
              .from('clients')
              .select('manychat_subscriber_id')
              .eq('id', client.id)
              .single();

            if (!existingClient?.manychat_subscriber_id) {
              const { error: updateError } = await supabase
                .from('clients')
                .update({ manychat_subscriber_id: subscriber.id })
                .eq('id', client.id);

              if (!updateError) {
                clientsMatched++;
                clientMatched = true;
                console.log(`✓ Matched client ${client.id} with subscriber ${subscriber.id}`);
                break;
              }
            } else {
              console.log(`Client ${client.id} already has subscriber ID`);
              clientMatched = true;
              break;
            }
          }
        }

        // If no client match, try to match with leads
        if (!clientMatched) {
          const { data: matchingLeads } = await supabase
            .from('leads')
            .select('id, phone')
            .eq('tenant_id', tenantId)
            .not('phone', 'is', null);

          for (const lead of matchingLeads || []) {
            const leadNormalizedPhone = lead.phone?.replace(/[\s\-\(\)+]/g, '') || '';
            if (leadNormalizedPhone && (normalizedPhone.includes(leadNormalizedPhone) || leadNormalizedPhone.includes(normalizedPhone))) {
              leadsMatched++;
              console.log(`✓ Found matching lead ${lead.id} for subscriber ${subscriber.id} (not updating lead)`);
              break;
            }
          }
        }

      } catch (error) {
        console.error('Error processing message:', error);
      }
    }

    const totalSubscribers = processedSubscribers.size;
    const notMatched = totalSubscribers - clientsMatched - leadsMatched;

    console.log(`Sync completed: ${totalSubscribers} unique subscribers, ${clientsMatched} clients matched, ${leadsMatched} leads matched, ${notMatched} not matched`);

    return new Response(
      JSON.stringify({
        success: true,
        total: totalSubscribers,
        clientsMatched,
        leadsMatched,
        notMatched,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Sync failed', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
