import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to normalize phone numbers
function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Israeli phone numbers
  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('+972')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.length === 9 && !cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  
  return cleaned;
}

// Generate phone number variations for matching
function getPhoneVariations(phone: string): string[] {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];
  
  const variations = [
    normalized,
    normalized.replace(/^0/, '972'),
    '+972' + normalized.substring(1),
    normalized.replace(/^0/, ''),
  ];
  
  return [...new Set(variations)];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Import initiated by user:', user.id);

    // Get request body
    const { tenantId } = await req.json();

    if (!tenantId) {
      throw new Error('Missing tenantId');
    }

    // Verify user has access to this tenant
    const { data: tenantUsers, error: tenantError } = await supabase
      .from('tenant_users')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id);

    if (tenantError || !tenantUsers || tenantUsers.length === 0) {
      throw new Error('No access to this tenant');
    }

    console.log('User has access to tenant:', tenantId);

    // Get ManyChat API key
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .eq('is_active', true)
      .single();

    if (integrationError || !integration?.api_key) {
      throw new Error('ManyChat integration not configured or inactive');
    }

    console.log('Fetching subscribers from ManyChat API...');

    // Fetch all subscribers from ManyChat API
    const manychatResponse = await fetch('https://api.manychat.com/fb/subscriber/getSubscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${integration.api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        count: 1000, // Maximum allowed per request
      }),
    });

    if (!manychatResponse.ok) {
      const errorText = await manychatResponse.text();
      console.error('ManyChat API error:', errorText);
      throw new Error(`Failed to fetch subscribers from ManyChat: ${manychatResponse.status}`);
    }

    const manychatData = await manychatResponse.json();
    console.log('Received subscribers from ManyChat:', manychatData.data?.length || 0);

    // Build a map of phone numbers to subscriber IDs
    const phoneToSubscriber = new Map<string, string>();
    
    if (manychatData.data && Array.isArray(manychatData.data)) {
      for (const subscriber of manychatData.data) {
        const phone = subscriber.phone || subscriber.whatsapp_phone;
        if (phone) {
          const variations = getPhoneVariations(phone);
          for (const variation of variations) {
            if (variation) {
              phoneToSubscriber.set(variation, subscriber.id);
            }
          }
        }
      }
    }

    console.log('Built phone map with', phoneToSubscriber.size, 'variations');

    // Get accessible agencies for this user
    const { data: userAgencies } = await supabase
      .rpc('get_user_agency_ids', { _user_id: user.id });

    const agencyIds = userAgencies || [];

    if (agencyIds.length === 0) {
      throw new Error('No accessible agencies found');
    }

    // Fetch all clients in accessible agencies
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, phone, manychat_subscriber_id')
      .in('agency_id', agencyIds)
      .eq('tenant_id', tenantId);

    if (clientsError) {
      console.error('Error fetching clients:', clientsError);
      throw clientsError;
    }

    console.log('Fetched clients:', clients?.length || 0);

    // Fetch all leads in accessible agencies
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, phone, manychat_subscriber_id')
      .in('agency_id', agencyIds)
      .eq('tenant_id', tenantId);

    if (leadsError) {
      console.error('Error fetching leads:', leadsError);
      throw leadsError;
    }

    console.log('Fetched leads:', leads?.length || 0);

    // Match and update clients
    let clientsMatched = 0;
    const clientUpdates = [];

    for (const client of clients || []) {
      if (!client.phone || client.manychat_subscriber_id) {
        continue; // Skip if no phone or already has subscriber ID
      }

      const variations = getPhoneVariations(client.phone);
      let matchedSubscriberId = null;

      for (const variation of variations) {
        if (phoneToSubscriber.has(variation)) {
          matchedSubscriberId = phoneToSubscriber.get(variation);
          break;
        }
      }

      if (matchedSubscriberId) {
        clientUpdates.push({
          id: client.id,
          manychat_subscriber_id: matchedSubscriberId,
        });
        clientsMatched++;
      }
    }

    // Update clients in batch
    if (clientUpdates.length > 0) {
      for (const update of clientUpdates) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ manychat_subscriber_id: update.manychat_subscriber_id })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating client:', update.id, updateError);
        }
      }
    }

    console.log('Updated clients:', clientsMatched);

    // Match and update leads
    let leadsMatched = 0;
    const leadUpdates = [];

    for (const lead of leads || []) {
      if (!lead.phone || lead.manychat_subscriber_id) {
        continue; // Skip if no phone or already has subscriber ID
      }

      const variations = getPhoneVariations(lead.phone);
      let matchedSubscriberId = null;

      for (const variation of variations) {
        if (phoneToSubscriber.has(variation)) {
          matchedSubscriberId = phoneToSubscriber.get(variation);
          break;
        }
      }

      if (matchedSubscriberId) {
        leadUpdates.push({
          id: lead.id,
          manychat_subscriber_id: matchedSubscriberId,
        });
        leadsMatched++;
      }
    }

    // Update leads in batch
    if (leadUpdates.length > 0) {
      for (const update of leadUpdates) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ manychat_subscriber_id: update.manychat_subscriber_id })
          .eq('id', update.id);

        if (updateError) {
          console.error('Error updating lead:', update.id, updateError);
        }
      }
    }

    console.log('Updated leads:', leadsMatched);

    const totalClients = clients?.length || 0;
    const totalLeads = leads?.length || 0;
    const totalSubscribers = manychatData.data?.length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        total_subscribers: totalSubscribers,
        total_clients: totalClients,
        total_leads: totalLeads,
        clients_matched: clientsMatched,
        leads_matched: leadsMatched,
        clients_unmatched: totalClients - clientsMatched,
        leads_unmatched: totalLeads - leadsMatched,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in import-manychat-subscribers:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
