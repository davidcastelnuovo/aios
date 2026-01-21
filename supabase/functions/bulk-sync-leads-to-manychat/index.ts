import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Handle Israeli numbers
  if (cleaned.startsWith('972')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  return cleaned;
}

function formatPhoneForManyChat(phone: string): string {
  const cleaned = normalizePhone(phone);
  // ManyChat expects 972 format for Israeli numbers (without +)
  return `972${cleaned}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parameters from request - now processing ONE lead at a time
    const { tenantId, tagId = 79380109 } = await req.json();
    
    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ManyChat API key from tenant_integrations
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not found', details: integrationError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.is_active) {
      return new Response(
        JSON.stringify({ error: 'ManyChat integration is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = integration.api_key;

    // Fetch ONE lead without manychat_subscriber_id
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, phone, email, company_name')
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null)
      .limit(1);

    if (leadsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads', details: leadsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leads || leads.length === 0) {
      // Count remaining to confirm we're done
      const { count: remainingCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null)
        .not('phone', 'is', null);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No leads to sync',
          processed: 0,
          remaining: remainingCount || 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = leads[0];
    const formattedPhone = formatPhoneForManyChat(lead.phone);
    const displayName = lead.contact_name || lead.company_name || 'Unknown';
    
    console.log(`Processing lead ${lead.id}: ${displayName}, phone: ${formattedPhone}`);

    let subscriberId: string | null = null;
    let wasExisting = false;

    // Step 1: Try to find existing subscriber using getInfoByPhone (WhatsApp)
    try {
      const findRes = await fetch(`https://api.manychat.com/fb/subscriber/getInfoByPhone?phone=${formattedPhone}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const findData = await findRes.json();
      console.log('Find subscriber response:', JSON.stringify(findData));

      if (findData.status === 'success' && findData.data?.id) {
        subscriberId = findData.data.id;
        wasExisting = true;
        console.log(`Found existing subscriber: ${subscriberId}`);
      }
    } catch (findError) {
      console.log('Find subscriber failed, will try to create:', findError);
    }

    // Step 2: If not found, create new subscriber
    if (!subscriberId) {
      const nameParts = (lead.contact_name || '').split(' ');
      const firstName = nameParts[0] || lead.company_name || 'Lead';
      const lastName = nameParts.slice(1).join(' ') || '';

      const createRes = await fetch('https://api.manychat.com/fb/subscriber/createSubscriber', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: `+${formattedPhone}`,
          whatsapp_phone: `+${formattedPhone}`,
          has_opt_in_sms: true,
          has_opt_in_email: !!lead.email,
          consent_phrase: 'אני מאשר קבלת הודעות',
        }),
      });

      const createData = await createRes.json();
      console.log('Create subscriber response:', JSON.stringify(createData));

      if (createData.status === 'success' && createData.data?.id) {
        subscriberId = createData.data.id;
        console.log(`Created new subscriber: ${subscriberId}`);
      } else if (createData.details?.messages?.wa_id?.message?.[0]?.includes('already exists')) {
        // WhatsApp ID already exists - try to extract the ID from search again
        console.log('Subscriber already exists, trying alternative search...');
        
        // Try findBySystemField with whatsapp_phone
        const altFindRes = await fetch('https://api.manychat.com/fb/subscriber/findBySystemField', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field_name: 'phone',
            field_value: `+${formattedPhone}`,
          }),
        });

        const altFindData = await altFindRes.json();
        console.log('Alternative find response:', JSON.stringify(altFindData));

        if (altFindData.status === 'success' && altFindData.data?.id) {
          subscriberId = altFindData.data.id;
          wasExisting = true;
          console.log(`Found via alternative search: ${subscriberId}`);
        }
      }
      
      if (!subscriberId) {
        throw new Error(`Failed to get subscriber ID: ${JSON.stringify(createData)}`);
      }
    }

    // Step 3: Add tag to subscriber
    const tagRes = await fetch('https://api.manychat.com/fb/subscriber/addTag', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        tag_id: tagId,
      }),
    });

    const tagData = await tagRes.json();
    console.log('Add tag response:', JSON.stringify(tagData));

    // Step 4: Update lead in database with subscriber ID
    const { error: updateError } = await supabase
      .from('leads')
      .update({ manychat_subscriber_id: subscriberId })
      .eq('id', lead.id);

    if (updateError) {
      console.error(`Failed to update lead ${lead.id}:`, updateError);
    }

    // Count remaining leads
    const { count: remainingCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null);

    return new Response(
      JSON.stringify({
        success: true,
        processed: 1,
        failed: 0,
        remaining: remainingCount || 0,
        results: [{
          leadId: lead.id,
          leadName: displayName,
          success: true,
          subscriberId,
          wasExisting,
        }],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk sync error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        processed: 0,
        failed: 1,
        results: [{
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
