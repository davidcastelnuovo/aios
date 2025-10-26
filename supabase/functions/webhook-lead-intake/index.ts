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
    if (!agencyId) {
      const { data: agencies } = await supabase
        .from('agencies')
        .select('id')
        .eq('status', 'active')
        .limit(1)
      
      if (agencies && agencies.length > 0) {
        agencyId = agencies[0].id
      }
    }

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
