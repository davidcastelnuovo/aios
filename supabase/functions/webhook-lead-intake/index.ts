import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadPayload {
  company_name?: string
  contact_name?: string
  email?: string
  phone?: string
  source?: string
  notes?: string
  monthly_budget?: number
  three_month_budget?: number
  products?: string
  industry?: string
  agency_id?: string
  manychat_subscriber_id?: string
  tag_name?: string
  tenant_slug?: string
  tenant_id?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔔 Webhook lead intake received')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse incoming data
    const payload: LeadPayload = await req.json()
    console.log('📦 Received payload:', JSON.stringify(payload, null, 2))

    let agencyId = payload.agency_id
    let tenantId: string | null = payload.tenant_id || null
    
    // Resolve tenant from tenant_slug if provided
    if (!tenantId && payload.tenant_slug) {
      console.log(`🔍 Resolving tenant from slug: "${payload.tenant_slug}"`)
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', payload.tenant_slug)
        .single()
      
      if (tenantError || !tenantData) {
        console.error('❌ Tenant not found for slug:', payload.tenant_slug)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Tenant not found for slug: ${payload.tenant_slug}`,
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      tenantId = tenantData.id
      console.log(`✅ Resolved tenant_id: ${tenantId}`)
    }

    // If agency_id is provided, use it and get tenant_id from it
    if (agencyId) {
      console.log(`🔑 Agency ID provided: ${agencyId}`)
      
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('tenant_id')
        .eq('id', agencyId)
        .single()
      
      if (agencyError) {
        console.error('❌ Error querying agency:', agencyError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Agency not found',
            details: agencyError.message
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      tenantId = agency.tenant_id
      console.log(`✅ Found tenant_id from agency: ${tenantId}`)
    } 
    // If no agency_id but we have tenant_id, find the default or first agency
    else if (tenantId) {
      console.log(`🔍 Finding agency for tenant: ${tenantId}`)
      
      // First, try to find the default agency for this tenant
      const { data: defaultAgency, error: defaultError } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .eq('is_default', true)
        .limit(1)
        .maybeSingle()
      
      if (defaultError) {
        console.error('⚠️ Error querying default agency:', defaultError)
      }
      
      if (defaultAgency) {
        agencyId = defaultAgency.id
        console.log(`✅ Found default agency: ${defaultAgency.name} (${agencyId})`)
      } else {
        console.log('⚠️ No default agency found, trying first active agency...')
        
        // Fallback to first active agency in this tenant
        const { data: firstAgency, error: firstError } = await supabase
          .from('agencies')
          .select('id, name')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        
        if (firstError) {
          console.error('❌ Error querying first agency:', firstError)
        }
        
        if (firstAgency) {
          agencyId = firstAgency.id
          console.log(`✅ Found first active agency: ${firstAgency.name} (${agencyId})`)
        } else {
          console.log('❌ No active agencies found for this tenant')
        }
      }
    } else {
      // No tenant identification provided
      console.error('❌ No tenant_slug, tenant_id, or agency_id provided')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing tenant identification. Please provide tenant_slug, tenant_id, or agency_id in the payload.',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    console.log(`📍 Final - agencyId: ${agencyId}, tenantId: ${tenantId}`)

    if (!agencyId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active agency found for this tenant. Please create an agency first or mark one as default.' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Map source if needed
    const sourceMap: Record<string, string> = {
      'website': 'website',
      'אתר': 'website',
      'form': 'website',
      'contact_form': 'website',
      'make': 'other',
      'zapier': 'other',
      'referral': 'referral',
      'linkedin': 'linkedin',
      'facebook': 'facebook',
      'ווטסאפ': 'whatsapp',
      'whatsapp': 'whatsapp',
    }
    
    const leadSource = payload.source 
      ? (sourceMap[payload.source.toLowerCase()] || 'other')
      : 'other'

    // Insert lead - all fields optional
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        company_name: payload.company_name || '',
        contact_name: payload.contact_name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        source: leadSource,
        notes: payload.notes || null,
        monthly_budget: payload.monthly_budget || null,
        three_month_budget: payload.three_month_budget || null,
        products: payload.products || null,
        industry: payload.industry || null,
        agency_id: agencyId,
        tenant_id: tenantId,
        manychat_subscriber_id: payload.manychat_subscriber_id || null,
        status: 'new'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error inserting lead:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create lead',
          details: error.message,
          code: error.code
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Lead created successfully:', lead.id)

    // Handle tag_name - find or create tag and apply it
    if (payload.tag_name && tenantId) {
      try {
        const tagName = payload.tag_name.trim()
        console.log(`🏷️ Processing tag_name: "${tagName}"`)
        
        // Check if tag exists
        const { data: existingTag, error: tagQueryError } = await supabase
          .from('chat_tags')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('name', tagName)
          .maybeSingle()
        
        if (tagQueryError) {
          console.error('⚠️ Error querying existing tag:', tagQueryError)
        } else {
          let tagId = existingTag?.id
          
          // Create tag if it doesn't exist
          if (!tagId) {
            console.log(`🆕 Creating new tag: "${tagName}"`)
            const { data: newTag, error: createTagError } = await supabase
              .from('chat_tags')
              .insert({
                tenant_id: tenantId,
                name: tagName,
                color: '#3b82f6' // default blue color
              })
              .select('id')
              .single()
            
            if (createTagError) {
              console.error('⚠️ Error creating tag:', createTagError)
            } else {
              tagId = newTag.id
              console.log(`✅ Tag created with id: ${tagId}`)
            }
          } else {
            console.log(`✅ Found existing tag with id: ${tagId}`)
          }
          
          // Apply tag to lead
          if (tagId) {
            const { error: applyTagError } = await supabase
              .from('chat_contact_tags')
              .insert({
                tenant_id: tenantId,
                tag_id: tagId,
                lead_id: lead.id,
                user_id: '00000000-0000-0000-0000-000000000000' // system user placeholder
              })
            
            if (applyTagError) {
              console.error('⚠️ Error applying tag to lead:', applyTagError)
            } else {
              console.log(`✅ Tag applied to lead ${lead.id}`)
            }
          }
        }
      } catch (tagError) {
        console.error('⚠️ Error processing tag:', tagError)
      }
    }

    // Trigger lead_created automation
    if (tenantId) {
      try {
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_type: 'lead_created',
            data: {
              id: lead.id,
              lead_id: lead.id,
              company_name: lead.company_name,
              contact_name: lead.contact_name,
              phone: lead.phone,
              email: lead.email,
              status: lead.status,
              source: lead.source,
              agency_id: lead.agency_id,
            },
            tenant_id: tenantId,
          }),
        });
        
        if (automationResponse.ok) {
          console.log('✅ lead_created automation triggered successfully');
        } else {
          console.error('⚠️ Failed to trigger automation:', await automationResponse.text());
        }
      } catch (automationError) {
        console.error('⚠️ Error triggering lead_created automation:', automationError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead created successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('💥 Webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
