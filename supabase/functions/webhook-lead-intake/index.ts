import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LeadPayload {
  company_name: string
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

    // No required fields - accept all leads even with empty fields

    // Get default agency if not provided - default to "promo"
    let agencyId = payload.agency_id
    let tenantId: string | null = null
    
    if (!agencyId) {
      console.log('🔍 No agency_id provided, searching for "promo" agency...')
      
      // Look for "promo" agency first
      const { data: agencies, error: agencyError } = await supabase
        .from('agencies')
        .select('id, tenant_id, name')
        .eq('status', 'active')
        .ilike('name', '%promo%')
        .limit(1)
      
      if (agencyError) {
        console.error('❌ Error querying promo agency:', agencyError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Database error while searching for agency',
            details: agencyError.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      console.log('📊 Promo agency query result:', agencies)
      
      if (agencies && agencies.length > 0) {
        agencyId = agencies[0].id
        tenantId = agencies[0].tenant_id
        console.log(`✅ Found promo agency: ${agencies[0].name} (${agencyId})`)
      } else {
        console.log('⚠️ No promo agency found, trying any active agency...')
        
        // Fallback to any active agency if promo not found
        const { data: fallbackAgencies, error: fallbackError } = await supabase
          .from('agencies')
          .select('id, tenant_id, name')
          .eq('status', 'active')
          .limit(1)
        
        if (fallbackError) {
          console.error('❌ Error querying fallback agency:', fallbackError)
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: 'Database error while searching for fallback agency',
              details: fallbackError.message
            }),
            { 
              status: 500, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
        
        if (fallbackAgencies && fallbackAgencies.length > 0) {
          agencyId = fallbackAgencies[0].id
          tenantId = fallbackAgencies[0].tenant_id
          console.log(`✅ Found fallback agency: ${fallbackAgencies[0].name} (${agencyId})`)
        } else {
          console.log('❌ No active agencies found at all')
        }
      }
    } else {
      console.log(`🔑 Agency ID provided: ${agencyId}`)
      
      // Get tenant_id for the provided agency
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('tenant_id')
        .eq('id', agencyId)
        .single()
      
      if (agencyError) {
        console.error('❌ Error querying agency tenant_id:', agencyError)
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Database error while getting agency details',
            details: agencyError.message
          }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
      
      if (agency) {
        tenantId = agency.tenant_id
        console.log(`✅ Found tenant_id: ${tenantId}`)
      } else {
        console.log('⚠️ Agency not found')
      }
    }
    
    console.log(`📍 Final - agencyId: ${agencyId}, tenantId: ${tenantId}`)

    if (!agencyId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active agency found' 
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
