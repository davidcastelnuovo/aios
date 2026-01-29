import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Custom field name for phone number in ManyChat (must be created manually in ManyChat)
const PHONE_CUSTOM_FIELD_NAME = 'phone_number';

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

// Get Custom Field ID from ManyChat API
// This is required because findByCustomField needs field_id (numeric), not field_name
async function getPhoneNumberFieldId(apiKey: string, supabase: any, tenantId: string): Promise<number | null> {
  // First, try to get cached field_id from tenant_integrations.settings
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .single();

  const settings = integration?.settings || {};
  if (settings.phone_number_field_id) {
    console.log(`📋 Using cached field_id: ${settings.phone_number_field_id}`);
    return settings.phone_number_field_id;
  }

  // If not cached, fetch from ManyChat API
  console.log('🔍 Fetching custom fields from ManyChat API...');
  try {
    const res = await fetch('https://api.manychat.com/fb/page/getCustomFields', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await safeJson(res);
    console.log('📋 ManyChat custom fields response:', JSON.stringify(data));

    if (data?.status === 'success' && Array.isArray(data?.data)) {
      // Find the phone_number field
      const phoneField = data.data.find((field: any) => 
        field.name === PHONE_CUSTOM_FIELD_NAME || 
        field.name?.toLowerCase() === 'phone_number'
      );

      if (phoneField?.id) {
        const fieldId = parseInt(phoneField.id, 10);
        console.log(`✅ Found field_id for ${PHONE_CUSTOM_FIELD_NAME}: ${fieldId}`);

        // Cache the field_id in tenant_integrations.settings
        await supabase
          .from('tenant_integrations')
          .update({ 
            settings: { ...settings, phone_number_field_id: fieldId } 
          })
          .eq('tenant_id', tenantId)
          .eq('integration_type', 'manychat');

        console.log(`💾 Cached field_id in settings`);
        return fieldId;
      } else {
        console.log(`⚠️ Custom field "${PHONE_CUSTOM_FIELD_NAME}" not found in ManyChat. Please create it.`);
      }
    }
  } catch (e) {
    console.error('Error fetching custom fields:', e);
  }

  return null;
}

// Find subscriber by phone in ManyChat (SEQUENTIAL to avoid rate limits)
async function findSubscriberByPhone(apiKey: string, phoneCandidates: string[]): Promise<string | null> {
  for (const candidate of phoneCandidates) {
    try {
      const url = `https://api.manychat.com/fb/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await safeJson(res);
      console.log(`📱 Find subscriber (phone=${candidate}) response:`, JSON.stringify(data));

      if (data?.status === 'success' && data?.data?.id) {
        return String(data.data.id);
      }
      
      // If rate limited, wait and continue
      if (res.status === 429 || data?.message?.includes('max rps')) {
        console.log('⏳ Rate limited, waiting 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`Error searching by phone ${candidate}:`, e);
    }
  }
  return null;
}

// Find subscriber by email in ManyChat
async function findSubscriberByEmail(apiKey: string, email?: string | null): Promise<string | null> {
  if (!email) return null;
  
  try {
    const url = `https://api.manychat.com/fb/subscriber/findBySystemField?email=${encodeURIComponent(email)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await safeJson(res);
    console.log(`📧 Find subscriber (email=${email}) response:`, JSON.stringify(data));

    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  } catch (e) {
    console.error(`Error searching by email:`, e);
  }
  return null;
}

// Find subscriber by Custom Field using field_id (NOT field_name!)
// This is the CORRECT way according to ManyChat API docs
async function findSubscriberByCustomField(
  apiKey: string, 
  fieldId: number, 
  phoneCandidates: string[]
): Promise<string | null> {
  for (const candidate of phoneCandidates) {
    try {
      // IMPORTANT: Use field_id (numeric) not field_name
      const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(candidate)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await safeJson(res);
      console.log(`🔍 Find subscriber by custom field (field_id=${fieldId}, value=${candidate}) response:`, JSON.stringify(data));

      if (data?.status === 'success' && data?.data?.id) {
        return String(data.data.id);
      }
      
      // If rate limited, wait and continue
      if (res.status === 429 || data?.message?.includes('max rps')) {
        console.log('⏳ Rate limited, waiting 2 seconds...');
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(`Error finding by custom field ${candidate}:`, e);
    }
  }
  return null;
}

// Set custom field value for a subscriber using field_name (this still works)
async function setPhoneCustomField(apiKey: string, subscriberId: string, phoneValue: string): Promise<boolean> {
  try {
    const url = 'https://api.manychat.com/fb/subscriber/setCustomFieldByName';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        field_name: PHONE_CUSTOM_FIELD_NAME,
        field_value: phoneValue,
      }),
    });

    const data = await safeJson(res);
    console.log(`📝 Set custom field (${PHONE_CUSTOM_FIELD_NAME}=${phoneValue}) response:`, JSON.stringify(data));

    return data?.status === 'success';
  } catch (e) {
    console.error('Error setting custom field:', e);
    return false;
  }
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

  // Some ManyChat accounts deny importing phone to system fields.
  // We first try with phone+whatsapp_phone, then retry without phone if needed.
  const payloadWithPhone: any = {
    first_name: firstName,
    last_name: lastName,
    phone: `+${formattedPhone}`,
    whatsapp_phone: `+${formattedPhone}`,
    email: lead.email || undefined,
    has_opt_in_sms: true,
    has_opt_in_email: !!lead.email,
    consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
  };

  let createRes = await fetch('https://api.manychat.com/fb/subscriber/createSubscriber', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payloadWithPhone),
  });

  let createData = await safeJson(createRes);
  console.log('🆕 Create subscriber response:', JSON.stringify(createData));

  const createStr = JSON.stringify(createData);
  if (createStr.includes('Permission denied to import phone')) {
    console.log('Retrying createSubscriber WITHOUT phone field due to permission restriction...');
    const payloadNoPhone: any = {
      first_name: firstName,
      last_name: lastName,
      whatsapp_phone: `+${formattedPhone}`,
      email: lead.email || undefined,
      has_opt_in_sms: true,
      has_opt_in_email: !!lead.email,
      consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
    };
    createRes = await fetch('https://api.manychat.com/fb/subscriber/createSubscriber', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payloadNoPhone),
    });
    createData = await safeJson(createRes);
    console.log('🆕 Create subscriber response (no phone):', JSON.stringify(createData));
  }

  if (createData.status === 'success' && createData.data?.id) {
    const subscriberId = String(createData.data.id);
    
    // IMPORTANT: Save phone to custom field for future lookups
    console.log(`📝 Saving phone to custom field for new subscriber ${subscriberId}...`);
    await setPhoneCustomField(apiKey, subscriberId, `+${formattedPhone}`);
    
    return { id: subscriberId };
  }

  return null;
}

// Add tag to subscriber
async function addTagToSubscriber(apiKey: string, subscriberId: string, tagId: number): Promise<boolean> {
  try {
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
  } catch (e) {
    console.error('Error adding tag:', e);
    return false;
  }
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
    const settings = integration.settings as { defaultTagId?: number; phone_number_field_id?: number } | null;
    const defaultTagId = settings?.defaultTagId || 79380109;

    const phoneCandidates = getPhoneLookupCandidates(lead.phone);
    const formattedPhone = formatPhoneForManyChat(lead.phone);
    const leadName = lead.contact_name || lead.company_name || 'Unknown';

    console.log(`📱 Searching for subscriber with phone candidates:`, phoneCandidates);

    // STEP 1: Try to find existing subscriber by phone (SEQUENTIAL)
    let subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
    let wasExisting = false;

    if (subscriberId) {
      wasExisting = true;
      console.log(`✅ Found existing subscriber by phone: ${subscriberId}`);
    }

    // STEP 2: Try to find by email
    if (!subscriberId) {
      subscriberId = await findSubscriberByEmail(apiKey, lead.email);
      if (subscriberId) {
        wasExisting = true;
        console.log(`✅ Found existing subscriber by email: ${subscriberId}`);
      }
    }

    // STEP 3: Try to find by Custom Field (phone_number) using field_id
    if (!subscriberId) {
      console.log(`🔍 Trying to find by custom field "${PHONE_CUSTOM_FIELD_NAME}"...`);
      
      // Get the field_id (cached or from API)
      const fieldId = await getPhoneNumberFieldId(apiKey, supabase, lead.tenant_id);
      
      if (fieldId) {
        const customFieldCandidates = [`+${formattedPhone}`, formattedPhone, ...phoneCandidates];
        subscriberId = await findSubscriberByCustomField(apiKey, fieldId, customFieldCandidates);
        if (subscriberId) {
          wasExisting = true;
          console.log(`✅ Found existing subscriber by custom field: ${subscriberId}`);
        }
      } else {
        console.log(`⚠️ Cannot search by custom field - field_id not found. Please create "${PHONE_CUSTOM_FIELD_NAME}" field in ManyChat.`);
      }
    }

    // STEP 4: If not found, create new subscriber
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

        // STEP 5: Add tag to trigger automation (only for new subscribers)
        console.log(`🏷️ Adding tag ${defaultTagId} to new subscriber...`);
        const tagAdded = await addTagToSubscriber(apiKey, subscriberId, defaultTagId);
        if (tagAdded) {
          console.log('✅ Tag added successfully');
        } else {
          console.log('⚠️ Failed to add tag, but subscriber was created');
        }
      } else {
        // If creation failed (e.g., "already exists" conflict), try lookup methods again
        console.log('⚠️ Create failed, retrying lookup methods with delay...');
        
        // Wait a bit to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));
        
        // Retry phone lookup
        subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
        
        // Retry email lookup
        if (!subscriberId) {
          subscriberId = await findSubscriberByEmail(apiKey, lead.email);
        }
        
        // Retry custom field lookup
        if (!subscriberId) {
          const fieldId = await getPhoneNumberFieldId(apiKey, supabase, lead.tenant_id);
          if (fieldId) {
            const customFieldCandidates = [`+${formattedPhone}`, formattedPhone, ...phoneCandidates];
            subscriberId = await findSubscriberByCustomField(apiKey, fieldId, customFieldCandidates);
          }
        }
        
        if (subscriberId) {
          wasExisting = true;
          console.log(`✅ Found subscriber after create conflict: ${subscriberId}`);
        }
      }
    }

    // STEP 6: Update lead with subscriber ID
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
      // Mark as NEEDS_MANUAL_LINK to indicate manual intervention is needed
      console.log('❌ Could not find or create subscriber, marking as NEEDS_MANUAL_LINK');
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: 'NEEDS_MANUAL_LINK' })
        .eq('id', lead.id);

      return new Response(
        JSON.stringify({ 
          message: 'Could not sync lead to ManyChat - requires manual linking in ManyChat', 
          synced: false,
          needs_manual_link: true
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
