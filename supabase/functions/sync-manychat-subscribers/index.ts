import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize phone number - remove ALL non-digit characters
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters including +, -, spaces, parentheses, etc.
  const digits = phone.replace(/\D/g, '');
  
  // Convert +972 or 972 prefix to 0
  if (digits.startsWith('972')) {
    return '0' + digits.slice(3);
  }
  
  return digits;
}

// Get comprehensive phone variations for matching
function getPhoneVariations(phone: string): string[] {
  if (!phone) return [];
  
  const normalized = normalizePhone(phone);
  const variations = new Set<string>();
  
  // Add normalized version
  variations.add(normalized);
  
  // Add original (cleaned)
  variations.add(phone.replace(/\s/g, ''));
  
  // Add 972 version if starts with 0
  if (normalized.startsWith('0')) {
    variations.add('972' + normalized.slice(1));
    variations.add('+972' + normalized.slice(1));
  }
  
  // Add with common formatting
  if (normalized.startsWith('0') && normalized.length >= 10) {
    const areaCode = normalized.slice(0, 3);
    const rest = normalized.slice(3);
    variations.add(`${areaCode}-${rest}`);
    variations.add(`${areaCode} ${rest}`);
  }
  
  return Array.from(variations);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body for tenantId
    const { tenantId: requestedTenantId } = await req.json().catch(() => ({}));

    // Create auth client to verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    // Create service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate tenant access
    let tenantId: string;
    
    if (requestedTenantId) {
      // Verify user belongs to requested tenant
      const { data: membership, error: membershipError } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', requestedTenantId)
        .maybeSingle();

      if (membershipError) {
        console.error('❌ Membership check error:', membershipError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify tenant access' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!membership) {
        console.error('❌ User not member of requested tenant:', user.id, requestedTenantId);
        return new Response(
          JSON.stringify({ error: 'Access denied to requested tenant' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = requestedTenantId;
    } else {
      // Fallback: get tenant using database function
      const { data: resolvedTenantId, error: tenantError } = await supabase
        .rpc('get_user_tenant_id', { _user_id: user.id });

      if (tenantError) {
        console.error('❌ Tenant lookup error:', tenantError);
        return new Response(
          JSON.stringify({ error: 'Failed to resolve tenant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!resolvedTenantId) {
        console.error('❌ Tenant not found for user:', user.id);
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = resolvedTenantId;
    }

    console.log('🔄 Starting sync for tenant:', tenantId, 'User:', user.id);

    // First, get all accessible agency IDs (owned + shared)
    const { data: ownedAgencies, error: ownedAgenciesError } = await supabase
      .from('agencies')
      .select('id')
      .eq('tenant_id', tenantId);

    if (ownedAgenciesError) {
      console.error('❌ Error fetching owned agencies:', ownedAgenciesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch agencies' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sharedAgencies, error: sharedAgenciesError } = await supabase
      .from('agency_tenant_access')
      .select('agency_id')
      .eq('accessing_tenant_id', tenantId);

    if (sharedAgenciesError) {
      console.error('❌ Error fetching shared agencies:', sharedAgenciesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch shared agencies' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine owned and shared agency IDs
    const allAgencyIds = [
      ...(ownedAgencies || []).map(a => a.id),
      ...(sharedAgencies || []).map(a => a.agency_id)
    ];

    console.log(`🏢 Found ${allAgencyIds.length} accessible agencies (${ownedAgencies?.length || 0} owned, ${sharedAgencies?.length || 0} shared)`);

    // Fetch all clients from accessible agencies
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, phone, manychat_subscriber_id, tenant_id, agency_id, name')
      .in('agency_id', allAgencyIds.length > 0 ? allAgencyIds : ['00000000-0000-0000-0000-000000000000']); // Use dummy UUID if no agencies

    if (clientsError) {
      console.error('❌ Error fetching clients:', clientsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch clients' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${clients?.length || 0} total clients`);
    const clientsNeedingSync = clients?.filter(c => !c.manychat_subscriber_id) || [];
    console.log(`🔍 ${clientsNeedingSync.length} clients need ManyChat sync`);

    // Fetch all chat messages with subscriber data
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, client_id, raw_provider_data, tenant_id')
      .not('raw_provider_data', 'is', null);

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`💬 Found ${messages?.length || 0} chat messages with subscriber data`);

    // Build subscriber map from messages
    const subscribersMap = new Map<string, { phone: string; subscriberId: string }>();
    
    for (const message of messages || []) {
      try {
        const providerData = message.raw_provider_data as any;
        // Extract subscriber ID from ManyChat structure
        const subscriberId = providerData?.subscriber?.id || providerData?.subscriber_id || providerData?.subscriberId;
        let phone = providerData?.phone || providerData?.contact?.phone || providerData?.subscriber?.phone;

        // If phone is a template placeholder, try to use subscriber.id as phone
        if (!phone || phone.startsWith('{{') || phone === '') {
          const possiblePhone = providerData?.subscriber?.id;
          // Check if ID looks like a phone number (starts with 972 or 05)
          if (possiblePhone && (possiblePhone.startsWith('972') || possiblePhone.startsWith('05'))) {
            phone = possiblePhone;
            console.log(`📱 Using subscriber.id as phone: ${possiblePhone}`);
          }
        }

        if (subscriberId && phone && !phone.startsWith('{{')) {
          const normalizedPhone = normalizePhone(phone);
          if (normalizedPhone && !subscribersMap.has(normalizedPhone)) {
            subscribersMap.set(normalizedPhone, { phone, subscriberId });
            console.log(`👤 Subscriber: ${subscriberId}, Phone: ${phone} → ${normalizedPhone}`);
          }
        }
      } catch (error) {
        console.error('⚠️ Error parsing provider data for message:', message.id, error);
      }
    }

    console.log(`📊 Unique ManyChat subscribers: ${subscribersMap.size}`);

    let clientsMatched = 0;
    let notMatched = 0;
    let alreadySynced = 0;

    // Match clients with subscribers
    for (const client of clientsNeedingSync) {
      if (!client.phone) {
        console.log(`⏭️ Client ${client.name} (${client.id}) has no phone`);
        continue;
      }

      const normalizedClientPhone = normalizePhone(client.phone);
      const phoneVariations = getPhoneVariations(client.phone);
      
      console.log(`🔎 Checking client: ${client.name}, Phone: ${client.phone} → ${normalizedClientPhone}`);
      console.log(`   Variations: ${phoneVariations.join(', ')}`);

      let matched = false;
      
      // Check each phone variation against subscribers
      for (const variation of phoneVariations) {
        const normalizedVariation = normalizePhone(variation);
        if (subscribersMap.has(normalizedVariation)) {
          const subscriber = subscribersMap.get(normalizedVariation)!;
          
          console.log(`   ✅ MATCH! Subscriber: ${subscriber.subscriberId}`);
          
          // Update client with subscriber ID
          const { error: updateError } = await supabase
            .from('clients')
            .update({ manychat_subscriber_id: subscriber.subscriberId })
            .eq('id', client.id);

          if (updateError) {
            console.error(`   ❌ Failed to update client ${client.id}:`, updateError);
          } else {
            console.log(`   ✅ Updated client ${client.name} with subscriber ${subscriber.subscriberId}`);
            clientsMatched++;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        console.log(`   ❌ No match found for ${client.name}`);
        
        // Check if this client exists as a lead
        const { data: leads } = await supabase
          .from('leads')
          .select('id, phone')
          .or(phoneVariations.map(v => `phone.eq.${v}`).join(','))
          .limit(1);

        if (leads && leads.length > 0) {
          console.log(`   ℹ️ Found matching lead: ${leads[0].id}`);
        } else {
          notMatched++;
        }
      }
    }

    // Count clients that were already synced
    alreadySynced = (clients?.filter(c => c.manychat_subscriber_id).length || 0);

    // ===== SYNC LEADS =====
    console.log('\n🔄 Starting LEADS synchronization...');
    let leadsMatched = 0;

    const { data: leadsNeedingSync, error: leadsError } = await supabase
      .from('leads')
      .select('id, company_name, phone, tenant_id')
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null);

    if (leadsError) {
      console.error('❌ Error fetching leads:', leadsError);
    } else {
      console.log(`🔍 ${leadsNeedingSync?.length || 0} leads need ManyChat sync`);
      
      for (const lead of leadsNeedingSync || []) {
        if (!lead.phone) continue;
        
        const normalizedLeadPhone = normalizePhone(lead.phone);
        const phoneVariations = getPhoneVariations(lead.phone);
        
        console.log(`🔎 Checking lead: ${lead.company_name}, Phone: ${lead.phone}`);
        
        let matched = false;
        for (const variation of phoneVariations) {
          const normalizedVariation = normalizePhone(variation);
          if (subscribersMap.has(normalizedVariation)) {
            const subscriber = subscribersMap.get(normalizedVariation)!;
            
            const { error: updateError } = await supabase
              .from('leads')
              .update({ manychat_subscriber_id: subscriber.subscriberId })
              .eq('id', lead.id);
            
            if (updateError) {
              console.error(`❌ Failed to update lead ${lead.id}:`, updateError);
            } else {
              console.log(`✅ Updated lead ${lead.company_name} with subscriber ${subscriber.subscriberId}`);
              leadsMatched++;
              matched = true;
            }
            break;
          }
        }
        
        if (!matched) {
          console.log(`   ❌ No match found for lead ${lead.company_name}`);
        }
      }
    }

    console.log('\n=== Final Statistics ===');
    console.log(`Total clients checked: ${clientsNeedingSync?.length || 0}`);
    console.log(`✅ Clients matched: ${clientsMatched}`);
    console.log(`Total leads checked: ${leadsNeedingSync?.length || 0}`);
    console.log(`✅ Leads matched: ${leadsMatched}`);
    console.log(`❌ Not matched: ${notMatched}`);
    console.log(`⏭️ Already synced: ${alreadySynced}`);

    return new Response(JSON.stringify({ 
      success: true,
      clientsMatched,
      leadsMatched,
      notMatched,
      alreadySynced,
      totalClientsChecked: clientsNeedingSync?.length || 0,
      totalLeadsChecked: leadsNeedingSync?.length || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
