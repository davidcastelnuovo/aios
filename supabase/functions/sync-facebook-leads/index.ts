import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { tenant_id, integration_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Syncing Facebook leads for tenant:', tenant_id, 'integration:', integration_id);

    // Get Facebook integrations for this tenant (both own and shared)
    let query = supabase
      .from('tenant_integrations')
      .select('*')
      .eq('integration_type', 'facebook_lead_ads')
      .eq('is_active', true);

    if (integration_id) {
      query = query.eq('id', integration_id);
    } else {
      query = query.eq('tenant_id', tenant_id);
    }

    const { data: integrations, error: intError } = await query;

    if (intError) {
      console.error('Error fetching integrations:', intError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch integrations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!integrations || integrations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No Facebook integrations found', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let totalSynced = 0;
    let totalSkipped = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      let accessToken = integration.api_key;
      const settings = integration.settings as any;

      // Check for shared connection
      if (integration.shared_from_integration_id) {
        const { data: sourceIntegration } = await supabase
          .from('tenant_integrations')
          .select('api_key')
          .eq('id', integration.shared_from_integration_id)
          .single();

        if (sourceIntegration?.api_key) {
          accessToken = sourceIntegration.api_key;
        }
      }

      if (!accessToken) {
        console.log('No access token for integration:', integration.id);
        errors.push(`Integration ${integration.id}: No access token`);
        continue;
      }

      const formMappings = settings?.form_mappings || {};
      
      if (Object.keys(formMappings).length === 0) {
        console.log('No form mappings for integration:', integration.id);
        continue;
      }

      // Process each mapped form
      for (const [formId, mapping] of Object.entries(formMappings)) {
        const formMapping = mapping as any;
        
        try {
          console.log('Fetching leads for form:', formId);
          
          // Fetch leads from Facebook - get last 30 days
          const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
          const leadsUrl = `https://graph.facebook.com/v21.0/${formId}/leads?access_token=${accessToken}&filtering=[{"field":"time_created","operator":"GREATER_THAN","value":${since}}]&limit=500`;
          
          const leadsResponse = await fetch(leadsUrl);
          const leadsData = await leadsResponse.json();

          if (leadsData.error) {
            console.error('Facebook API error for form', formId, ':', leadsData.error);
            errors.push(`Form ${formId}: ${leadsData.error.message}`);
            continue;
          }

          const leads = leadsData.data || [];
          console.log(`Found ${leads.length} leads for form ${formId}`);

          for (const lead of leads) {
            const leadgenId = lead.id;

            // Parse lead fields early to check for duplicates
            const fieldData: Record<string, string> = {};
            for (const field of lead.field_data || []) {
              fieldData[field.name] = field.values?.[0] || '';
            }
            
            const leadPhone = fieldData.phone_number || fieldData.phone || '';
            const leadEmail = fieldData.email || '';

            // Check if this lead already exists by leadgen_id
            const { data: existingByLeadgenId } = await supabase
              .from('leads')
              .select('id')
              .eq('tenant_id', integration.tenant_id)
              .ilike('notes', `%${leadgenId}%`)
              .maybeSingle();

            if (existingByLeadgenId) {
              console.log('Skipping duplicate lead (by leadgen_id):', leadgenId);
              totalSkipped++;
              continue;
            }

            // Check by phone number (normalize to last 9 digits)
            if (leadPhone) {
              const normalizedPhone = leadPhone.replace(/\D/g, '').slice(-9);
              if (normalizedPhone.length >= 9) {
                const { data: existingByPhone } = await supabase
                  .from('leads')
                  .select('id, phone')
                  .eq('tenant_id', integration.tenant_id)
                  .not('phone', 'is', null);
                
                const phoneMatch = existingByPhone?.find(l => {
                  const existingNormalized = (l.phone || '').replace(/\D/g, '').slice(-9);
                  return existingNormalized === normalizedPhone;
                });
                
                if (phoneMatch) {
                  console.log('Skipping duplicate lead (by phone):', leadPhone, '-> existing lead:', phoneMatch.id);
                  totalSkipped++;
                  continue;
                }
              }
            }

            // Check by email
            if (leadEmail) {
              const { data: existingByEmail } = await supabase
                .from('leads')
                .select('id')
                .eq('tenant_id', integration.tenant_id)
                .ilike('email', leadEmail)
                .maybeSingle();

              if (existingByEmail) {
                console.log('Skipping duplicate lead (by email):', leadEmail);
                totalSkipped++;
                continue;
              }
            }

            // Map fields based on form mapping (fieldData already parsed above)

            // Map fields based on form mapping
            const fieldMappings = formMapping.fields || {};
            const leadRecord: Record<string, any> = {
              company_name: fieldData.company || fieldData.full_name || fieldData.first_name || 'Facebook Lead',
              source: 'paid_ads',
              status: 'new',
              tenant_id: integration.tenant_id,
              agency_id: formMapping.agency_id || null,
              sales_person_id: formMapping.sales_person_id || null,
              notes: `Facebook Lead ID: ${leadgenId}\nForm ID: ${formId}\nSource: Facebook Lead Ads\nCreated: ${lead.created_time}`,
            };

            // Apply custom field mappings
            for (const [fbField, systemField] of Object.entries(fieldMappings)) {
              if (systemField === 'skip' || !systemField) continue;
              
              const value = fieldData[fbField];
              if (value) {
                if (systemField === 'notes') {
                  leadRecord.notes = (leadRecord.notes || '') + `\n${fbField}: ${value}`;
                } else {
                  leadRecord[systemField as string] = value;
                }
              }
            }

            // Fallback mappings for common fields
            if (!leadRecord.contact_name) {
              leadRecord.contact_name = fieldData.full_name 
                || `${fieldData.first_name || ''} ${fieldData.last_name || ''}`.trim()
                || fieldData.name
                || null;
            }
            if (!leadRecord.email && fieldData.email) {
              leadRecord.email = fieldData.email;
            }
            if (!leadRecord.phone && (fieldData.phone_number || fieldData.phone)) {
              leadRecord.phone = fieldData.phone_number || fieldData.phone;
            }

            // Insert the lead
            const { data: newLead, error: insertError } = await supabase
              .from('leads')
              .insert(leadRecord)
              .select('id')
              .single();

            if (insertError) {
              console.error('Error inserting lead:', insertError);
              errors.push(`Lead ${leadgenId}: ${insertError.message}`);
            } else {
              console.log('Inserted lead:', leadgenId);
              totalSynced++;

              // Apply tag if configured
              if (formMapping.tag_id) {
                const { error: tagError } = await supabase
                  .from('chat_contact_tags')
                  .insert({
                    tag_id: formMapping.tag_id,
                    lead_id: newLead.id,
                    tenant_id: integration.tenant_id,
                    user_id: '00000000-0000-0000-0000-000000000000', // System user placeholder
                  });
                
                if (tagError) {
                  console.error('Error applying tag to lead:', tagError);
                } else {
                  console.log('Tag applied to lead:', formMapping.tag_id);
                }
              }
            }
          }
        } catch (formError) {
          console.error('Error processing form', formId, ':', formError);
          errors.push(`Form ${formId}: ${formError instanceof Error ? formError.message : 'Unknown error'}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: totalSynced, 
        skipped: totalSkipped,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-facebook-leads:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
