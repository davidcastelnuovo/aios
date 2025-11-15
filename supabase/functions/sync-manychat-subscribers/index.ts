import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize phone number to digits only
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  // Convert 972 prefix to 0
  if (digits.startsWith('972')) {
    return '0' + digits.slice(3);
  }
  
  return digits;
}

// Get all phone variations for matching
function getPhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone);
  const variations = [normalized];
  
  // Add 972 version if starts with 0
  if (normalized.startsWith('0')) {
    variations.push('972' + normalized.slice(1));
  }
  
  return variations;
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

    console.log('User authenticated:', user.id);

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
        console.error('Membership check error:', membershipError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify tenant access' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!membership) {
        console.error('User not member of requested tenant:', user.id, requestedTenantId);
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
        console.error('Tenant lookup error:', tenantError);
        return new Response(
          JSON.stringify({ error: 'Failed to resolve tenant' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!resolvedTenantId) {
        console.error('No tenant found for user:', user.id);
        return new Response(
          JSON.stringify({ error: 'Tenant not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = resolvedTenantId;
    }

    console.log('Starting sync for tenant:', tenantId, 'User:', user.id);

    // Fetch all chat messages with raw_provider_data for this tenant
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id, client_id, raw_provider_data')
      .eq('tenant_id', tenantId)
      .not('raw_provider_data', 'is', null);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch messages' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found messages:', messages?.length || 0);

    // Track unique subscribers and processed subscriber IDs
    const subscribersMap = new Map<string, { phone: string; clientId: string }>();
    const processedSubscriberIds = new Set<string>();

    // Extract subscriber info from messages
    for (const message of messages || []) {
      try {
        const providerData = message.raw_provider_data as any;
        const subscriberId = providerData?.subscriber_id || providerData?.subscriberId;
        const phone = providerData?.phone || providerData?.contact?.phone;

        if (subscriberId && phone && !processedSubscriberIds.has(subscriberId)) {
          subscribersMap.set(subscriberId, {
            phone: normalizePhone(phone),
            clientId: message.client_id
          });
        }
      } catch (error) {
        console.error('Error parsing provider data for message:', message.id, error);
      }
    }

    console.log('Unique subscribers found:', subscribersMap.size);

    let clientsMatched = 0;
    let leadsMatched = 0;
    let notMatched = 0;

    // Process each subscriber
    for (const [subscriberId, info] of subscribersMap) {
      const phoneVariations = getPhoneVariations(info.phone);
      
      // Try to match with clients first
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, phone, manychat_subscriber_id')
        .eq('tenant_id', tenantId)
        .or(phoneVariations.map(p => `phone.eq.${p}`).join(','));

      if (clientsError) {
        console.error('Error querying clients:', clientsError);
        continue;
      }

      let matched = false;

      // Update clients that don't already have a subscriber_id
      for (const client of clients || []) {
        if (!client.manychat_subscriber_id) {
          const { error: updateError } = await supabase
            .from('clients')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', client.id);

          if (updateError) {
            console.error('Error updating client:', client.id, updateError);
          } else {
            console.log('Updated client:', client.id, 'with subscriber:', subscriberId);
            clientsMatched++;
            matched = true;
            processedSubscriberIds.add(subscriberId);
          }
        } else if (client.manychat_subscriber_id === subscriberId) {
          // Already has this subscriber ID
          matched = true;
          processedSubscriberIds.add(subscriberId);
        }
      }

      // If no client match, check leads for reporting only
      if (!matched) {
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, phone')
          .eq('tenant_id', tenantId)
          .or(phoneVariations.map(p => `phone.eq.${p}`).join(','))
          .limit(1);

        if (!leadsError && leads && leads.length > 0) {
          console.log('Found lead match for subscriber:', subscriberId);
          leadsMatched++;
          matched = true;
        }
      }

      if (!matched) {
        notMatched++;
      }
    }

    console.log('Sync completed - Clients:', clientsMatched, 'Leads:', leadsMatched, 'Not matched:', notMatched);

    return new Response(
      JSON.stringify({
        success: true,
        total: subscribersMap.size,
        clientsMatched,
        leadsMatched,
        notMatched
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
