import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Phone normalization helper
function normalizePhone(phone: string): string {
  if (!phone) return '';
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

// Format phone for ManyChat API
function formatPhoneForManyChat(phone: string): string {
  const cleaned = normalizePhone(phone);
  return `972${cleaned}`;
}

// Generate phone variations for lookup
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

// Safe JSON parsing helper
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

// Find subscriber by phone in ManyChat
async function findSubscriberByPhone(apiKey: string, phoneCandidates: string[]): Promise<string | null> {
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
    console.log(`📱 Find subscriber (${candidate}) response:`, JSON.stringify(data));

    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

// Find subscriber by email in ManyChat
async function findSubscriberByEmail(apiKey: string, email?: string | null): Promise<string | null> {
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
  console.log(`📧 Find subscriber (email=${email}) response:`, JSON.stringify(data));

  if (data?.status === 'success' && data?.data?.id) {
    return String(data.data.id);
  }
  return null;
}

// Create new subscriber in ManyChat
async function createManyChatSubscriber(
  apiKey: string,
  lead: { contact_name?: string | null; company_name: string; phone: string; email?: string | null }
): Promise<{ id: string } | null> {
  const formattedPhone = formatPhoneForManyChat(lead.phone);
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
  console.log('🆕 Create subscriber response:', JSON.stringify(createData));

  if (createData.status === 'success' && createData.data?.id) {
    return { id: String(createData.data.id) };
  }

  return null;
}

// Add tag to subscriber
async function addTagToSubscriber(apiKey: string, subscriberId: string, tagId: number): Promise<boolean> {
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
  console.log('🏷️ Add tag response:', JSON.stringify(tagData));

  return tagData?.status === 'success';
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
      .select('id, phone, company_name, contact_name, email, tenant_id')
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

    // Fetch ManyChat integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active, settings')
      .eq('tenant_id', lead.tenant_id)
      .eq('integration_type', 'manychat')
      .single();

    if (integrationError || !integration) {
      console.log('ManyChat integration not found for tenant:', lead.tenant_id);
      return new Response(
        JSON.stringify({ message: 'ManyChat integration not configured', synced: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integration.is_active) {
      console.log('ManyChat integration is not active');
      return new Response(
        JSON.stringify({ message: 'ManyChat integration is not active', synced: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = integration.api_key;
    // Get default tag ID from settings or use default
    const settings = integration.settings as { defaultTagId?: number } | null;
    const defaultTagId = settings?.defaultTagId || 79380109;

    const phoneCandidates = getPhoneLookupCandidates(lead.phone);
    const leadName = lead.contact_name || lead.company_name || 'Unknown';

    console.log(`📱 Searching for subscriber with phone candidates:`, phoneCandidates);

    // Step 1: Try to find existing subscriber by phone
    let subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
    let wasExisting = false;

    if (subscriberId) {
      wasExisting = true;
      console.log(`✅ Found existing subscriber: ${subscriberId}`);
    } else {
      // Step 2: Try to find by email
      subscriberId = await findSubscriberByEmail(apiKey, lead.email);
      if (subscriberId) {
        wasExisting = true;
        console.log(`✅ Found existing subscriber by email: ${subscriberId}`);
      }
    }

    // Step 3: If not found, create new subscriber
    if (!subscriberId) {
      console.log('🆕 No existing subscriber found, creating new one...');
      const newSubscriber = await createManyChatSubscriber(apiKey, {
        contact_name: lead.contact_name,
        company_name: lead.company_name,
        phone: lead.phone,
        email: lead.email
      });

      if (newSubscriber?.id) {
        subscriberId = newSubscriber.id;
        console.log(`✅ Created new subscriber: ${subscriberId}`);

        // Step 4: Add tag to trigger automation (only for new subscribers)
        console.log(`🏷️ Adding tag ${defaultTagId} to new subscriber...`);
        const tagAdded = await addTagToSubscriber(apiKey, subscriberId, defaultTagId);
        if (tagAdded) {
          console.log('✅ Tag added successfully');
        } else {
          console.log('⚠️ Failed to add tag, but subscriber was created');
        }
      } else {
        // If creation failed, try lookup again (might be "already exists" conflict)
        console.log('⚠️ Create failed, retrying lookup...');
        subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
        if (!subscriberId) {
          subscriberId = await findSubscriberByEmail(apiKey, lead.email);
        }
        if (subscriberId) {
          wasExisting = true;
          console.log(`✅ Found subscriber after create conflict: ${subscriberId}`);
        }
      }
    }

    // Step 5: Update lead with subscriber ID
    if (subscriberId) {
      const { error: updateError } = await supabase
        .from('leads')
        .update({ manychat_subscriber_id: subscriberId })
        .eq('id', lead.id);

      if (updateError) {
        console.error('Error updating lead:', updateError);
        return new Response(
          JSON.stringify({ error: 'Error updating lead', details: updateError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`✅ Lead "${leadName}" synced successfully to ManyChat`);
      return new Response(
        JSON.stringify({ 
          message: 'Lead synced successfully', 
          synced: true,
          lead_id: lead.id,
          subscriber_id: subscriberId,
          was_existing: wasExisting
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Mark as SYNC_CONFLICT to avoid repeated attempts
      console.log('❌ Could not find or create subscriber, marking as SYNC_CONFLICT');
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: 'SYNC_CONFLICT' })
        .eq('id', lead.id);

      return new Response(
        JSON.stringify({ 
          message: 'Could not sync lead to ManyChat - marked as conflict', 
          synced: false,
          conflict: true
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
