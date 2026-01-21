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
  // Default canonical form for lookups
  return `972${cleaned}`;
}

function getPhoneLookupCandidates(phone: string): string[] {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];

  const withCountry = `972${cleaned}`;
  return [
    `+${withCountry}`,
    withCountry,
    `0${cleaned}`,
    cleaned,
  ].filter(Boolean);
}

function getWaIdCandidates(phone: string): string[] {
  const cleaned = normalizePhone(phone);
  if (!cleaned) return [];
  // ManyChat wa_id errors show digits without '+'
  return [`972${cleaned}`, cleaned].filter(Boolean);
}

async function safeJson(res: Response): Promise<any> {
  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  if (!contentType.includes('application/json')) {
    return { __nonJson: true, status: res.status, text: text.slice(0, 500) };
  }
  try {
    return JSON.parse(text);
  } catch (_e) {
    return { __parseError: true, status: res.status, text: text.slice(0, 500) };
  }
}

async function findSubscriberIdByPhone(apiKey: string, phoneCandidates: string[]): Promise<string | null> {
  for (const candidate of phoneCandidates) {
    const url = `https://api.manychat.com/fb/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await safeJson(res);
    console.log(`Find subscriber (${candidate}) response:`, JSON.stringify(data));

    // Expected: { status: 'success', data: { id: ... } }
    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

async function findSubscriberIdByWaId(apiKey: string, waIdCandidates: string[]): Promise<string | null> {
  for (const candidate of waIdCandidates) {
    const url = `https://api.manychat.com/fb/subscriber/findBySystemField?wa_id=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await safeJson(res);
    console.log(`Find subscriber wa_id (${candidate}) response:`, JSON.stringify(data));

    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
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
    // Keep compatibility with previous payload shape
    const { tenantId, tagId = 79380109, delayMs = 10000 } = await req.json();
    
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
    const phoneCandidates = getPhoneLookupCandidates(lead.phone);
    const waIdCandidates = getWaIdCandidates(lead.phone);
    const displayName = lead.contact_name || lead.company_name || 'Unknown';
    
    console.log(`Processing lead ${lead.id}: ${displayName}, phone: ${formattedPhone}`);

    let subscriberId: string | null = null;
    let wasExisting = false;

    // Step 1: Try to find existing subscriber by wa_id first (WhatsApp), then by phone
    subscriberId = await findSubscriberIdByWaId(apiKey, waIdCandidates);
    if (!subscriberId) {
      subscriberId = await findSubscriberIdByPhone(apiKey, phoneCandidates);
    }
    if (subscriberId) {
      wasExisting = true;
      console.log(`Found existing subscriber: ${subscriberId}`);
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
          // For WhatsApp channel use wa_id (digits). Avoid importing phone/email (permission issue).
          wa_id: waIdCandidates[0] || formattedPhone,
        }),
      });

      const createData = await safeJson(createRes);
      console.log('Create subscriber response:', JSON.stringify(createData));

      if (createData.status === 'success' && createData.data?.id) {
        subscriberId = createData.data.id;
        console.log(`Created new subscriber: ${subscriberId}`);
      } else {
        // If creation failed because subscriber already exists, do a lookup again and continue
        const waAlreadyExists =
          String(createData?.details?.messages?.wa_id?.message?.[0] || '').includes('already exists') ||
          String(createData?.details?.messages?.phone?.message?.[0] || '').includes('already exists');

        if (waAlreadyExists) {
          console.log('Subscriber already exists according to createSubscriber, retrying lookup...');
          subscriberId = await findSubscriberIdByWaId(apiKey, waIdCandidates);
          if (!subscriberId) {
            subscriberId = await findSubscriberIdByPhone(apiKey, phoneCandidates);
          }
          if (subscriberId) {
            wasExisting = true;
            console.log(`Found after create conflict: ${subscriberId}`);
          }
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

    const tagData = await safeJson(tagRes);
    console.log('Add tag response:', JSON.stringify(tagData));

    if (tagData?.status !== 'success') {
      throw new Error(`Failed to add tag: ${JSON.stringify(tagData)}`);
    }

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

    // Throttle next call to avoid ManyChat rate limits (only if there is more work)
    if ((remainingCount || 0) > 0 && delayMs > 0) {
      console.log(`Throttling next call: waiting ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

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

    // Basic throttle on error to avoid hammering ManyChat
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
        processed: 0,
        failed: 1,
        results: [{
          leadId: null,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }]
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
