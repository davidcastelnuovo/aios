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

async function findSubscriberIdByEmail(apiKey: string, email?: string | null): Promise<string | null> {
  if (!email) return null;
  const url = `https://api.manychat.com/fb/subscriber/findBySystemField?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  const data = await safeJson(res);
  console.log(`Find subscriber (email=${email}) response:`, JSON.stringify(data));

  if (data?.status === 'success' && data?.data?.id) {
    return String(data.data.id);
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Track result for this lead
  let leadId: string | null = null;
  let leadName = 'Unknown';
  let errorMessage: string | null = null;
  let wasSkipped = false;
  let subscriberId: string | null = null;
  let wasExisting = false;

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

    // Fetch ONE lead without manychat_subscriber_id (excluding SYNC_CONFLICT)
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
          failed: 0,
          remaining: remainingCount || 0,
          results: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const lead = leads[0];
    leadId = lead.id;
    const formattedPhone = formatPhoneForManyChat(lead.phone);
    const phoneCandidates = getPhoneLookupCandidates(lead.phone);
    leadName = lead.contact_name || lead.company_name || 'Unknown';
    
    console.log(`Processing lead ${lead.id}: ${leadName}, phone: ${formattedPhone}`);

    // Step 1: Try to find existing subscriber (phone first, then email)
    subscriberId = await findSubscriberIdByPhone(apiKey, phoneCandidates);
    if (!subscriberId) {
      subscriberId = await findSubscriberIdByEmail(apiKey, lead.email);
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
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          // IMPORTANT: Add BOTH phone and whatsapp_phone for reliable future lookups
          phone: `+${formattedPhone}`,
          whatsapp_phone: `+${formattedPhone}`,
          email: lead.email || undefined,
          has_opt_in_sms: true,
          has_opt_in_email: !!lead.email,
          consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
        }),
      });

      const createData = await safeJson(createRes);
      console.log('Create subscriber response:', JSON.stringify(createData));

      if (createData.status === 'success' && createData.data?.id) {
        subscriberId = createData.data.id;
        console.log(`Created new subscriber: ${subscriberId}`);
      } else {
        // If creation failed because subscriber already exists, try lookup again
        const alreadyExistsMsg = JSON.stringify(createData).toLowerCase();
        const waAlreadyExists = alreadyExistsMsg.includes('already exists');

        if (waAlreadyExists) {
          console.log('Subscriber already exists according to createSubscriber, retrying lookup...');
          subscriberId = await findSubscriberIdByPhone(apiKey, phoneCandidates);
          if (!subscriberId) subscriberId = await findSubscriberIdByEmail(apiKey, lead.email);
          if (subscriberId) {
            wasExisting = true;
            console.log(`Found after create conflict: ${subscriberId}`);
          }
        }
      }
      
      // SKIP & CONTINUE: If still no subscriber ID, mark as conflict and continue
      if (!subscriberId) {
        wasSkipped = true;
        errorMessage = `Could not find or create subscriber: ${JSON.stringify(createData)}`;
        console.log(`Skipping lead ${lead.id}: ${errorMessage}`);
        
        // Mark lead with special value so we don't keep trying it
        await supabase
          .from('leads')
          .update({ manychat_subscriber_id: 'SYNC_CONFLICT' })
          .eq('id', lead.id);
      }
    }

    // Step 3: Add tag to subscriber (only if we have a valid subscriber ID)
    if (subscriberId && !wasSkipped) {
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
        // Tag failed but we still have the subscriber - mark it anyway
        console.log(`Tag failed for ${subscriberId}, but continuing: ${JSON.stringify(tagData)}`);
      }

      // Step 4: Update lead in database with subscriber ID
      const { error: updateError } = await supabase
        .from('leads')
        .update({ manychat_subscriber_id: subscriberId })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`Failed to update lead ${lead.id}:`, updateError);
      }
    }

    // Count remaining leads (excluding SYNC_CONFLICT)
    const { count: remainingCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null);

    // Also count conflicts for reporting
    const { count: conflictCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('manychat_subscriber_id', 'SYNC_CONFLICT');

    // Throttle next call to avoid ManyChat rate limits (only if there is more work)
    if ((remainingCount || 0) > 0 && delayMs > 0) {
      console.log(`Throttling next call: waiting ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // ALWAYS return 200 with detailed results
    return new Response(
      JSON.stringify({
        success: true,
        processed: 1,
        failed: wasSkipped ? 1 : 0,
        remaining: remainingCount || 0,
        conflicts: conflictCount || 0,
        results: [{
          leadId: lead.id,
          leadName,
          success: !wasSkipped,
          subscriberId: wasSkipped ? null : subscriberId,
          wasExisting,
          skipped: wasSkipped,
          error: errorMessage,
        }],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Bulk sync error:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Basic throttle on error to avoid hammering ManyChat
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // ALWAYS return 200 so the sync loop continues
    return new Response(
      JSON.stringify({ 
        success: true, // The request succeeded, even if the lead failed
        processed: 1,
        failed: 1,
        remaining: -1, // Unknown due to error
        conflicts: 0,
        results: [{
          leadId,
          leadName,
          success: false,
          skipped: true,
          error: errorMessage,
        }]
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
