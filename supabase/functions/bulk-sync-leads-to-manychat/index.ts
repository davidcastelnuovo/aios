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
  // ManyChat expects +972 format for Israeli numbers
  return `+972${cleaned}`;
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

    // Get parameters from request
    const { tenantId, tagId = 79380109, batchSize = 5, delayMs = 10000 } = await req.json();
    
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

    // Fetch leads without manychat_subscriber_id
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, phone, email')
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null)
      .limit(batchSize);

    if (leadsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads', details: leadsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No leads to sync',
          processed: 0,
          remaining: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ leadId: string; success: boolean; error?: string; subscriberId?: string }> = [];
    let processedCount = 0;

    for (const lead of leads) {
      try {
        const formattedPhone = formatPhoneForManyChat(lead.phone);
        console.log(`Processing lead ${lead.id}: ${lead.contact_name}, phone: ${formattedPhone}`);

        // Step 1: Try to find existing subscriber by phone
        let subscriberId: string | null = null;
        
        const findRes = await fetch(`https://api.manychat.com/fb/subscriber/findBySystemField`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            field_name: 'whatsapp_phone',
            field_value: formattedPhone,
          }),
        });

        const findData = await findRes.json();
        console.log('Find subscriber response:', JSON.stringify(findData));

        if (findData.status === 'success' && findData.data?.id) {
          subscriberId = findData.data.id;
          console.log(`Found existing subscriber: ${subscriberId}`);
        } else {
          // Step 2: Create new subscriber
          const nameParts = (lead.contact_name || '').split(' ');
          const firstName = nameParts[0] || 'Lead';
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
              whatsapp_phone: formattedPhone,
              email: lead.email || undefined,
              has_opt_in_sms: true,
              has_opt_in_email: true,
              consent_phrase: 'אני מאשר קבלת הודעות',
            }),
          });

          const createData = await createRes.json();
          console.log('Create subscriber response:', JSON.stringify(createData));

          if (createData.status === 'success' && createData.data?.id) {
            subscriberId = createData.data.id;
            console.log(`Created new subscriber: ${subscriberId}`);
          } else {
            throw new Error(`Failed to create subscriber: ${JSON.stringify(createData)}`);
          }
        }

        if (!subscriberId) {
          throw new Error('No subscriber ID obtained');
        }

        // Step 3: Add tag
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

        // Step 4: Update lead in database
        const { error: updateError } = await supabase
          .from('leads')
          .update({ manychat_subscriber_id: subscriberId })
          .eq('id', lead.id);

        if (updateError) {
          console.error(`Failed to update lead ${lead.id}:`, updateError);
        }

        results.push({ 
          leadId: lead.id, 
          success: true, 
          subscriberId 
        });
        processedCount++;

        // Wait before next lead (except for last one)
        if (leads.indexOf(lead) < leads.length - 1) {
          console.log(`Waiting ${delayMs}ms before next lead...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

      } catch (error) {
        console.error(`Error processing lead ${lead.id}:`, error);
        results.push({ 
          leadId: lead.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
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
        processed: processedCount,
        failed: results.filter(r => !r.success).length,
        remaining: remainingCount || 0,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk sync error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
