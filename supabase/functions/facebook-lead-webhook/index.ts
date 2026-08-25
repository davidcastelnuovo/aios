import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import {
  buildLeadRoutingPayload,
  resolveLeadClient,
} from "../_shared/lead-routing.ts";
import { unarchiveExistingLead } from "../_shared/unarchive-lead.ts";
import {
  applyRepeatInboundReopen,
  updateLeadWithRepeatReopen,
} from "../_shared/lead-repeat-reopen.ts";
import { resolveTenantHomeAgencyId } from "../_shared/resolve-tenant-agency.ts";
import {
  facebookTriggerAutomationSucceeded,
  findExistingFacebookLead,
  wasFacebookLeadAutomationClaimed,
} from "../_shared/facebook-lead-dedup.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize phone for comparison
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Prefer META_APP_SECRET (new), fall back to FACEBOOK_APP_SECRET (legacy)
  const facebookAppSecret = Deno.env.get('META_APP_SECRET') ?? Deno.env.get('FACEBOOK_APP_SECRET');
  const verifyToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);

    // Facebook Webhook Verification (GET request)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      // If a verify token is configured, enforce it; otherwise accept any subscribe handshake (legacy).
      if (mode === 'subscribe' && challenge) {
        if (verifyToken && token !== verifyToken) {
          return new Response('Forbidden', { status: 403 });
        }
        return new Response(challenge, {
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      return new Response('Forbidden', { status: 403 });
    }

    // Handle POST - Lead notification from Facebook
    if (req.method === 'POST') {
      const rawBody = await req.text();

      // Verify Facebook signature if app secret is configured
      if (facebookAppSecret) {
        const signature = req.headers.get('x-hub-signature-256') ?? '';
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw', encoder.encode(facebookAppSecret),
          { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );
        const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
        const expected = 'sha256=' + Array.from(new Uint8Array(mac))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        if (signature.length !== expected.length) {
          return new Response('Invalid signature', { status: 403 });
        }
        let diff = 0;
        for (let i = 0; i < expected.length; i++) diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
        if (diff !== 0) {
          return new Response('Invalid signature', { status: 403 });
        }
      }

      const body = JSON.parse(rawBody);



      // Process leadgen events
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id;
              const formId = change.value.form_id;
              const pageId = change.value.page_id;

              // Stamp last_webhook_at on integrations that own this page (best-effort)
              try {
                const { data: pageInts } = await supabase
                  .from('tenant_integrations')
                  .select('id, settings')
                  .eq('integration_type', 'facebook_lead_ads')
                  .eq('is_active', true);
                for (const pi of pageInts ?? []) {
                  const s = (pi.settings as any) ?? {};
                  if (s?.page_subscriptions?.[pageId]) {
                    await supabase
                      .from('tenant_integrations')
                      .update({ settings: { ...s, last_webhook_at: new Date().toISOString() } })
                      .eq('id', pi.id);
                  }
                }
              } catch (e) { console.warn('last_webhook_at stamp failed', e); }



              // Find the integration for this page/form
              const { data: integrations, error: intError } = await supabase
                .from('tenant_integrations')
                .select('*')
                .eq('integration_type', 'facebook_lead_ads')
                .eq('is_active', true);

              if (intError) {
                console.error('Error finding integrations:', intError);
                continue;
              }


              // Find matching integration by form_id in form_mappings first, then by page_id
              let integration = integrations?.find(i => {
                const settings = i.settings as any;
                // Check if form_id exists in form_mappings
                if (settings?.form_mappings?.[formId]) {
                  return true;
                }
                return false;
              });

              // If no integration mapping found, check flow trigger steps for this form_id
              if (!integration) {
                
                // Query automation_flow_steps for trigger steps referencing this form_id
                const { data: flowSteps } = await supabase
                  .from('automation_flow_steps')
                  .select('automation_id, configuration, tenant_id')
                  .eq('step_type', 'trigger')
                  .filter('configuration->>facebook_form_id', 'eq', formId);
                
                if (!flowSteps || flowSteps.length === 0) {
                  continue;
                }
                
                
                // Track which tenants we've already processed for this leadgen_id
                const processedTenants = new Set<string>();
                
                for (const flowStep of flowSteps) {
                  const stepConfig = flowStep.configuration as any;
                  const flowTenantId = flowStep.tenant_id;
                  const fbIntegrationId = stepConfig?.facebook_integration_id;
                  
                  if (processedTenants.has(flowTenantId)) {
                    continue;
                  }
                  
                  if (!fbIntegrationId) {
                    continue;
                  }
                  
                  // Verify the automation is active
                  const { data: flowAutomation } = await supabase
                    .from('automations')
                    .select('id, active')
                    .eq('id', flowStep.automation_id)
                    .eq('active', true)
                    .maybeSingle();
                  
                  if (!flowAutomation) {
                    continue;
                  }
                  
                  // Get access token from the referenced integration
                  const { data: fbIntegration } = await supabase
                    .from('tenant_integrations')
                    .select('api_key, shared_from_integration_id')
                    .eq('id', fbIntegrationId)
                    .eq('is_active', true)
                    .maybeSingle();
                  
                  let flowAccessToken = fbIntegration?.api_key;
                  if (!flowAccessToken && fbIntegration?.shared_from_integration_id) {
                    const { data: srcInt } = await supabase
                      .from('tenant_integrations')
                      .select('api_key')
                      .eq('id', fbIntegration.shared_from_integration_id)
                      .maybeSingle();
                    flowAccessToken = srcInt?.api_key;
                  }
                  
                  if (!flowAccessToken) {
                    continue;
                  }
                  
                  const alreadyClaimed = await wasFacebookLeadAutomationClaimed(supabase, {
                    tenantId: flowTenantId,
                    automationId: flowStep.automation_id,
                    leadgenId,
                  });
                  if (alreadyClaimed) {
                    processedTenants.add(flowTenantId);
                    continue;
                  }

                  const existingLead = await findExistingFacebookLead(supabase, {
                    tenantId: flowTenantId,
                    leadgenId,
                  });
                  
                  // Fetch lead data from Facebook
                  const flowLeadResponse = await fetch(
                    `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${flowAccessToken}`
                  );
                  if (!flowLeadResponse.ok) {
                    console.error('Failed to fetch lead from Facebook for flow:', await flowLeadResponse.text());
                    continue;
                  }
                  
                  const flowLeadData = await flowLeadResponse.json();
                  const flowFieldData: Record<string, string> = {};
                  for (const field of flowLeadData.field_data || []) {
                    flowFieldData[field.name] = field.values?.[0] || '';
                  }
                  const flowClient = await resolveLeadClient(
                    supabase,
                    flowTenantId,
                    stepConfig.client_id,
                  );
                  const flowRoutingPayload = buildLeadRoutingPayload(flowClient, flowFieldData);
                  
                  // CUSTOM heuristic: detect name/phone/email from Hebrew labels
                  let mappedName = flowFieldData.full_name || `${flowFieldData.first_name || ''} ${flowFieldData.last_name || ''}`.trim() || null;
                  let mappedPhone = flowFieldData.phone_number || flowFieldData.phone || null;
                  let mappedEmail = flowFieldData.email || null;
                  
                  // Check all field_data for CUSTOM-type fields with Hebrew labels
                  for (const field of flowLeadData.field_data || []) {
                    const val = field.values?.[0] || '';
                    if (!val) continue;
                    const lbl = (field.name || '').toLowerCase();
                    if (!mappedName && (lbl.includes('שם') || lbl.includes('name'))) mappedName = val;
                    if (!mappedPhone && (lbl.includes('טלפון') || lbl.includes('phone') || lbl.includes('נייד'))) mappedPhone = val;
                    if (!mappedEmail && (lbl.includes('אימייל') || lbl.includes('דוא') || lbl.includes('email') || lbl.includes('mail'))) mappedEmail = val;
                  }
                  
                  // Build notes with fb_ prefix for ALL fields
                  const notesLines = [`leadgen_id: ${leadgenId}`, `Facebook Form: ${formId}`, `Source: Facebook Lead Ads (via Flow)`];
                  for (const [k, v] of Object.entries(flowFieldData)) {
                    if (v) notesLines.push(`fb_${k}: ${v}`);
                  }
                  
                  // Build lead record
                  const flowLeadRecord: Record<string, any> = {
                    company_name: mappedName || flowFieldData.company || 'Facebook Lead',
                    contact_name: mappedName || null,
                    email: mappedEmail || null,
                    phone: mappedPhone || null,
                    source: 'paid_ads',
                    status: 'new',
                    tenant_id: flowTenantId,
                    agency_id: stepConfig.agency_id || null,
                    client_id: flowClient?.client_id || null,
                    facebook_form_id: formId,
                    facebook_leadgen_id: leadgenId,
                    form_data: flowFieldData,
                    form_qa_summary: flowRoutingPayload.form_qa_summary,
                    notes: notesLines.join('\n'),
                  };

                  if (!flowLeadRecord.agency_id && flowTenantId) {
                    flowLeadRecord.agency_id = await resolveTenantHomeAgencyId(supabase, flowTenantId);
                  }
                  
                  // Build fb_ prefixed fields for trigger payload
                  const flowFbFields: Record<string, string> = {};
                  for (const [k, v] of Object.entries(flowFieldData)) {
                    flowFbFields[`fb_${k}`] = v;
                  }
                  
                  let flowLeadId = existingLead?.id || null;
                  if (!flowLeadId) {
                    const { data: newFlowLead, error: flowInsertErr } = await supabase
                      .from('leads')
                      .insert(flowLeadRecord)
                      .select('id')
                      .single();

                    if (flowInsertErr) {
                      console.error('Error inserting flow-based lead:', flowInsertErr);
                      continue;
                    }
                    flowLeadId = newFlowLead.id;
                  }

                  processedTenants.add(flowTenantId);

                  // Trigger flow automation directly by automationId (source: 'flow')
                  let triggerSucceeded = false;
                  try {
                    const triggerResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        automationId: flowStep.automation_id,
                        source: 'flow',
                        data: {
                          lead_id: flowLeadId,
                          contact_name: flowLeadRecord.contact_name || '',
                          company_name: flowLeadRecord.company_name || '',
                          phone: flowLeadRecord.phone || '',
                          email: flowLeadRecord.email || '',
                          source: 'paid_ads',
                          status: 'new',
                          agency_id: flowLeadRecord.agency_id || '',
                          notes: flowLeadRecord.notes || '',
                          facebook_form_id: formId,
                          facebook_leadgen_id: leadgenId,
                          ...flowRoutingPayload,
                          ...flowFbFields,
                        },
                      }),
                    });
                    if (triggerResponse.ok) {
                      triggerSucceeded = facebookTriggerAutomationSucceeded(await triggerResponse.json());
                    } else {
                      console.error('Error triggering flow automation:', await triggerResponse.text());
                    }
                  } catch (e) {
                    console.error('Error triggering flow automation:', e);
                  }

                  if (triggerSucceeded) {
                    const { error: processedErr } = await supabase.from('flow_processed_leads').insert({
                      automation_id: flowStep.automation_id,
                      tenant_id: flowTenantId,
                      leadgen_id: leadgenId,
                      facebook_form_id: formId,
                    });
                    if (processedErr && processedErr.code !== '23505') {
                      console.error('Error recording flow_processed_leads:', processedErr);
                    }
                  }
                }
                
                continue;
              }
              

              let accessToken = integration.api_key;
              const settings = integration.settings as any;

              // If this is a shared integration, get the token from the source
              if ((integration as any).shared_from_integration_id && !accessToken) {
                const { data: sourceIntegration } = await supabase
                  .from('tenant_integrations')
                  .select('api_key')
                  .eq('id', (integration as any).shared_from_integration_id)
                  .eq('is_active', true)
                  .maybeSingle();
                
                if (sourceIntegration?.api_key) {
                  accessToken = sourceIntegration.api_key;
                }
              }

              if (!accessToken) {
                console.error('No access token for integration');
                continue;
              }

              // Fetch lead details from Facebook Graph API
              const leadResponse = await fetch(
                `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${accessToken}`
              );

              if (!leadResponse.ok) {
                console.error('Failed to fetch lead from Facebook:', await leadResponse.text());
                continue;
              }

              const leadData = await leadResponse.json();

              // Parse lead fields
              const fieldData: Record<string, string> = {};
              for (const field of leadData.field_data || []) {
                fieldData[field.name] = field.values?.[0] || '';
              }

              // Get form mappings from settings
              const formMappings = settings?.form_mappings?.[formId] || {};
              const fieldMappings = formMappings.field_mappings || {
                'full_name': 'contact_name',
                'email': 'email',
                'phone_number': 'phone',
              };

              // Support both legacy single and new multi-select
              const salesPersonIds: string[] = formMappings.sales_person_ids 
                || (formMappings.sales_person_id ? [formMappings.sales_person_id] : []);
              const routedClient = await resolveLeadClient(
                supabase,
                integration.tenant_id,
                formMappings.client_id,
              );
              const routingPayload = buildLeadRoutingPayload(routedClient, fieldData);

              // CUSTOM heuristic: detect name/phone/email from Hebrew labels
              let legacyMappedName: string | null = null;
              let legacyMappedPhone: string | null = null;
              let legacyMappedEmail: string | null = null;
              
              for (const field of leadData.field_data || []) {
                const val = field.values?.[0] || '';
                if (!val) continue;
                const lbl = (field.name || '').toLowerCase();
                if (!legacyMappedName && (lbl.includes('שם') || lbl.includes('name'))) legacyMappedName = val;
                if (!legacyMappedPhone && (lbl.includes('טלפון') || lbl.includes('phone') || lbl.includes('נייד'))) legacyMappedPhone = val;
                if (!legacyMappedEmail && (lbl.includes('אימייל') || lbl.includes('דוא') || lbl.includes('email') || lbl.includes('mail'))) legacyMappedEmail = val;
              }
              
              // Build notes with fb_ prefix for ALL fields
              const legacyNotesLines = [`leadgen_id: ${leadgenId}`, `Facebook Form: ${formId}`, `Source: Facebook Lead Ads`];
              for (const [k, v] of Object.entries(fieldData)) {
                if (v) legacyNotesLines.push(`fb_${k}: ${v}`);
              }
              
              // Map fields to lead record
              const leadRecord: Record<string, any> = {
                company_name: fieldData.company || fieldData.full_name || legacyMappedName || 'Facebook Lead',
                source: 'paid_ads',
                status: 'new',
                tenant_id: integration.tenant_id,
                agency_id: formMappings.agency_id || null,
                client_id: routedClient?.client_id || null,
                sales_person_id: salesPersonIds.length > 0 ? salesPersonIds[0] : null,
                facebook_form_id: formId,
                facebook_leadgen_id: leadgenId,
                form_data: fieldData,
                form_qa_summary: routingPayload.form_qa_summary,
                notes: legacyNotesLines.join('\n'),
              };

              if (!leadRecord.agency_id && integration.tenant_id) {
                leadRecord.agency_id = await resolveTenantHomeAgencyId(supabase, integration.tenant_id);
              }

              // Apply field mappings
              for (const [fbField, dbField] of Object.entries(fieldMappings)) {
                if (fieldData[fbField]) {
                  leadRecord[dbField as string] = fieldData[fbField];
                }
              }

              // Fallback for contact_name if not set by field mappings
              if (!leadRecord.contact_name) {
                leadRecord.contact_name = fieldData.full_name 
                  || `${fieldData.first_name || ''} ${fieldData.last_name || ''}`.trim()
                  || fieldData.name
                  || legacyMappedName
                  || null;
              }
              
              // Fallback for email and phone (use heuristic values too)
              if (!leadRecord.email) {
                leadRecord.email = fieldData.email || legacyMappedEmail || null;
              }
              if (!leadRecord.phone) {
                leadRecord.phone = fieldData.phone_number || fieldData.phone || legacyMappedPhone || null;
              }

              // Notification-only form mapping: forward the complete Facebook
              // payload to Flow Builder without creating a CRM lead. One generic
              // lead_created flow can serve every mapped client through
              // {{client_phone}} and {{form_qa_summary}}.
              if (formMappings.create_crm_lead === false) {
                const { error: receiptError } = await supabase
                  .from('lead_notification_events')
                  .insert({
                    tenant_id: integration.tenant_id,
                    source: 'facebook',
                    external_id: leadgenId,
                    client_id: routedClient?.client_id || null,
                    form_id: formId,
                  });
                if (receiptError?.code === '23505') {
                  continue;
                }
                if (receiptError) throw receiptError;

                const triggerUrl = `${supabaseUrl}/functions/v1/trigger-automation`;
                const triggerResponse = await fetch(triggerUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    trigger_type: 'lead_created',
                    source: 'facebook_webhook',
                    tenant_id: integration.tenant_id,
                    data: {
                      contact_name: leadRecord.contact_name || '',
                      company_name: leadRecord.company_name || '',
                      phone: leadRecord.phone || '',
                      email: leadRecord.email || '',
                      source: leadRecord.source || 'paid_ads',
                      status: 'new',
                      agency_id: leadRecord.agency_id || '',
                      facebook_form_id: formId,
                      facebook_leadgen_id: leadgenId,
                      crm_lead_created: false,
                      ...routingPayload,
                    },
                  }),
                });
                if (!triggerResponse.ok) {
                  console.error(
                    'Notification-only lead automation failed:',
                    await triggerResponse.text(),
                  );
                }
                await supabase
                  .from('tenant_integrations')
                  .update({ last_sync_at: new Date().toISOString() })
                  .eq('id', integration.id);
                continue;
              }

              // ========== DEDUPLICATION LOGIC ==========
              const normalizedPhone = normalizePhone(leadRecord.phone);
              const normalizedEmail = leadRecord.email?.trim().toLowerCase() || null;
              
              let existingLead = null;
              
              if (normalizedPhone || normalizedEmail) {
                
                // First try to find by phone
                if (normalizedPhone) {
                  const { data: leadsByPhone } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('tenant_id', integration.tenant_id);
                  
                  existingLead = leadsByPhone?.find(l => normalizePhone(l.phone) === normalizedPhone) || null;
                  
                  if (existingLead) {
                  }
                }
                
                // If not found by phone, try email
                if (!existingLead && normalizedEmail) {
                  const { data: leadByEmail } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('tenant_id', integration.tenant_id)
                    .ilike('email', normalizedEmail)
                    .limit(1)
                    .maybeSingle();
                  
                  if (leadByEmail) {
                    existingLead = leadByEmail;
                  }
                }
              }
              
              // If existing lead found - update with new info if available
              if (existingLead) {
                
                const updates: Record<string, any> = {};
                let hasUpdates = false;
                
                // Only update fields that are empty in existing lead but have values in new lead
                if (!existingLead.contact_name && leadRecord.contact_name) {
                  updates.contact_name = leadRecord.contact_name;
                  hasUpdates = true;
                }
                if (!existingLead.email && leadRecord.email) {
                  updates.email = leadRecord.email;
                  hasUpdates = true;
                }
                if (!existingLead.phone && leadRecord.phone) {
                  updates.phone = leadRecord.phone;
                  hasUpdates = true;
                }
                if (!existingLead.sales_person_id && leadRecord.sales_person_id) {
                  updates.sales_person_id = leadRecord.sales_person_id;
                  hasUpdates = true;
                }
                if (!existingLead.client_id && leadRecord.client_id) {
                  updates.client_id = leadRecord.client_id;
                  hasUpdates = true;
                }
                updates.facebook_form_id = formId;
                updates.facebook_leadgen_id = leadgenId;
                updates.form_data = fieldData;
                updates.form_qa_summary = routingPayload.form_qa_summary;
                hasUpdates = true;
                
                // Append to notes about this duplicate lead
                const newNote = `\n\n[${new Date().toISOString()}] Facebook Lead Ads duplicate: leadgen_id=${leadgenId}`;
                const existingNotes = existingLead.notes || '';
                if (!existingNotes.includes(leadgenId)) {
                  updates.notes = existingNotes + newNote;
                  hasUpdates = true;
                }

                if (unarchiveExistingLead(existingLead, updates)) {
                  hasUpdates = true;
                }

                Object.assign(
                  updates,
                  applyRepeatInboundReopen(existingLead, { source: leadRecord.source || "paid_ads" }),
                );
                hasUpdates = true;
                
                if (hasUpdates) {
                  updates.updated_at = new Date().toISOString();
                  
                  const { error: updateError } = await updateLeadWithRepeatReopen(
                    supabase,
                    existingLead.id,
                    updates,
                  );
                  
                  if (updateError) {
                    console.error('❌ Error updating existing lead:', updateError);
                  } else {
                  }
                } else {
                }
                
                // Apply tag to existing lead if configured
                if (formMappings.tag_id) {
                  const { data: existingTagLink } = await supabase
                    .from('chat_contact_tags')
                    .select('id')
                    .eq('lead_id', existingLead.id)
                    .eq('tag_id', formMappings.tag_id)
                    .maybeSingle();
                  
                  if (!existingTagLink) {
                    const { error: tagError } = await supabase
                      .from('chat_contact_tags')
                      .insert({
                        tag_id: formMappings.tag_id,
                        lead_id: existingLead.id,
                        tenant_id: integration.tenant_id,
                        user_id: '00000000-0000-0000-0000-000000000000',
                      });
                    
                    if (tagError) {
                      console.error('Error applying tag to existing lead:', tagError);
                    } else {
                    }
                  }
                }
                
                // Update last_sync_at
                await supabase
                  .from('tenant_integrations')
                  .update({ last_sync_at: new Date().toISOString() })
                  .eq('id', integration.id);
                  
                continue; // Skip to next lead
              }
              // ========== END DEDUPLICATION LOGIC ==========

              // Build facebook form data with fb_ prefix for all fields
              const fbPrefixedFields: Record<string, string> = {};
              for (const [fbFieldName, fbFieldValue] of Object.entries(fieldData)) {
                // Create fb_ prefixed key, replacing spaces with underscores
                const fbKey = `fb_${fbFieldName}`;
                fbPrefixedFields[fbKey] = fbFieldValue as string;
              }

              // Append all custom form fields to notes
              const customFieldLines: string[] = [];
              for (const [fbFieldName, fbFieldValue] of Object.entries(fieldData)) {
                if (fbFieldValue && !['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'].includes(fbFieldName)) {
                  customFieldLines.push(`${fbFieldName}: ${fbFieldValue}`);
                }
              }
              if (customFieldLines.length > 0) {
                leadRecord.notes = (leadRecord.notes || '') + '\n\n--- שדות טופס פייסבוק ---\n' + customFieldLines.join('\n');
              }

              // Insert new lead
              const { data: newLead, error: insertError } = await supabase
                .from('leads')
                .insert(leadRecord)
                .select('id')
                .single();

              if (insertError) {
                console.error('Error inserting lead:', insertError);
              } else {

                // Insert into lead_sales_people junction table for multi-salesperson support
                if (salesPersonIds.length > 0) {
                  const junctionRecords = salesPersonIds.map(spId => ({
                    lead_id: newLead.id,
                    sales_person_id: spId,
                    tenant_id: integration.tenant_id,
                  }));
                  
                  const { error: junctionError } = await supabase
                    .from('lead_sales_people')
                    .insert(junctionRecords);
                  
                  if (junctionError) {
                    console.error('Error inserting lead_sales_people:', junctionError);
                  } else {
                  }
                }

                // Apply tag if configured
                if (formMappings.tag_id) {
                  const { error: tagError } = await supabase
                    .from('chat_contact_tags')
                    .insert({
                      tag_id: formMappings.tag_id,
                      lead_id: newLead.id,
                      tenant_id: integration.tenant_id,
                      user_id: '00000000-0000-0000-0000-000000000000',
                    });
                  
                  if (tagError) {
                    console.error('Error applying tag to lead:', tagError);
                  } else {
                  }
                }

                // Trigger both legacy lead_created automations and Flow Builder
                // automations. The flow trigger configuration validates the form ID,
                // so one flow can safely serve all mapped client forms.
                try {
                  const triggerUrl = `${supabaseUrl}/functions/v1/trigger-automation`;
                  const triggerPayload = {
                    trigger_type: 'lead_created',
                    source: 'facebook_webhook',
                    tenant_id: integration.tenant_id,
                    data: {
                      lead_id: newLead.id,
                      contact_name: leadRecord.contact_name || '',
                      company_name: leadRecord.company_name || '',
                      phone: leadRecord.phone || '',
                      email: leadRecord.email || '',
                      source: leadRecord.source || 'paid_ads',
                      status: leadRecord.status || 'new',
                      agency_id: leadRecord.agency_id || '',
                      notes: leadRecord.notes || '',
                      facebook_form_id: formId,
                      facebook_leadgen_id: leadgenId,
                      ...routingPayload,
                      // Include all fb_ prefixed form fields for variable replacement
                      ...fbPrefixedFields,
                    },
                  };
                  
                  const triggerRes = await fetch(triggerUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify(triggerPayload),
                  });
                  
                  const triggerResult = await triggerRes.json();
                } catch (triggerError) {
                  console.error('Error triggering CRM automations:', triggerError);
                }

                // Also trigger inbound_webhook_lead with source: 'crm'
                try {
                  const inboundTriggerUrl = `${supabaseUrl}/functions/v1/trigger-automation`;
                  const inboundTriggerPayload = {
                    trigger_type: 'inbound_webhook_lead',
                    source: 'crm',
                    tenant_id: integration.tenant_id,
                    data: {
                      lead_id: newLead.id,
                      contact_name: leadRecord.contact_name || '',
                      company_name: leadRecord.company_name || '',
                      phone: leadRecord.phone || '',
                      email: leadRecord.email || '',
                      source: leadRecord.source || 'paid_ads',
                      status: leadRecord.status || 'new',
                      agency_id: leadRecord.agency_id || '',
                      notes: leadRecord.notes || '',
                      facebook_form_id: formId,
                      ...fbPrefixedFields,
                    },
                  };
                  
                  const inboundRes = await fetch(inboundTriggerUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify(inboundTriggerPayload),
                  });
                  
                  const inboundResult = await inboundRes.json();
                } catch (inboundError) {
                  console.error('Error triggering inbound_webhook_lead:', inboundError);
                }

                // Update last_sync_at
                await supabase
                  .from('tenant_integrations')
                  .update({ last_sync_at: new Date().toISOString() })
                  .eq('id', integration.id);
              }
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error: unknown) {
    console.error('Error in facebook-lead-webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});