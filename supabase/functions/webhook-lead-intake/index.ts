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
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Webhook lead intake received')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse incoming data
    const payload: LeadPayload = await req.json()
    console.log('Received payload:', payload)

    // No required fields - accept all leads even with empty fields

    // Get default agency if not provided
    let agencyId = payload.agency_id
    let tenantId: string | null = null
    
    if (!agencyId) {
      const { data: agencies, error: agencyError } = await supabase
        .from('agencies')
        .select('id, tenant_id')
        .eq('status', 'active')
        .limit(1)
      
      console.log('Default agency query result:', agencies, agencyError)
      
      if (agencies && agencies.length > 0) {
        agencyId = agencies[0].id
        tenantId = agencies[0].tenant_id
      }
    } else {
      // Get tenant_id for the provided agency
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('tenant_id')
        .eq('id', agencyId)
        .single()
      
      console.log('Agency tenant_id query result:', agency, agencyError)
      
      if (agency) {
        tenantId = agency.tenant_id
      }
    }
    
    console.log('Final agencyId:', agencyId, 'tenantId:', tenantId)

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
        status: 'new'
      })
      .select()
      .single()

    if (error) {
      console.error('Error inserting lead:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Lead created successfully:', lead.id)

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
    console.error('Webhook error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
