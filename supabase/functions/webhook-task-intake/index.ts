import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskPayload {
  tenant_slug?: string
  tenant_id?: string
  title: string
  notes?: string
  due_date?: string
  due_time?: string
  priority?: number
  campaigner_name?: string
  campaigner_id?: string
  client_name?: string
  client_id?: string
  agency_id?: string
  lead_name?: string
  lead_id?: string
  sales_person_name?: string
  sales_person_id?: string
  status?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🔔 Webhook task intake received')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse incoming data
    const payload: TaskPayload = await req.json()
    console.log('📦 Received payload:', JSON.stringify(payload, null, 2))

    // Validate required field
    if (!payload.title) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required field: title',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    let tenantId: string | null = payload.tenant_id || null
    let agencyId: string | null = payload.agency_id || null
    
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

    // Validate tenant identification
    if (!tenantId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing tenant identification. Please provide tenant_slug or tenant_id in the payload.',
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Find agency if not provided
    if (!agencyId) {
      console.log(`🔍 Finding default agency for tenant: ${tenantId}`)
      
      // Try to find the default agency
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
          console.log(`✅ Found first active agency: ${firstAgency.name}`)
        }
      }
    }

    // Resolve campaigner by name if provided
    let campaignerId: string | null = payload.campaigner_id || null
    if (!campaignerId && payload.campaigner_name && tenantId) {
      console.log(`🔍 Searching for campaigner: "${payload.campaigner_name}"`)
      const { data: campaignerData } = await supabase
        .from('campaigners')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${payload.campaigner_name}%`)
        .limit(1)
        .maybeSingle()
      
      if (campaignerData) {
        campaignerId = campaignerData.id
        console.log(`✅ Found campaigner: ${campaignerData.full_name} (${campaignerId})`)
      } else {
        console.log(`⚠️ Campaigner not found for name: "${payload.campaigner_name}"`)
      }
    }

    // Resolve client by name if provided
    let clientId: string | null = payload.client_id || null
    if (!clientId && payload.client_name && tenantId) {
      console.log(`🔍 Searching for client: "${payload.client_name}"`)
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${payload.client_name}%`)
        .limit(1)
        .maybeSingle()
      
      if (clientData) {
        clientId = clientData.id
        console.log(`✅ Found client: ${clientData.name} (${clientId})`)
      } else {
        console.log(`⚠️ Client not found for name: "${payload.client_name}"`)
      }
    }

    // Resolve lead by name if provided
    let leadId: string | null = payload.lead_id || null
    if (!leadId && payload.lead_name && tenantId) {
      console.log(`🔍 Searching for lead: "${payload.lead_name}"`)
      const { data: leadData } = await supabase
        .from('leads')
        .select('id, company_name')
        .eq('tenant_id', tenantId)
        .ilike('company_name', `%${payload.lead_name}%`)
        .limit(1)
        .maybeSingle()
      
      if (leadData) {
        leadId = leadData.id
        console.log(`✅ Found lead: ${leadData.company_name} (${leadId})`)
      } else {
        console.log(`⚠️ Lead not found for name: "${payload.lead_name}"`)
      }
    }

    // Resolve sales person by name if provided
    let salesPersonId: string | null = payload.sales_person_id || null
    if (!salesPersonId && payload.sales_person_name && tenantId) {
      console.log(`🔍 Searching for sales person: "${payload.sales_person_name}"`)
      const { data: salesPersonData } = await supabase
        .from('sales_people')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${payload.sales_person_name}%`)
        .limit(1)
        .maybeSingle()
      
      if (salesPersonData) {
        salesPersonId = salesPersonData.id
        console.log(`✅ Found sales person: ${salesPersonData.full_name} (${salesPersonId})`)
      } else {
        console.log(`⚠️ Sales person not found for name: "${payload.sales_person_name}"`)
      }
    }

    // Build task record
    const taskRecord: any = {
      title: payload.title,
      notes: payload.notes || null,
      due_date: payload.due_date || null,
      due_time: payload.due_time || null,
      priority: payload.priority || 5,
      status: payload.status || 'open',
      tenant_id: tenantId,
      agency_id: agencyId,
      campaigner_id: campaignerId,
      client_id: clientId,
      lead_id: leadId,
      sales_person_id: salesPersonId,
    }

    console.log('📝 Creating task:', JSON.stringify(taskRecord, null, 2))

    // Insert task
    const { data: task, error } = await supabase
      .from('tasks')
      .insert(taskRecord)
      .select()
      .single()

    if (error) {
      console.error('❌ Error inserting task:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create task',
          details: error.message,
          code: error.code
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('✅ Task created successfully:', task.id)

    // Trigger task_assigned automation if campaigner was assigned
    if (campaignerId && tenantId) {
      try {
        const automationResponse = await fetch(`${supabaseUrl}/functions/v1/trigger-automation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            trigger_type: 'task_assigned',
            data: {
              id: task.id,
              task_id: task.id,
              title: task.title,
              notes: task.notes,
              due_date: task.due_date,
              due_time: task.due_time,
              priority: task.priority,
              status: task.status,
              campaigner_id: campaignerId,
              client_id: clientId,
            },
            tenant_id: tenantId,
          }),
        });
        
        if (automationResponse.ok) {
          console.log('✅ task_assigned automation triggered successfully');
        } else {
          console.error('⚠️ Failed to trigger automation:', await automationResponse.text());
        }
      } catch (automationError) {
        console.error('⚠️ Error triggering task_assigned automation:', automationError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        task_id: task.id,
        message: 'Task created successfully',
        matched: {
          campaigner: campaignerId ? true : false,
          client: clientId ? true : false,
          lead: leadId ? true : false,
          sales_person: salesPersonId ? true : false,
        }
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
