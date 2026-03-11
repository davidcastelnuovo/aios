import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormMapping {
  form_id: string;
  form_name: string;
  agency_id: string;
  sales_person_id?: string | null;
  tag_id?: string | null;
  field_mappings: Record<string, string>;
}

interface IntegrationSettings {
  form_mappings?: Record<string, FormMapping>;
  pages?: Array<{ id: string; name: string; access_token: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('🔄 Starting scheduled Facebook leads sync...');

  try {
    // Get all active facebook_lead_ads integrations
    const { data: integrations, error: intError } = await supabase
      .from('tenant_integrations')
      .select('id, tenant_id, settings, api_key, shared_from_integration_id, last_sync_at')
      .eq('integration_type', 'facebook_lead_ads')
      .eq('is_active', true);

    if (intError) {
      console.error('Error fetching integrations:', intError);
      throw intError;
    }

    if (!integrations || integrations.length === 0) {
      console.log('No active Facebook Lead Ads integrations found');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active integrations',
        synced: 0,
        skipped: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`Found ${integrations.length} active integrations`);

    let totalSynced = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      console.log(`\n📦 Processing integration ${integration.id} for tenant ${integration.tenant_id}`);

      // Get access token - check shared integration if needed
      let accessToken = integration.api_key;
      if (!accessToken && integration.shared_from_integration_id) {
        const { data: sourceInt } = await supabase
          .from('tenant_integrations')
          .select('api_key')
          .eq('id', integration.shared_from_integration_id)
          .single();
        accessToken = sourceInt?.api_key;
        console.log('Using access token from shared integration');
      }

      if (!accessToken) {
        console.log(`⚠️ No access token for integration ${integration.id}, skipping`);
        errors.push(`Integration ${integration.id}: No access token`);
        continue;
      }

      const settings = integration.settings as IntegrationSettings | null;
      const formMappings = settings?.form_mappings || {};
      const formEntries = Object.entries(formMappings);

      if (formEntries.length === 0) {
        console.log(`⚠️ No form mappings for integration ${integration.id}, skipping`);
        continue;
      }

      console.log(`Found ${formEntries.length} mapped forms`);

      // Determine since timestamp: use last_sync_at if available, otherwise 24 hours ago
      const lastSyncAt = integration.last_sync_at 
        ? new Date(integration.last_sync_at as string) 
        : null;
      const sinceDate = lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sinceTimestamp = Math.floor(sinceDate.getTime() / 1000);
      console.log(`Fetching leads since: ${sinceDate.toISOString()} (${lastSyncAt ? 'from last_sync_at' : 'default 24h'})`);

      // Process each mapped form
      for (const [formId, mapping] of formEntries) {
        console.log(`\n📝 Syncing form: ${mapping.form_name || formId}`);

        try {

          const fbUrl = `https://graph.facebook.com/v19.0/${formId}/leads?access_token=${accessToken}&since=${sinceTimestamp}&limit=500`;
          const fbResponse = await fetch(fbUrl);

          if (!fbResponse.ok) {
            const errorText = await fbResponse.text();
            console.error(`Facebook API error for form ${formId}:`, errorText);
            errors.push(`Form ${formId}: Facebook API error - ${errorText}`);
            continue;
          }

          const fbData = await fbResponse.json();
          const leads = fbData.data || [];

          console.log(`Retrieved ${leads.length} leads from Facebook for form ${formId}`);

          for (const fbLead of leads) {
            const leadgenId = fbLead.id;

            // Check if lead already exists by leadgen_id in notes (both formats)
            const { data: existingLeads } = await supabase
              .from('leads')
              .select('id')
              .eq('tenant_id', integration.tenant_id)
              .or(`notes.ilike.%leadgen_id: ${leadgenId}%,notes.ilike.%Facebook Lead ID: ${leadgenId}%`)
              .limit(1);

            if (existingLeads && existingLeads.length > 0) {
              console.log(`⏭️ Lead ${leadgenId} already exists, skipping`);
              totalSkipped++;
              continue;
            }

            // Check if this lead was previously deleted
            const { data: deletedLead } = await supabase
              .from('deleted_facebook_leads')
              .select('id')
              .eq('tenant_id', integration.tenant_id)
              .eq('leadgen_id', leadgenId)
              .limit(1);

            if (deletedLead && deletedLead.length > 0) {
              console.log(`🗑️ Lead ${leadgenId} was previously deleted, skipping`);
              totalSkipped++;
              continue;
            }

            // Parse field data from Facebook lead
            const fieldData: Record<string, string> = {};
            if (fbLead.field_data) {
              for (const field of fbLead.field_data) {
                fieldData[field.name] = field.values?.[0] || '';
              }
            }

            // Map fields according to configuration
            const leadRecord: Record<string, any> = {
              tenant_id: integration.tenant_id,
              agency_id: mapping.agency_id,
              sales_person_id: (mapping.sales_person_id && mapping.sales_person_id !== 'none') ? mapping.sales_person_id : null,
              source: 'paid_ads',
              status: 'new',
              notes: `leadgen_id: ${leadgenId}\nFacebook Form: ${mapping.form_name || formId}\nCreated: ${fbLead.created_time || 'unknown'}`,
              company_name: 'ליד מפייסבוק', // Default
            };

            // Apply field mappings
            const fieldMappings = mapping.field_mappings || {};
            for (const [fbFieldName, systemField] of Object.entries(fieldMappings)) {
              if (systemField && systemField !== 'skip' && fieldData[fbFieldName]) {
                if (systemField === 'notes') {
                  leadRecord.notes += `\n${fbFieldName}: ${fieldData[fbFieldName]}`;
                } else {
                  leadRecord[systemField] = fieldData[fbFieldName];
                }
              }
            }

            // Ensure company_name is set
            if (!leadRecord.company_name || leadRecord.company_name === 'ליד מפייסבוק') {
              leadRecord.company_name = leadRecord.contact_name || fieldData['full_name'] || fieldData['name'] || 'ליד מפייסבוק';
            }

            // Insert the lead
            const { data: newLead, error: insertError } = await supabase
              .from('leads')
              .insert(leadRecord)
              .select()
              .single();

            if (insertError) {
              console.error(`Error inserting lead ${leadgenId}:`, insertError);
              errors.push(`Lead ${leadgenId}: Insert error - ${insertError.message}`);
              continue;
            }

            console.log(`✅ Created new lead: ${newLead.id}`);
            totalSynced++;

            // Apply tag if configured
            if (mapping.tag_id) {
              const { error: tagError } = await supabase
                .from('chat_contact_tags')
                .insert({
                  tag_id: mapping.tag_id,
                  lead_id: newLead.id,
                  tenant_id: integration.tenant_id,
                  user_id: '00000000-0000-0000-0000-000000000000',
                });
              
              if (tagError) {
                console.error(`⚠️ Error applying tag to lead ${newLead.id}:`, tagError);
              } else {
                console.log(`🏷️ Tag ${mapping.tag_id} applied to lead ${newLead.id}`);
              }
            }

            // Trigger lead_created automation
            try {
              const automationResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  trigger_type: 'lead_created',
                  source: 'crm',
                  data: {
                    id: newLead.id,
                    lead_id: newLead.id,
                    company_name: newLead.company_name,
                    contact_name: newLead.contact_name,
                    phone: newLead.phone,
                    email: newLead.email,
                    status: newLead.status,
                    source: newLead.source,
                    agency_id: newLead.agency_id,
                  },
                  tenant_id: integration.tenant_id,
                }),
              });

              if (automationResponse.ok) {
                console.log(`✅ lead_created automation triggered for ${newLead.id}`);
              } else {
                console.error(`⚠️ Failed to trigger automation:`, await automationResponse.text());
              }
            } catch (automationError) {
              console.error(`⚠️ Error triggering automation:`, automationError);
            }
          }

          // Handle pagination if there are more leads
          let nextUrl = fbData.paging?.next;
          while (nextUrl) {
            console.log('Fetching next page of leads...');
            const nextResponse = await fetch(nextUrl);
            if (!nextResponse.ok) break;

            const nextData = await nextResponse.json();
            const nextLeads = nextData.data || [];

            for (const fbLead of nextLeads) {
              // Same processing as above
              const leadgenId = fbLead.id;

              const { data: existingLeads } = await supabase
                .from('leads')
                .select('id')
                .eq('tenant_id', integration.tenant_id)
                .or(`notes.ilike.%leadgen_id: ${leadgenId}%,notes.ilike.%Facebook Lead ID: ${leadgenId}%`)
                .limit(1);

              if (existingLeads && existingLeads.length > 0) {
                totalSkipped++;
                continue;
              }

              // Check if this lead was previously deleted
              const { data: deletedLead } = await supabase
                .from('deleted_facebook_leads')
                .select('id')
                .eq('tenant_id', integration.tenant_id)
                .eq('leadgen_id', leadgenId)
                .limit(1);

              if (deletedLead && deletedLead.length > 0) {
                console.log(`🗑️ Lead ${leadgenId} was previously deleted, skipping`);
                totalSkipped++;
                continue;
              }

              const fieldData: Record<string, string> = {};
              if (fbLead.field_data) {
                for (const field of fbLead.field_data) {
                  fieldData[field.name] = field.values?.[0] || '';
                }
              }

              const leadRecord: Record<string, any> = {
                tenant_id: integration.tenant_id,
                agency_id: mapping.agency_id,
                sales_person_id: (mapping.sales_person_id && mapping.sales_person_id !== 'none') ? mapping.sales_person_id : null,
                source: 'paid_ads',
                status: 'new',
                notes: `leadgen_id: ${leadgenId}\nFacebook Form: ${mapping.form_name || formId}\nCreated: ${fbLead.created_time || 'unknown'}`,
                company_name: 'ליד מפייסבוק',
              };

              const fieldMappings = mapping.field_mappings || {};
              for (const [fbFieldName, systemField] of Object.entries(fieldMappings)) {
                if (systemField && systemField !== 'skip' && fieldData[fbFieldName]) {
                  if (systemField === 'notes') {
                    leadRecord.notes += `\n${fbFieldName}: ${fieldData[fbFieldName]}`;
                  } else {
                    leadRecord[systemField] = fieldData[fbFieldName];
                  }
                }
              }

              if (!leadRecord.company_name || leadRecord.company_name === 'ליד מפייסבוק') {
                leadRecord.company_name = leadRecord.contact_name || fieldData['full_name'] || fieldData['name'] || 'ליד מפייסבוק';
              }

              const { data: newLead, error: insertError } = await supabase
                .from('leads')
                .insert(leadRecord)
                .select()
                .single();

              if (insertError) {
                errors.push(`Lead ${leadgenId}: Insert error - ${insertError.message}`);
                continue;
              }

              totalSynced++;

              // Apply tag if configured (pagination loop)
              if (mapping.tag_id) {
                const { error: tagError } = await supabase
                  .from('chat_contact_tags')
                  .insert({
                    tag_id: mapping.tag_id,
                    lead_id: newLead.id,
                    tenant_id: integration.tenant_id,
                    user_id: '00000000-0000-0000-0000-000000000000',
                  });
                
                if (tagError) {
                  console.error(`⚠️ Error applying tag to lead ${newLead.id}:`, tagError);
                } else {
                  console.log(`🏷️ Tag ${mapping.tag_id} applied to lead ${newLead.id}`);
                }
              }

              // Trigger automation
              try {
                await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                  },
                  body: JSON.stringify({
                    trigger_type: 'lead_created',
                    data: {
                      id: newLead.id,
                      lead_id: newLead.id,
                      company_name: newLead.company_name,
                      contact_name: newLead.contact_name,
                      phone: newLead.phone,
                      email: newLead.email,
                      status: newLead.status,
                      source: newLead.source,
                      agency_id: newLead.agency_id,
                    },
                    tenant_id: integration.tenant_id,
                  }),
                });
              } catch (e) {
                console.error('Automation error:', e);
              }
            }

            nextUrl = nextData.paging?.next;
          }

        } catch (formError) {
          console.error(`Error processing form ${formId}:`, formError);
          errors.push(`Form ${formId}: ${formError}`);
        }
      }

      // Update last_sync_at for the integration
      await supabase
        .from('tenant_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', integration.id);
    }

    // ========== PASS 2: Flow-based form scanning ==========
    // Find flow trigger steps that reference facebook_form_id not covered by any integration form_mappings
    console.log('\n🔄 Pass 2: Checking flow trigger steps for unmapped forms...');
    
    const { data: allFlowSteps } = await supabase
      .from('automation_flow_steps')
      .select('automation_id, configuration, tenant_id')
      .eq('step_type', 'trigger')
      .not('configuration->>facebook_form_id', 'is', null);
    
    if (allFlowSteps && allFlowSteps.length > 0) {
      // Build a set of all form_ids already covered by integrations
      const coveredFormIds = new Set<string>();
      for (const integration of integrations!) {
        const settings = integration.settings as IntegrationSettings | null;
        const mappings = settings?.form_mappings || {};
        for (const fId of Object.keys(mappings)) {
          coveredFormIds.add(`${integration.tenant_id}:${fId}`);
        }
      }
      
      // Group flow steps by form_id + tenant_id to avoid duplicates
      const flowFormMap = new Map<string, { formId: string; tenantId: string; integrationId: string; automationId: string }>();
      
      for (const step of allFlowSteps) {
        const config = step.configuration as any;
        const formId = config?.facebook_form_id;
        const integrationId = config?.facebook_integration_id;
        if (!formId || !integrationId) continue;
        
        const key = `${step.tenant_id}:${formId}`;
        if (coveredFormIds.has(key)) {
          console.log(`⏭️ Form ${formId} already covered by integration for tenant ${step.tenant_id}`);
          continue;
        }
        
        // Verify automation is active
        const { data: autoCheck } = await supabase
          .from('automations')
          .select('id')
          .eq('id', step.automation_id)
          .eq('active', true)
          .maybeSingle();
        
        if (!autoCheck) continue;
        
        if (!flowFormMap.has(key)) {
          flowFormMap.set(key, {
            formId,
            tenantId: step.tenant_id,
            integrationId,
            automationId: step.automation_id,
          });
        }
      }
      
      console.log(`Found ${flowFormMap.size} unmapped flow form(s) to sync`);
      
      for (const [key, info] of flowFormMap) {
        console.log(`\n📝 Flow-syncing form ${info.formId} for tenant ${info.tenantId}`);
        
        // Get access token from the referenced integration
        const { data: fbInt } = await supabase
          .from('tenant_integrations')
          .select('api_key, shared_from_integration_id, last_sync_at')
          .eq('id', info.integrationId)
          .eq('is_active', true)
          .maybeSingle();
        
        let flowToken = fbInt?.api_key;
        if (!flowToken && fbInt?.shared_from_integration_id) {
          const { data: srcInt } = await supabase
            .from('tenant_integrations')
            .select('api_key')
            .eq('id', fbInt.shared_from_integration_id)
            .maybeSingle();
          flowToken = srcInt?.api_key;
        }
        
        if (!flowToken) {
          console.log(`⚠️ No access token for flow integration ${info.integrationId}`);
          continue;
        }
        
        // Get trigger step config for sync_since_date
        const { data: triggerStep } = await supabase
          .from('automation_flow_steps')
          .select('configuration')
          .eq('automation_id', info.automationId)
          .eq('step_type', 'trigger')
          .maybeSingle();
        
        const syncSinceDate = (triggerStep?.configuration as any)?.sync_since_date;
        
        // Use last_sync_at from the integration, or sync_since_date from config, or default to 24h ago
        const flowSinceDate = fbInt?.last_sync_at 
          ? new Date(fbInt.last_sync_at as string) 
          : syncSinceDate 
            ? new Date(syncSinceDate)
            : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const flowSinceTimestamp = Math.floor(flowSinceDate.getTime() / 1000);
        
        try {
          const fbUrl = `https://graph.facebook.com/v19.0/${info.formId}/leads?access_token=${flowToken}&since=${flowSinceTimestamp}&limit=500`;
          const fbResponse = await fetch(fbUrl);
          
          if (!fbResponse.ok) {
            console.error(`Facebook API error for flow form ${info.formId}:`, await fbResponse.text());
            continue;
          }
          
          const fbData = await fbResponse.json();
          const leads = fbData.data || [];
          console.log(`Retrieved ${leads.length} leads from Facebook for flow form ${info.formId}`);
          
          for (const fbLead of leads) {
            const leadgenId = fbLead.id;
            
            // Dedup check: first check flow_processed_leads table (per-flow dedup)
            const { data: alreadyProcessed } = await supabase
              .from('flow_processed_leads')
              .select('id')
              .eq('automation_id', info.automationId)
              .eq('leadgen_id', leadgenId)
              .limit(1);
            
            if (alreadyProcessed && alreadyProcessed.length > 0) {
              totalSkipped++;
              continue;
            }
            
            // Also check CRM leads table (backward compat)
            const { data: existing } = await supabase
              .from('leads')
              .select('id')
              .eq('tenant_id', info.tenantId)
              .or(`notes.ilike.%${leadgenId}%,notes.ilike.%Facebook Lead ID: ${leadgenId}%`)
              .limit(1);
            
            if (existing && existing.length > 0) {
              totalSkipped++;
              continue;
            }
            
            // Check deleted
            const { data: deleted } = await supabase
              .from('deleted_facebook_leads')
              .select('id')
              .eq('tenant_id', info.tenantId)
              .eq('leadgen_id', leadgenId)
              .limit(1);
            
            if (deleted && deleted.length > 0) {
              totalSkipped++;
              continue;
            }
            
            // Parse fields
            const fieldData: Record<string, string> = {};
            if (fbLead.field_data) {
              for (const field of fbLead.field_data) {
                fieldData[field.name] = field.values?.[0] || '';
              }
            }
            
            // Map fields by type using facebook_form_fields from trigger config
            const formFields = (triggerStep?.configuration as any)?.facebook_form_fields || [];
            let mappedName: string | null = null;
            let mappedPhone: string | null = null;
            let mappedEmail: string | null = null;
            
            for (const ff of formFields) {
              const val = fieldData[ff.key] || fieldData[ff.label] || '';
              if (!val) continue;
              if (ff.type === 'FULL_NAME') mappedName = val;
              else if (ff.type === 'PHONE') mappedPhone = val;
              else if (ff.type === 'EMAIL') mappedEmail = val;
              else if (ff.type === 'CUSTOM') {
                // Heuristic: check label/key for name/phone/email keywords
                const lbl = (ff.label || ff.key || '').toLowerCase();
                if (!mappedName && (lbl.includes('שם') || lbl.includes('name'))) mappedName = val;
                if (!mappedPhone && (lbl.includes('טלפון') || lbl.includes('phone') || lbl.includes('נייד'))) mappedPhone = val;
                if (!mappedEmail && (lbl.includes('אימייל') || lbl.includes('דוא') || lbl.includes('email') || lbl.includes('mail'))) mappedEmail = val;
              }
            }
            
            const resolvedName = mappedName || fieldData.full_name || fieldData.company || fieldData.name || null;
            const resolvedContact = mappedName || fieldData.full_name || `${fieldData.first_name || ''} ${fieldData.last_name || ''}`.trim() || null;
            
            // Build notes with actual field values for later enrichment
            const notesLines = [`leadgen_id: ${leadgenId}`, `Facebook Form: ${info.formId}`];
            for (const [k, v] of Object.entries(fieldData)) {
              if (v) notesLines.push(`fb_${k}: ${v}`);
            }
            notesLines.push(`Created: ${fbLead.created_time || 'unknown'}`, 'Source: Flow-based sync');
            
            const leadRecord: Record<string, any> = {
              tenant_id: info.tenantId,
              source: 'paid_ads',
              status: 'new',
              notes: notesLines.join('\n'),
              company_name: resolvedName || 'ליד מפייסבוק',
              contact_name: resolvedContact,
              email: mappedEmail || fieldData.email || null,
              phone: mappedPhone || fieldData.phone_number || fieldData.phone || null,
            };
            
            const { data: newLead, error: insertError } = await supabase
              .from('leads')
              .insert(leadRecord)
              .select()
              .single();
            
            if (insertError) {
              errors.push(`Flow lead ${leadgenId}: ${insertError.message}`);
              continue;
            }
            
            console.log(`✅ Flow-synced lead created: ${newLead.id}`);
            totalSynced++;
            
            // Build fb_ fields for trigger payload
            const fbFields: Record<string, string> = {};
            for (const [k, v] of Object.entries(fieldData)) {
              fbFields[`fb_${k}`] = v;
            }
            
            // Trigger automation
            try {
              await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  trigger_type: 'lead_created',
                  data: {
                    id: newLead.id,
                    lead_id: newLead.id,
                    company_name: newLead.company_name,
                    contact_name: newLead.contact_name,
                    phone: newLead.phone,
                    email: newLead.email,
                    status: newLead.status,
                    source: newLead.source,
                    agency_id: newLead.agency_id,
                    facebook_form_id: info.formId,
                    ...fbFields,
                  },
                  tenant_id: info.tenantId,
                }),
              });
              console.log(`✅ Flow lead_created automation triggered for ${newLead.id}`);
            } catch (e) {
              console.error('Flow automation trigger error:', e);
            }
            
            // Record in flow_processed_leads for dedup
            await supabase.from('flow_processed_leads').insert({
              automation_id: info.automationId,
              tenant_id: info.tenantId,
              leadgen_id: leadgenId,
              facebook_form_id: info.formId,
            });
          }
        } catch (formError) {
          console.error(`Error processing flow form ${info.formId}:`, formError);
          errors.push(`Flow form ${info.formId}: ${formError}`);
        }
      }
    }
    // ========== END PASS 2 ==========

    console.log(`\n✅ Sync completed: ${totalSynced} synced, ${totalSkipped} skipped, ${errors.length} errors`);

    return new Response(JSON.stringify({
      success: true,
      synced: totalSynced,
      skipped: totalSkipped,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Fatal error in cron sync:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
