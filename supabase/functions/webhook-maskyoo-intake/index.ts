import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize phone for comparison and storage
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  // Handle Israeli phones
  if (cleaned.startsWith('972')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('0')) {
    // Already in local format
  } else if (cleaned.length === 9) {
    // Assume missing leading 0
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

// Format phone for storage (with country code)
function formatPhoneForStorage(phone: string | null | undefined): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  // Store in format 972XXXXXXXXX
  if (normalized.startsWith('0')) {
    return '972' + normalized.slice(1);
  }
  return normalized;
}

// Compare two phone numbers ignoring formatting differences
function phonesMatch(phone1: string | null | undefined, phone2: string | null | undefined): boolean {
  const n1 = normalizePhone(phone1);
  const n2 = normalizePhone(phone2);
  if (!n1 || !n2) return false;
  return n1 === n2;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('📞 Maskyoo webhook received - method:', req.method)
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Extract parameters from URL (query string) and body
    const url = new URL(req.url)
    const queryParams: Record<string, string> = {}
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value
    })
    
    console.log('🔗 Query params:', JSON.stringify(queryParams))

    // For POST, also try to parse body (could be form-data, JSON, or x-www-form-urlencoded)
    let bodyParams: Record<string, string> = {}
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || ''
      
      try {
        if (contentType.includes('application/json')) {
          bodyParams = await req.json()
        } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
          const formData = await req.formData()
          formData.forEach((value, key) => {
            if (typeof value === 'string') {
              bodyParams[key] = value
            }
          })
        } else {
          // Try JSON anyway
          const text = await req.text()
          if (text) {
            try {
              bodyParams = JSON.parse(text)
            } catch {
              // Parse as URL-encoded
              const pairs = text.split('&')
              for (const pair of pairs) {
                const [key, value] = pair.split('=')
                if (key) {
                  bodyParams[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('⚠️ Could not parse body:', e)
      }
    }
    
    console.log('📦 Body params:', JSON.stringify(bodyParams))

    // Merge query and body params (query takes precedence for conflict)
    const allParams = { ...bodyParams, ...queryParams }
    console.log('📋 All params:', JSON.stringify(allParams))

    // Extract tenant_id (required) - clean up any query string artifacts
    let tenantId = allParams.tenant_id || allParams.tenantId || allParams.tid || ''
    // Remove any query string artifacts that Maskyoo might append (e.g., "?event=hangup")
    if (tenantId.includes('?')) {
      tenantId = tenantId.split('?')[0]
    }
    if (!tenantId) {
      console.error('❌ Missing tenant_id parameter')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing tenant_id parameter. Add ?tenant_id=YOUR_TENANT_ID to the URL.',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('id', tenantId)
      .single()
    
    if (tenantError || !tenant) {
      console.error('❌ Tenant not found:', tenantId)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Tenant not found',
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    console.log(`✅ Tenant verified: ${tenant.name}`)

    // Extract Maskyoo parameters
    // Phone: cli (standard Maskyoo param), caller, phone, caller_phone, callerid
    const rawPhone = allParams.cli || allParams.cli_unformatted || allParams.caller || allParams.phone || allParams.caller_phone || allParams.callerid || ''
    const phone = normalizePhone(rawPhone)
    
    if (!phone) {
      console.error('❌ No phone number found in parameters')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No phone number found. Expected parameter: caller or phone',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    console.log(`📱 Phone extracted: ${rawPhone} -> normalized: ${phone}`)

    // Description: description, desc, source
    const description = allParams.description || allParams.desc || allParams.source || ''
    
    // Maskyoo number: maskyoo, maskyoo_number
    const maskyooNumber = allParams.maskyoo || allParams.maskyoo_number || ''
    
    // Contact name from private_field1
    const contactName = allParams.private_field1 || allParams.contact_name || allParams.name || ''
    
    // Call status: call_status, status
    const callStatus = allParams.call_status || allParams.status || ''
    
    // Call duration
    const callDuration = allParams.call_duration || allParams.duration || ''

    // Check filter option (if only missed calls should be processed)
    const onlyMissedCalls = allParams.only_missed === 'true' || allParams.filter === 'missed'
    if (onlyMissedCalls) {
      // Common values for answered calls
      const answeredStatuses = ['answered', 'success', 'completed', 'נענתה']
      if (answeredStatuses.some(s => callStatus.toLowerCase().includes(s))) {
        console.log(`🔕 Skipping answered call (status: ${callStatus})`)
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Call was answered - skipped per filter settings',
            skipped: true
          }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    console.log(`📝 Extracted data:`, {
      phone,
      description,
      maskyooNumber,
      contactName,
      callStatus,
      callDuration,
    })

    // Find default or first agency for this tenant
    let agencyId: string | null = null
    
    // Try to find default agency
    const { data: defaultAgency } = await supabase
      .from('agencies')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    
    if (defaultAgency) {
      agencyId = defaultAgency.id
      console.log(`✅ Found default agency: ${defaultAgency.name}`)
    } else {
      // Fallback to first active agency
      const { data: firstAgency } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (firstAgency) {
        agencyId = firstAgency.id
        console.log(`✅ Found first agency: ${firstAgency.name}`)
      }
    }

    if (!agencyId) {
      console.error('❌ No active agency found for tenant')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No active agency found for this tenant',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check for existing lead by phone (deduplication)
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('tenant_id', tenantId)
    
    const existingLead = existingLeads?.find(l => phonesMatch(l.phone, phone))
    
    if (existingLead) {
      console.log(`📌 Found existing lead: ${existingLead.id} (${existingLead.company_name})`)
      
      // Optionally append note about new call
      const newNote = `[${new Date().toISOString()}] שיחה נכנסת מ-Maskyoo${maskyooNumber ? ` (${maskyooNumber})` : ''}${callStatus ? ` - סטטוס: ${callStatus}` : ''}${callDuration ? ` - משך: ${callDuration}` : ''}`
      
      const existingNotes = existingLead.notes || ''
      const updatedNotes = existingNotes 
        ? `${existingNotes}\n${newNote}` 
        : newNote
      
      const updates: Record<string, any> = {
        notes: updatedNotes,
        updated_at: new Date().toISOString()
      }
      
      // Update contact name if not set
      if (!existingLead.contact_name && contactName) {
        updates.contact_name = contactName
      }
      
      await supabase
        .from('leads')
        .update(updates)
        .eq('id', existingLead.id)
      
      console.log(`✅ Updated existing lead with new call info`)
      
      // Trigger automations for existing lead
      try {
        await supabase.functions.invoke('trigger-automation', {
          body: {
            trigger_type: 'inbound_webhook_lead',
            tenant_id: tenantId,
            data: {
              lead_id: existingLead.id,
              phone,
              source: 'maskyoo',
              is_update: true,
            }
          }
        })
      } catch (automationError) {
        console.error('⚠️ Failed to trigger automation:', automationError)
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          lead_id: existingLead.id,
          message: 'Existing lead updated with call info',
          duplicate: true,
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get first pipeline stage for new leads
    const { data: firstStage } = await supabase
      .from('lead_pipeline_stages')
      .select('stage_key')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(1)
      .maybeSingle()
    
    const initialStatus = firstStage?.stage_key || 'new'

    // Build company_name from description or maskyoo number
    let companyName = description || `ליד מ-Maskyoo`
    if (maskyooNumber && !description) {
      companyName = `שיחה למספר ${maskyooNumber}`
    }

    // Build notes
    let notes = ''
    if (maskyooNumber) {
      notes += `מספר Maskyoo: ${maskyooNumber}\n`
    }
    if (callStatus) {
      notes += `סטטוס שיחה: ${callStatus}\n`
    }
    if (callDuration) {
      notes += `משך שיחה: ${callDuration}\n`
    }
    notes += `נקלט: ${new Date().toLocaleString('he-IL')}`

    // Create new lead
    const { data: lead, error: insertError } = await supabase
      .from('leads')
      .insert({
        company_name: companyName,
        contact_name: contactName || null,
        phone: formatPhoneForStorage(phone),
        source: 'cold_call', // Maskyoo calls map to cold_call enum
        notes: notes.trim(),
        agency_id: agencyId,
        tenant_id: tenantId,
        status: initialStatus,
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creating lead:', insertError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create lead',
          details: insertError.message,
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Lead created successfully:', lead.id)

    // Trigger automations for new lead
    try {
      await supabase.functions.invoke('trigger-automation', {
        body: {
          trigger_type: 'inbound_webhook_lead',
          tenant_id: tenantId,
          data: {
            lead_id: lead.id,
            phone,
            source: 'maskyoo',
            is_new: true,
          }
        }
      })
      console.log('🤖 Automation triggered')
    } catch (automationError) {
      console.error('⚠️ Failed to trigger automation:', automationError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        lead_id: lead.id,
        message: 'Lead created successfully',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: unknown) {
    console.error('❌ Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        details: errorMessage,
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
