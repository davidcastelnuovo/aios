import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Check if phone is international (non-Israeli)
function isInternationalPhone(phone: string): boolean {
  if (!phone) return false;
  const trimmed = phone.trim();
  // Starts with + and NOT +972
  if (trimmed.startsWith('+') && !trimmed.startsWith('+972')) return true;
  // Starts with 00 and NOT 00972
  if (trimmed.startsWith('00') && !trimmed.startsWith('00972')) return true;
  // Starts with country code that's not 972 (e.g., 44, 49, 43, 1)
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 10 && !digits.startsWith('972') && !digits.startsWith('0')) {
    // Could be international - check common country codes
    const intlPrefixes = ['1', '44', '49', '43', '33', '39', '34', '31', '32', '41', '61', '81', '86', '91'];
    for (const prefix of intlPrefixes) {
      if (digits.startsWith(prefix) && digits.length >= prefix.length + 8) return true;
    }
  }
  return false;
}

// Format international phone to E.164 (keep as-is but ensure + prefix)
function formatInternationalPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return trimmed.replace(/[^\d+]/g, ''); // Keep only digits and +
  }
  if (trimmed.startsWith('00')) {
    return '+' + trimmed.slice(2).replace(/\D/g, '');
  }
  // Already digits only
  return '+' + trimmed.replace(/\D/g, '');
}

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('972')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.slice(1);
  }
  
  return cleaned;
}

function formatPhoneForManyChat(phone: string): string {
  // Handle international phones - keep their original country code
  if (isInternationalPhone(phone)) {
    const formatted = formatInternationalPhone(phone);
    // Return without the + for ManyChat API (they add it)
    return formatted.startsWith('+') ? formatted.slice(1) : formatted;
  }
  // Israeli phone - normalize and add 972
  const cleaned = normalizePhone(phone);
  return `972${cleaned}`;
}

function getPhoneLookupCandidates(phone: string): string[] {
  // Handle international phones
  if (isInternationalPhone(phone)) {
    const formatted = formatInternationalPhone(phone);
    const withoutPlus = formatted.startsWith('+') ? formatted.slice(1) : formatted;
    return [formatted, withoutPlus].filter(Boolean);
  }
  
  // Israeli phone - generate all variants
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

// Helper: Get phone_number custom field ID from ManyChat or cache
async function getPhoneNumberFieldId(
  apiKey: string,
  supabase: any,
  tenantId: string
): Promise<number | null> {
  // First check if we have it cached in settings
  const { data: integration } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .single();

  const settings = (integration?.settings as Record<string, any>) || {};
  if (settings.phone_number_field_id) {
    return settings.phone_number_field_id;
  }

  // Fetch from ManyChat API
  const res = await fetch('https://api.manychat.com/fb/page/getCustomFields', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await safeJson(res);
  console.log('getCustomFields response:', JSON.stringify(data));

  if (data?.status === 'success' && Array.isArray(data?.data)) {
    const phoneField = data.data.find(
      (f: any) => f.name?.toLowerCase() === 'phone_number'
    );
    if (phoneField?.id) {
      // Cache it
      await supabase
        .from('tenant_integrations')
        .update({
          settings: { ...settings, phone_number_field_id: phoneField.id },
        })
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'manychat');

      return phoneField.id;
    }
  }
  return null;
}

// Sequential phone lookup to avoid rate limits
async function findSubscriberByPhone(apiKey: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const url = `https://api.manychat.com/fb/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // Handle rate limit
    if (res.status === 429) {
      console.log('Rate limited on phone lookup, waiting 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const data = await safeJson(res);
    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

async function findSubscriberByEmail(apiKey: string, email?: string | null): Promise<string | null> {
  if (!email) return null;
  const url = `https://api.manychat.com/fb/subscriber/findBySystemField?email=${encodeURIComponent(email)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 429) {
    console.log('Rate limited on email lookup, waiting 2s...');
    await new Promise((r) => setTimeout(r, 2000));
    return null;
  }

  const data = await safeJson(res);
  if (data?.status === 'success' && data?.data?.id) {
    return String(data.data.id);
  }
  return null;
}

async function findSubscriberByCustomField(
  apiKey: string,
  fieldId: number,
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 429) {
      console.log('Rate limited on custom field lookup, waiting 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const data = await safeJson(res);
    if (data?.status === 'success' && data?.data?.id) {
      return String(data.data.id);
    }
  }
  return null;
}

async function setCustomField(
  apiKey: string,
  subscriberId: string,
  fieldId: number,
  value: string
): Promise<boolean> {
  const res = await fetch('https://api.manychat.com/fb/subscriber/setCustomField', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subscriber_id: subscriberId,
      field_id: fieldId,
      field_value: value,
    }),
  });

  const data = await safeJson(res);
  console.log('setCustomField response:', JSON.stringify(data));
  return data?.status === 'success';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let leadId: string | null = null;
  let leadName = 'Unknown';
  let errorMessage: string | null = null;
  let wasSkipped = false;
  let subscriberId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { tenantId, tagId = 79380109, resetFirst = false, delayMs = 10000 } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If resetFirst is true, reset all IDs for this tenant first
    if (resetFirst) {
      console.log('Resetting all manychat_subscriber_id for tenant', tenantId);
      const { error: resetError } = await supabase
        .from('leads')
        .update({ manychat_subscriber_id: null })
        .eq('tenant_id', tenantId);

      if (resetError) {
        console.error('Reset error:', resetError);
      }
    }

    // Get ManyChat integration
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active, settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manychat')
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'ManyChat integration not found' }),
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

    // Get phone_number field ID
    const phoneFieldId = await getPhoneNumberFieldId(apiKey, supabase, tenantId);
    console.log('Using phone_number field ID:', phoneFieldId);

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
      const { count: remainingCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null)
        .not('phone', 'is', null);

      const { count: conflictCount } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('manychat_subscriber_id', 'SYNC_CONFLICT');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No leads to sync',
          processed: 0,
          failed: 0,
          remaining: remainingCount || 0,
          conflicts: conflictCount || 0,
          results: [],
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

    // Step 1: Try to find existing subscriber (sequential to avoid rate limits)
    // 1a. By phone system field
    subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);

    // 1b. By email system field
    if (!subscriberId) {
      subscriberId = await findSubscriberByEmail(apiKey, lead.email);
    }

    // 1c. By custom field phone_number (with field_id)
    if (!subscriberId && phoneFieldId) {
      subscriberId = await findSubscriberByCustomField(apiKey, phoneFieldId, phoneCandidates);
    }

    // Step 2: Create if not found
    if (!subscriberId) {
      const nameParts = (lead.contact_name || '').split(' ');
      const firstName = nameParts[0] || lead.company_name || 'Lead';
      const lastName = nameParts.slice(1).join(' ') || '';

      const createRes = await fetch('https://api.manychat.com/fb/subscriber/createSubscriber', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: `+${formattedPhone}`,
          whatsapp_phone: `+${formattedPhone}`,
          email: lead.email || undefined,
          has_opt_in_sms: true,
          has_opt_in_email: !!lead.email,
          consent_phrase: 'אני מאשר קבלת הודעות',
        }),
      });

      const createData = await safeJson(createRes);
      console.log('Create subscriber response:', JSON.stringify(createData));

      if (createData.status === 'success' && createData.data?.id) {
        subscriberId = createData.data.id;
      } else if (JSON.stringify(createData).toLowerCase().includes('already exists')) {
        // Retry lookups
        subscriberId = await findSubscriberByPhone(apiKey, phoneCandidates);
        if (!subscriberId) subscriberId = await findSubscriberByEmail(apiKey, lead.email);
        if (!subscriberId && phoneFieldId) {
          subscriberId = await findSubscriberByCustomField(apiKey, phoneFieldId, phoneCandidates);
        }
      }

      if (!subscriberId) {
        wasSkipped = true;
        errorMessage = `Could not create/find subscriber: ${JSON.stringify(createData)}`;
        console.log(`Skipping lead ${lead.id}: ${errorMessage}`);

        await supabase
          .from('leads')
          .update({ manychat_subscriber_id: 'SYNC_CONFLICT' })
          .eq('id', lead.id);
      }
    }

    // Step 3: Set custom field phone_number for future lookups
    if (subscriberId && !wasSkipped && phoneFieldId) {
      await setCustomField(apiKey, subscriberId, phoneFieldId, `+${formattedPhone}`);
    }

    // Step 4: Add tag
    if (subscriberId && !wasSkipped) {
      const tagRes = await fetch('https://api.manychat.com/fb/subscriber/addTag', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          tag_id: tagId,
        }),
      });

      const tagData = await safeJson(tagRes);
      console.log('Add tag response:', JSON.stringify(tagData));

      // Step 5: Update lead in database
      await supabase
        .from('leads')
        .update({ manychat_subscriber_id: subscriberId })
        .eq('id', lead.id);
    }

    // Count remaining
    const { count: remainingCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('manychat_subscriber_id', null)
      .not('phone', 'is', null);

    const { count: conflictCount } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('manychat_subscriber_id', 'SYNC_CONFLICT');

    // Throttle
    if ((remainingCount || 0) > 0 && delayMs > 0) {
      console.log(`Throttling: waiting ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: 1,
        failed: wasSkipped ? 1 : 0,
        remaining: remainingCount || 0,
        conflicts: conflictCount || 0,
        results: [
          {
            leadId: lead.id,
            leadName,
            success: !wasSkipped,
            subscriberId: wasSkipped ? null : subscriberId,
            skipped: wasSkipped,
            error: errorMessage,
          },
        ],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Resync error:', error);
    errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await new Promise((r) => setTimeout(r, 3000));

    return new Response(
      JSON.stringify({
        success: true,
        processed: 1,
        failed: 1,
        remaining: -1,
        conflicts: 0,
        results: [
          {
            leadId,
            leadName,
            success: false,
            skipped: true,
            error: errorMessage,
          },
        ],
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
