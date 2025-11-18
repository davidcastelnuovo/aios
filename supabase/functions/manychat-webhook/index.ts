import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone normalization helper
function normalizePhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[\s\-\(\)\+]/g, '');
}

// Generate phone variations for matching
function getPhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variations = new Set<string>();
  
  variations.add(normalized);
  
  // If starts with 972, add 0 prefix version
  if (normalized.startsWith('972')) {
    variations.add('0' + normalized.slice(3));
  }
  
  // If starts with 0, add 972 version
  if (normalized.startsWith('0')) {
    variations.add('972' + normalized.slice(1));
  }
  
  // Add +972 versions
  if (normalized.startsWith('972')) {
    variations.add('+' + normalized);
  }
  
  return Array.from(variations);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Webhook received - Method:', req.method);
    console.log('📋 Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body text first
    const bodyText = await req.text();
    console.log('📄 Raw body:', bodyText);
    
    // Try to parse as JSON
    let payload;
    try {
      payload = JSON.parse(bodyText);
      console.log('✅ Parsed payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON', 
          received: bodyText.substring(0, 100),
          parseError: parseError instanceof Error ? parseError.message : 'Unknown error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { subscriber, message, channel, event_type, type } = payload;

    // Determine if this is an inbound or outbound message
    const eventType = event_type || type || 'message_received';
    const isOutbound = ['message_sent', 'agent_reply', 'bot_reply', 'template_sent', 'automation_sent'].includes(eventType);
    
    console.log('📨 Event type:', eventType, '| Direction:', isOutbound ? 'outbound' : 'inbound');

    if (!subscriber || !subscriber.id) {
      console.error('Invalid payload: missing subscriber.id');
      return new Response(
        JSON.stringify({ error: 'Invalid payload: missing subscriber.id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let client = null;

    // Try to find client by manychat_subscriber_id first
    console.log('🔍 Looking for client with subscriber_id:', subscriber.id);
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, tenant_id, name, phone')
      .eq('manychat_subscriber_id', subscriber.id)
      .maybeSingle();

    if (existingClient) {
      console.log('✅ Found existing client by subscriber_id:', existingClient.name);
      client = existingClient;
    } else {
      // Not found by subscriber_id, try to find by phone
      console.log('🔍 Client not found by subscriber_id, trying phone matching...');
      
      const phone = subscriber.full_contact?.whatsapp_phone || 
                    subscriber.whatsapp_phone || 
                    subscriber.phone || 
                    payload.phone;
      
      if (phone) {
        const phoneVariations = getPhoneVariations(phone);
        console.log('📱 Generated phone variations:', phoneVariations);
        
        // Build OR query for all phone variations
        const phoneQuery = phoneVariations.map(p => `phone.eq.${p}`).join(',');
        
        // Try to find client by phone (without existing manychat_subscriber_id)
        const { data: clientByPhone } = await supabase
          .from('clients')
          .select('id, tenant_id, name, phone')
          .or(phoneQuery)
          .is('manychat_subscriber_id', null)
          .limit(1)
          .maybeSingle();
        
        if (clientByPhone) {
          console.log('✅ Found client by phone:', clientByPhone.name, '- Updating subscriber_id');
          
          // Update the manychat_subscriber_id
          const { error: updateError } = await supabase
            .from('clients')
            .update({ manychat_subscriber_id: subscriber.id })
            .eq('id', clientByPhone.id);
          
          if (updateError) {
            console.error('❌ Error updating client subscriber_id:', updateError);
          } else {
            console.log('✅ Successfully updated client with subscriber_id');
          }
          
          client = clientByPhone;
        } else {
          // Try to find lead by phone
          console.log('🔍 Client not found, trying leads...');
          const { data: leadByPhone } = await supabase
            .from('leads')
            .select('id, tenant_id, company_name, phone')
            .or(phoneQuery)
            .is('manychat_subscriber_id', null)
            .limit(1)
            .maybeSingle();
          
          if (leadByPhone) {
            console.log('✅ Found lead by phone:', leadByPhone.company_name, '- Updating subscriber_id');
            
            // Update the manychat_subscriber_id
            const { error: updateError } = await supabase
              .from('leads')
              .update({ manychat_subscriber_id: subscriber.id })
              .eq('id', leadByPhone.id);
            
            if (updateError) {
              console.error('❌ Error updating lead subscriber_id:', updateError);
            } else {
              console.log('✅ Successfully updated lead with subscriber_id');
            }
          }
        }
      } else {
        console.warn('⚠️ No phone number found in payload');
      }
    }

    if (!client) {
      console.error('❌ No client or lead found for subscriber:', subscriber.id);
      return new Response(
        JSON.stringify({ 
          error: 'Contact not found', 
          received: true,
          note: 'Make sure the contact exists with a matching phone number'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract message text
    let messageText = '';
    if (message && message.text) {
      messageText = message.text;
    } else if (message && message.type) {
      messageText = `[${message.type} message received]`;
    }

    // Save message with correct direction
    const { error: saveError } = await supabase
      .from('chat_messages')
      .insert({
        client_id: client.id,
        tenant_id: client.tenant_id,
        direction: isOutbound ? 'outbound' : 'inbound',
        message_text: messageText,
        channel: channel || 'whatsapp',
        provider: 'manychat',
        connection_user_id: client.id,
        raw_provider_data: payload,
      });

    if (saveError) {
      console.error('Error saving message:', saveError);
      return new Response(
        JSON.stringify({ error: 'Failed to save message', details: saveError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`${isOutbound ? 'Outbound' : 'Inbound'} message saved for client ${client.name} (${client.id})`);

    return new Response(
      JSON.stringify({ received: true, direction: isOutbound ? 'outbound' : 'inbound' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('ManyChat webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
