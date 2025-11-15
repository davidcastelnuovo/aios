import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone normalization helper
function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

// Generate phone variations
function getPhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  
  const variations = [normalized];
  
  // Add version with 972 prefix
  if (normalized.startsWith('0')) {
    variations.push('972' + normalized.substring(1));
  }
  
  // Add version with +972 prefix
  if (normalized.startsWith('0')) {
    variations.push('+972' + normalized.substring(1));
  }
  
  // Add version with spaces
  if (normalized.startsWith('0') && normalized.length === 10) {
    variations.push(`${normalized.substring(0, 3)}-${normalized.substring(3, 6)}-${normalized.substring(6)}`);
  }
  
  return variations;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead_id } = await req.json();
    
    if (!lead_id) {
      console.error('Missing lead_id parameter');
      return new Response(
        JSON.stringify({ error: 'Missing lead_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔄 Auto-syncing lead:', lead_id);

    // Fetch the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, phone, company_name, tenant_id')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found', details: leadError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if lead has a phone number
    if (!lead.phone) {
      console.log('Lead has no phone number, skipping sync');
      return new Response(
        JSON.stringify({ message: 'Lead has no phone number', synced: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch chat messages to build subscriber map
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('raw_provider_data')
      .eq('tenant_id', lead.tenant_id)
      .not('raw_provider_data', 'is', null);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Error fetching messages', details: messagesError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build subscriber map by phone
    const subscriberMap = new Map<string, string>();
    
    if (messages) {
      for (const msg of messages) {
        const rawData = msg.raw_provider_data as any;
        if (rawData?.subscriber?.id) {
          let phone = rawData?.subscriber?.phone;
          
          // If phone is a template placeholder, try to use subscriber.id as phone
          if (!phone || phone.startsWith('{{') || phone === '') {
            const possiblePhone = rawData?.subscriber?.id;
            // Check if ID looks like a phone number (starts with 972 or 05)
            if (possiblePhone && (possiblePhone.startsWith('972') || possiblePhone.startsWith('05'))) {
              phone = possiblePhone;
              console.log(`📱 Using subscriber.id as phone: ${possiblePhone}`);
            }
          }
          
          if (phone && !phone.startsWith('{{')) {
            const normalizedPhone = normalizePhone(phone);
            if (normalizedPhone) {
              subscriberMap.set(normalizedPhone, rawData.subscriber.id);
            }
          }
        }
      }
    }

    console.log(`📱 Found ${subscriberMap.size} ManyChat subscribers`);

    // Try to match lead by phone
    const phoneVariations = getPhoneVariations(lead.phone);
    let matchedSubscriberId: string | null = null;

    for (const variation of phoneVariations) {
      const normalized = normalizePhone(variation);
      if (subscriberMap.has(normalized)) {
        matchedSubscriberId = subscriberMap.get(normalized)!;
        console.log(`✅ Matched lead ${lead.company_name} with subscriber ${matchedSubscriberId}`);
        break;
      }
    }

    // Update lead if match found
    if (matchedSubscriberId) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ manychat_subscriber_id: matchedSubscriberId })
        .eq('id', lead.id);

      if (updateError) {
        console.error('Error updating lead:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error updating lead', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('✅ Lead synced successfully');
      return new Response(
        JSON.stringify({ 
          message: 'Lead synced successfully', 
          synced: true,
          lead_id: lead.id,
          subscriber_id: matchedSubscriberId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('❌ No match found for lead');
      return new Response(
        JSON.stringify({ 
          message: 'No ManyChat subscriber found for this phone number', 
          synced: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Auto-sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
