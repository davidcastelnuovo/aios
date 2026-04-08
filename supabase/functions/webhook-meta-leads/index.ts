import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/**
 * Webhook endpoint for receiving Meta Lead Ads leads.
 * Can be triggered by:
 * 1. Unified.to webhook (when configured)
 * 2. Direct Meta webhook
 * 3. Make.com scenario
 * 
 * URL: /functions/v1/webhook-meta-leads?tenant_id=xxx&agency_id=yyy
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // GET for Meta webhook verification (hub.challenge)
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    
    const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'marketing-captain-meta';
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('Meta webhook verified');
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }
    
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const agencyId = url.searchParams.get('agency_id');
    const source = url.searchParams.get('source') || 'paid_ads';

    const rawBody = await req.json();
    console.log('Meta leads webhook received:', JSON.stringify(rawBody).substring(0, 500));

    // Normalize: support multiple formats
    const leads = extractLeads(rawBody);

    if (!leads.length) {
      return new Response(JSON.stringify({ 
        error: 'No leads found in payload',
        received_keys: Object.keys(rawBody),
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant
    let resolvedTenantId = tenantId;
    let resolvedAgencyId = agencyId;

    if (!resolvedTenantId) {
      // Try to find from first lead's ad account or default
      const { data: defaultTenant } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single();
      resolvedTenantId = defaultTenant?.id;
    }

    if (!resolvedTenantId) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get default agency if not specified
    if (!resolvedAgencyId) {
      const { data: defaultAgency } = await supabase
        .from('agencies')
        .select('id')
        .eq('tenant_id', resolvedTenantId)
        .eq('is_default', true)
        .maybeSingle();
      
      if (!defaultAgency) {
        const { data: anyAgency } = await supabase
          .from('agencies')
          .select('id')
          .eq('tenant_id', resolvedTenantId)
          .limit(1)
          .single();
        resolvedAgencyId = anyAgency?.id;
      } else {
        resolvedAgencyId = defaultAgency.id;
      }
    }

    if (!resolvedAgencyId) {
      return new Response(JSON.stringify({ error: 'No agency found for tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        // Check for duplicate by phone or email
        const normalizedPhone = normalizePhone(lead.phone);
        let isDuplicate = false;

        if (normalizedPhone) {
          const { data: existingByPhone } = await supabase
            .from('leads')
            .select('id')
            .eq('tenant_id', resolvedTenantId)
            .ilike('phone', `%${normalizedPhone.slice(-9)}%`)
            .limit(1);
          if (existingByPhone?.length) isDuplicate = true;
        }

        if (!isDuplicate && lead.email) {
          const { data: existingByEmail } = await supabase
            .from('leads')
            .select('id')
            .eq('tenant_id', resolvedTenantId)
            .ilike('email', lead.email)
            .limit(1);
          if (existingByEmail?.length) isDuplicate = true;
        }

        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Insert lead
        const { error: insertError } = await supabase.from('leads').insert({
          company_name: lead.name || lead.company_name || 'ליד מ-Meta',
          contact_name: lead.contact_name || lead.full_name || lead.name || '',
          email: lead.email || null,
          phone: lead.phone || null,
          source: source,
          agency_id: resolvedAgencyId,
          tenant_id: resolvedTenantId,
          notes: buildLeadNotes(lead),
          status: 'new',
        });

        if (insertError) {
          errors.push(`Insert error: ${insertError.message}`);
        } else {
          created++;
        }
      } catch (err: any) {
        errors.push(`Lead processing error: ${err.message}`);
      }
    }

    console.log(`Meta leads webhook: created=${created}, skipped=${skipped}, errors=${errors.length}`);

    return new Response(JSON.stringify({
      success: true,
      created,
      skipped,
      total_received: leads.length,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('webhook-meta-leads error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972');
}

interface ParsedLead {
  name?: string;
  company_name?: string;
  contact_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  form_name?: string;
  campaign_name?: string;
  ad_name?: string;
  leadgen_id?: string;
  raw?: any;
}

function extractLeads(body: any): ParsedLead[] {
  const leads: ParsedLead[] = [];

  // Format 1: Unified.to webhook format (array of leads)
  if (Array.isArray(body)) {
    for (const item of body) {
      leads.push(parseLeadItem(item));
    }
    return leads;
  }

  // Format 2: Unified.to single lead
  if (body.id && (body.emails || body.telephones || body.name)) {
    leads.push(parseUnifiedLead(body));
    return leads;
  }

  // Format 3: Meta direct webhook format
  if (body.entry) {
    for (const entry of body.entry) {
      for (const change of (entry.changes || [])) {
        if (change.field === 'leadgen' && change.value) {
          leads.push({
            leadgen_id: change.value.leadgen_id,
            form_name: change.value.form_id,
            campaign_name: change.value.ad_id,
            raw: change.value,
          });
        }
      }
    }
    return leads;
  }

  // Format 4: Make.com / generic format
  if (body.data && Array.isArray(body.data)) {
    for (const item of body.data) {
      leads.push(parseLeadItem(item));
    }
    return leads;
  }

  // Format 5: Single lead object
  if (body.email || body.phone || body.name || body.contact_name) {
    leads.push(parseLeadItem(body));
    return leads;
  }

  // Format 6: Wrapped in 'lead' key
  if (body.lead) {
    leads.push(parseLeadItem(body.lead));
    return leads;
  }

  return leads;
}

function parseUnifiedLead(item: any): ParsedLead {
  return {
    name: item.name || item.company_name || '',
    contact_name: item.name || '',
    email: Array.isArray(item.emails) ? item.emails[0]?.email : item.email,
    phone: Array.isArray(item.telephones) ? item.telephones[0]?.telephone : item.phone,
    company_name: item.company_name || item.company || '',
    raw: item,
  };
}

function parseLeadItem(item: any): ParsedLead {
  return {
    name: item.name || item.company_name || item.full_name || '',
    contact_name: item.contact_name || item.full_name || item.name || '',
    full_name: item.full_name || item.name || '',
    email: item.email || item.Email || item.EMAIL || '',
    phone: item.phone || item.Phone || item.PHONE || item.phone_number || '',
    company_name: item.company_name || item.company || item.business_name || '',
    form_name: item.form_name || item.form_id || '',
    campaign_name: item.campaign_name || item.campaign_id || '',
    ad_name: item.ad_name || item.ad_id || '',
    leadgen_id: item.leadgen_id || item.id || '',
    raw: item,
  };
}

function buildLeadNotes(lead: ParsedLead): string {
  const parts: string[] = ['מקור: Meta Lead Ads'];
  if (lead.form_name) parts.push(`טופס: ${lead.form_name}`);
  if (lead.campaign_name) parts.push(`קמפיין: ${lead.campaign_name}`);
  if (lead.ad_name) parts.push(`מודעה: ${lead.ad_name}`);
  if (lead.leadgen_id) parts.push(`leadgen_id: ${lead.leadgen_id}`);
  return parts.join('\n');
}
