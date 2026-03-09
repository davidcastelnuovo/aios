import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
  const facebookAppSecret = Deno.env.get('FACEBOOK_APP_SECRET');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);

    // Facebook Webhook Verification (GET request)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Facebook webhook verification request:', { mode, token, challenge });

      // The verify_token should be stored in tenant_integrations settings
      // For now, we accept any verification with mode = 'subscribe'
      if (mode === 'subscribe' && challenge) {
        console.log('Webhook verified successfully');
        return new Response(challenge, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }

      return new Response('Forbidden', { status: 403 });
    }

    // Handle POST - Lead notification from Facebook
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received Facebook webhook:', JSON.stringify(body, null, 2));

      // Verify Facebook signature if app secret is configured
      if (facebookAppSecret) {
        const signature = req.headers.get('x-hub-signature-256');
        if (signature) {
          // In production, verify the signature
          console.log('Signature present, verification would happen here');
        }
      }

      // Process leadgen events
      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'leadgen') {
              const leadgenId = change.value.leadgen_id;
              const formId = change.value.form_id;
              const pageId = change.value.page_id;

              console.log('Processing lead:', { leadgenId, formId, pageId });

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

              console.log('Found integrations:', integrations?.length);

              // Find matching integration by form_id in form_mappings first, then by page_id
              let integration = integrations?.find(i => {
                const settings = i.settings as any;
                // Check if form_id exists in form_mappings
                if (settings?.form_mappings?.[formId]) {
                  console.log('Found integration by form_id:', formId, 'tenant:', i.tenant_id);
                  return true;
                }
                return false;
              });

              // If no integration mapping found, check flow trigger steps for this form_id
              if (!integration) {
                console.log('No integration form mapping for form:', formId, '- checking flow trigger steps...');
                
                // Query automation_flow_steps for trigger steps referencing this form_id
                const { data: flowSteps } = await supabase
                  .from('automation_flow_steps')
                  .select('automation_id, configuration, tenant_id')
                  .eq('step_type', 'trigger')
                  .filter('configuration->>facebook_form_id', 'eq', formId);
                
                if (!flowSteps || flowSteps.length === 0) {
                  console.log('No flow trigger steps reference form:', formId, '- skipping');
                  continue;
                }
                
                console.log(`Found ${flowSteps.length} flow trigger step(s) for form ${formId}`);
                
                // Track which tenants we've already processed for this leadgen_id
                const processedTenants = new Set<string>();
                
                for (const flowStep of flowSteps) {
                  const stepConfig = flowStep.configuration as any;
                  const flowTenantId = flowStep.tenant_id;
                  const fbIntegrationId = stepConfig?.facebook_integration_id;
                  
                  if (processedTenants.has(flowTenantId)) {
                    console.log('Already processed tenant', flowTenantId, 'for this lead');
                    continue;
                  }
                  
                  if (!fbIntegrationId) {
                    console.log('Flow step has no facebook_integration_id, skipping');
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
                    console.log('Flow automation not active:', flowStep.automation_id);
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
                    console.log('No access token for flow integration', fbIntegrationId);
                    continue;
                  }
                  
                  // Check dedup by leadgen_id
                  const { data: existingLeads } = await supabase
                    .from('leads')
                    .select('id')
                    .eq('tenant_id', flowTenantId)
                    .or(`notes.ilike.%${leadgenId}%`)
                    .limit(1);
                  
                  if (existingLeads && existingLeads.length > 0) {
                    console.log('Lead already exists in tenant', flowTenantId, 'for leadgen', leadgenId);
                    processedTenants.add(flowTenantId);
                    continue;
                  }
                  
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
                  
                  // Build lead record
                  const flowLeadRecord: Record<string, any> = {
                    company_name: flowFieldData.full_name || flowFieldData.company || 'Facebook Lead',
                    contact_name: flowFieldData.full_name || `${flowFieldData.first_name || ''} ${flowFieldData.last_name || ''}`.trim() || null,
                    email: flowFieldData.email || null,
                    phone: flowFieldData.phone_number || flowFieldData.phone || null,
                    source: 'paid_ads',
                    status: 'new',
                    tenant_id: flowTenantId,
                    agency_id: stepConfig.agency_id || null,
                    notes: `Facebook Lead ID: ${leadgenId}\nForm ID: ${formId}\nSource: Facebook Lead Ads (via Flow)`,
                  };
                  
                  // Build fb_ prefixed fields
                  const flowFbFields: Record<string, string> = {};
                  for (const [k, v] of Object.entries(flowFieldData)) {
                    flowFbFields[`fb_${k}`] = v;
                  }
                  
                  // Append custom fields to notes
                  const customLines: string[] = [];
                  for (const [k, v] of Object.entries(flowFieldData)) {
                    if (v && !['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'phone'].includes(k)) {
                      customLines.push(`${k}: ${v}`);
                    }
                  }
                  if (customLines.length > 0) {
                    flowLeadRecord.notes += '\n\n--- שדות טופס פייסבוק ---\n' + customLines.join('\n');
                  }
                  
                  // Insert lead
                  const { data: newFlowLead, error: flowInsertErr } = await supabase
                    .from('leads')
                    .insert(flowLeadRecord)
                    .select('id')
                    .single();
                  
                  if (flowInsertErr) {
                    console.error('Error inserting flow-based lead:', flowInsertErr);
                    continue;
                  }
                  
                  processedTenants.add(flowTenantId);
                  console.log('✅ Flow-based lead created:', newFlowLead.id, 'in tenant', flowTenantId);
                  
                  // Trigger lead_created automation with facebook_form_id
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        trigger_type: 'lead_created',
                        tenant_id: flowTenantId,
                        data: {
                          lead_id: newFlowLead.id,
                          contact_name: flowLeadRecord.contact_name || '',
                          company_name: flowLeadRecord.company_name || '',
                          phone: flowLeadRecord.phone || '',
                          email: flowLeadRecord.email || '',
                          source: 'paid_ads',
                          status: 'new',
                          agency_id: flowLeadRecord.agency_id || '',
                          notes: flowLeadRecord.notes || '',
                          facebook_form_id: formId,
                          ...flowFbFields,
                        },
                      }),
                    });
                    console.log('🚀 Flow lead_created automation triggered for:', newFlowLead.id);
                  } catch (e) {
                    console.error('Error triggering flow automation:', e);
                  }
                  
                  // Also trigger inbound_webhook_lead
                  try {
                    await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseServiceKey}`,
                      },
                      body: JSON.stringify({
                        trigger_type: 'inbound_webhook_lead',
                        tenant_id: flowTenantId,
                        data: {
                          lead_id: newFlowLead.id,
                          contact_name: flowLeadRecord.contact_name || '',
                          company_name: flowLeadRecord.company_name || '',
                          phone: flowLeadRecord.phone || '',
                          email: flowLeadRecord.email || '',
                          source: 'paid_ads',
                          status: 'new',
                          agency_id: flowLeadRecord.agency_id || '',
                          notes: flowLeadRecord.notes || '',
                          facebook_form_id: formId,
                          ...flowFbFields,
                        },
                      }),
                    });
                  } catch (e) {
                    console.error('Error triggering inbound_webhook_lead for flow:', e);
                  }
                }
                
                continue;
              }
              
              console.log('Using integration for tenant:', integration.tenant_id);

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
              console.log('Lead data from Facebook:', JSON.stringify(leadData, null, 2));

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

              // Map fields to lead record (use 'paid_ads' as source since it's a valid enum value)
              // Primary sales_person_id for backwards compatibility
              const leadRecord: Record<string, any> = {
                company_name: fieldData.company || fieldData.full_name || 'Facebook Lead',
                source: 'paid_ads',
                status: 'new',
                tenant_id: integration.tenant_id,
                agency_id: formMappings.agency_id || null,
                sales_person_id: salesPersonIds.length > 0 ? salesPersonIds[0] : null,
                notes: `Facebook Lead ID: ${leadgenId}\nForm ID: ${formId}\nSource: Facebook Lead Ads`,
              };

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
                  || null;
              }
              
              // Fallback for email and phone
              if (!leadRecord.email && fieldData.email) {
                leadRecord.email = fieldData.email;
              }
              if (!leadRecord.phone && (fieldData.phone_number || fieldData.phone)) {
                leadRecord.phone = fieldData.phone_number || fieldData.phone;
              }

              // ========== DEDUPLICATION LOGIC ==========
              const normalizedPhone = normalizePhone(leadRecord.phone);
              const normalizedEmail = leadRecord.email?.trim().toLowerCase() || null;
              
              let existingLead = null;
              
              if (normalizedPhone || normalizedEmail) {
                console.log(`🔍 Checking for existing lead - phone: ${normalizedPhone}, email: ${normalizedEmail}`);
                
                // First try to find by phone
                if (normalizedPhone) {
                  const { data: leadsByPhone } = await supabase
                    .from('leads')
                    .select('*')
                    .eq('tenant_id', integration.tenant_id);
                  
                  existingLead = leadsByPhone?.find(l => normalizePhone(l.phone) === normalizedPhone) || null;
                  
                  if (existingLead) {
                    console.log(`📌 Found existing lead by phone: ${existingLead.id} (${existingLead.company_name})`);
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
                    console.log(`📌 Found existing lead by email: ${existingLead.id} (${existingLead.company_name})`);
                  }
                }
              }
              
              // If existing lead found - update with new info if available
              if (existingLead) {
                console.log(`🔄 Lead already exists, checking for new information to update...`);
                
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
                
                // Append to notes about this duplicate lead
                const newNote = `\n\n[${new Date().toISOString()}] Facebook Lead Ads duplicate: leadgen_id=${leadgenId}`;
                const existingNotes = existingLead.notes || '';
                if (!existingNotes.includes(leadgenId)) {
                  updates.notes = existingNotes + newNote;
                  hasUpdates = true;
                }
                
                if (hasUpdates) {
                  updates.updated_at = new Date().toISOString();
                  
                  const { error: updateError } = await supabase
                    .from('leads')
                    .update(updates)
                    .eq('id', existingLead.id);
                  
                  if (updateError) {
                    console.error('❌ Error updating existing lead:', updateError);
                  } else {
                    console.log(`✅ Updated existing lead with new info:`, Object.keys(updates));
                  }
                } else {
                  console.log(`ℹ️ No new information to add, ignoring duplicate lead`);
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
                      console.log('New tag applied to existing lead:', formMappings.tag_id);
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
                console.log('Lead created successfully:', newLead.id);

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
                    console.log('Assigned lead to', salesPersonIds.length, 'salespeople');
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
                    console.log('Tag applied to lead:', formMappings.tag_id);
                  }
                }

                // Trigger automations with lead_created event + all fb_ prefixed fields
                try {
                  const triggerUrl = `${supabaseUrl}/functions/v1/trigger-automation`;
                  const triggerPayload = {
                    trigger_type: 'lead_created',
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
                      // Include all fb_ prefixed form fields for variable replacement
                      ...fbPrefixedFields,
                    },
                  };
                  
                  console.log('🚀 Triggering automations for new Facebook lead:', newLead.id);
                  const triggerRes = await fetch(triggerUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify(triggerPayload),
                  });
                  
                  const triggerResult = await triggerRes.json();
                  console.log('Automation trigger result:', triggerResult);
                } catch (triggerError) {
                  console.error('Error triggering automations:', triggerError);
                  // Don't fail the webhook if automation trigger fails
                }

                // Also trigger inbound_webhook_lead (same as maskyoo-intake does)
                try {
                  const inboundTriggerUrl = `${supabaseUrl}/functions/v1/trigger-automation`;
                  const inboundTriggerPayload = {
                    trigger_type: 'inbound_webhook_lead',
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
                      ...fbPrefixedFields,
                    },
                  };
                  
                  console.log('🚀 Triggering inbound_webhook_lead for Facebook lead:', newLead.id);
                  const inboundRes = await fetch(inboundTriggerUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify(inboundTriggerPayload),
                  });
                  
                  const inboundResult = await inboundRes.json();
                  console.log('Inbound webhook lead trigger result:', inboundResult);
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