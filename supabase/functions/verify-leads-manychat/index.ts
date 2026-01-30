import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHONE_CUSTOM_FIELD_NAME = 'phone_number';

// Normalize phone for comparison
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

// Format phone for ManyChat API
function formatPhoneForManyChat(phone: string): string {
  const cleaned = normalizePhone(phone);
  return `972${cleaned}`;
}

// Generate phone variations for lookup
function getPhoneCandidates(phone: string): string[] {
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

// Get phone_number custom field ID
async function getPhoneFieldId(
  apiKey: string,
  supabase: any,
  tenantId: string
): Promise<number | null> {
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

  const res = await fetch('https://api.manychat.com/fb/page/getCustomFields', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await safeJson(res);
  if (data?.status === 'success' && Array.isArray(data?.data)) {
    const phoneField = data.data.find(
      (f: any) => f.name?.toLowerCase() === 'phone_number'
    );
    if (phoneField?.id) {
      await supabase
        .from('tenant_integrations')
        .update({ settings: { ...settings, phone_number_field_id: phoneField.id } })
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'manychat');
      return phoneField.id;
    }
  }
  return null;
}

// Find subscriber by custom field
async function findByCustomField(
  apiKey: string,
  fieldId: number,
  candidates: string[]
): Promise<{ id: string; status: string; whatsapp_phone: string | null } | null> {
  for (const candidate of candidates) {
    const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_id=${fieldId}&field_value=${encodeURIComponent(candidate)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (res.status === 429) {
      console.log('⏳ Rate limited, waiting 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    const data = await safeJson(res);
    if (data?.status === 'success' && data?.data) {
      const subscribers = Array.isArray(data.data) ? data.data : [data.data];
      const active = subscribers.find((s: any) => s?.status !== 'deleted' && s?.id);
      if (active) {
        return {
          id: String(active.id),
          status: active.status || 'active',
          whatsapp_phone: active.whatsapp_phone || null,
        };
      }
      const first = subscribers.find((s: any) => s?.id);
      if (first) {
        return {
          id: String(first.id),
          status: first.status || 'unknown',
          whatsapp_phone: first.whatsapp_phone || null,
        };
      }
    }
  }
  return null;
}

// Get subscriber info by ID
async function getSubscriberInfo(apiKey: string, subscriberId: string): Promise<any | null> {
  const url = `https://api.manychat.com/fb/subscriber/getInfo?subscriber_id=${encodeURIComponent(subscriberId)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 2000));
    return null;
  }

  const data = await safeJson(res);
  if (data?.status === 'success' && data?.data) {
    return data.data;
  }
  return null;
}

interface LeadResult {
  lead_id: string;
  lead_name: string;
  phone: string;
  saved_id: string | null;
  found_id: string | null;
  found_status: string | null;
  match: 'ok' | 'mismatch' | 'not_found' | 'no_phone' | 'deleted';
  action: 'none' | 'fixed' | 'error';
  details: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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

    const { tenantId, limit = 50, autoFix = true } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Missing tenantId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get ManyChat integration
    const { data: integration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('api_key, is_active')
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
    const phoneFieldId = await getPhoneFieldId(apiKey, supabase, tenantId);
    if (!phoneFieldId) {
      return new Response(
        JSON.stringify({ error: 'Custom field phone_number not found in ManyChat. Please create it.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔍 Starting verification for tenant ${tenantId} with field_id=${phoneFieldId}`);

    // Fetch leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, company_name, phone, manychat_subscriber_id')
      .eq('tenant_id', tenantId)
      .not('phone', 'is', null)
      .limit(limit);

    if (leadsError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch leads', details: leadsError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Checking ${leads?.length || 0} leads`);

    const results: LeadResult[] = [];
    let okCount = 0;
    let mismatchCount = 0;
    let notFoundCount = 0;
    let deletedCount = 0;
    let fixedCount = 0;

    for (const lead of leads || []) {
      const leadName = lead.contact_name || lead.company_name || 'Unknown';
      const savedId = lead.manychat_subscriber_id;

      if (!lead.phone) {
        results.push({
          lead_id: lead.id,
          lead_name: leadName,
          phone: '',
          saved_id: savedId,
          found_id: null,
          found_status: null,
          match: 'no_phone',
          action: 'none',
          details: 'Lead has no phone number',
        });
        continue;
      }

      const phoneCandidates = getPhoneCandidates(lead.phone);

      // Rate limiting: wait 500ms between API calls
      await new Promise((r) => setTimeout(r, 500));

      // Find subscriber by phone_number custom field
      const found = await findByCustomField(apiKey, phoneFieldId, phoneCandidates);

      if (!found) {
        notFoundCount++;
        results.push({
          lead_id: lead.id,
          lead_name: leadName,
          phone: lead.phone,
          saved_id: savedId,
          found_id: null,
          found_status: null,
          match: 'not_found',
          action: 'none',
          details: `No subscriber found in ManyChat for phone ${lead.phone}`,
        });
        continue;
      }

      if (found.status === 'deleted') {
        deletedCount++;
        console.error(`❌ DELETED SUBSCRIBER: Lead ${lead.id} (${leadName}) has saved_id=${savedId} but found subscriber ${found.id} is DELETED`);
        results.push({
          lead_id: lead.id,
          lead_name: leadName,
          phone: lead.phone,
          saved_id: savedId,
          found_id: found.id,
          found_status: 'deleted',
          match: 'deleted',
          action: 'none',
          details: `Subscriber ${found.id} exists but is DELETED in ManyChat`,
        });
        continue;
      }

      // Compare IDs
      if (savedId === found.id) {
        okCount++;
        results.push({
          lead_id: lead.id,
          lead_name: leadName,
          phone: lead.phone,
          saved_id: savedId,
          found_id: found.id,
          found_status: found.status,
          match: 'ok',
          action: 'none',
          details: 'IDs match',
        });
      } else {
        mismatchCount++;
        console.error(`🔄 MISMATCH DETECTED: Lead ${lead.id} (${leadName}) has saved_id=${savedId} but ManyChat lookup found ${found.id}`);

        let action: 'fixed' | 'error' = 'error';
        let details = `Saved ID ${savedId} does not match found ID ${found.id}`;

        if (autoFix) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ manychat_subscriber_id: found.id })
            .eq('id', lead.id);

          if (updateError) {
            console.error(`❌ Failed to fix lead ${lead.id}:`, updateError);
            details += ` | Failed to fix: ${updateError.message}`;
          } else {
            fixedCount++;
            action = 'fixed';
            details += ` | FIXED: Updated to ${found.id}`;
            console.log(`✅ Fixed lead ${lead.id}: ${savedId} → ${found.id}`);
          }
        }

        results.push({
          lead_id: lead.id,
          lead_name: leadName,
          phone: lead.phone,
          saved_id: savedId,
          found_id: found.id,
          found_status: found.status,
          match: 'mismatch',
          action: action,
          details: details,
        });
      }
    }

    const summary = {
      total_checked: leads?.length || 0,
      ok: okCount,
      mismatch: mismatchCount,
      not_found: notFoundCount,
      deleted: deletedCount,
      fixed: fixedCount,
    };

    console.log('📊 Verification Summary:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
