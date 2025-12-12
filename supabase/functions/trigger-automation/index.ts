import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutomationPayload {
  trigger_type: string
  data: any
  tenant_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const payload: AutomationPayload = await req.json()
    console.log('Automation triggered:', payload)

    // Find active automations matching this trigger
    const { data: automations, error: fetchError } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', payload.trigger_type)
      .eq('tenant_id', payload.tenant_id)
      .eq('active', true)

    if (fetchError) {
      console.error('Error fetching automations:', fetchError)
      throw fetchError
    }

    console.log(`Found ${automations?.length || 0} active automations`)

    // Execute each matching automation
    const results = await Promise.allSettled(
      (automations || []).map(async (automation) => {
        const startTime = Date.now()
        
        try {
          // Check conditions if any
          if (automation.conditions && Object.keys(automation.conditions).length > 0) {
            const conditionsMet = checkConditions(automation.conditions, payload.data)
            if (!conditionsMet) {
              console.log(`Conditions not met for automation ${automation.id}`)
              return
            }
          }

          // Execute action based on type
          let response: any
          if (automation.action_type === 'webhook') {
            response = await executeWebhook(automation.configuration, payload.data)
          } else if (automation.action_type === 'email') {
            response = await executeEmail(automation.configuration, payload.data)
          } else if (automation.action_type === 'notification') {
            response = await executeNotification(automation.configuration, payload.data)
          } else if (automation.action_type === 'update_status') {
            response = await executeStatusUpdate(supabase, automation.configuration, payload.data)
          } else if (automation.action_type === 'send_whatsapp') {
            response = await executeSendWhatsapp(supabase, automation.configuration, payload.data, payload.tenant_id)
          } else if (automation.action_type === 'create_manychat_subscriber') {
            response = await executeCreateManychatSubscriber(supabase, automation.configuration, payload.data, payload.tenant_id)
          }

          const executionTime = Date.now() - startTime

          // Log success
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: true,
            payload: payload.data,
            response: response,
            execution_time_ms: executionTime,
          })

          return { success: true, automation_id: automation.id }
        } catch (error) {
          const executionTime = Date.now() - startTime
          console.error(`Error executing automation ${automation.id}:`, error)
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Log failure
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: false,
            error_message: errorMessage,
            payload: payload.data,
            execution_time_ms: executionTime,
          })

          return { success: false, automation_id: automation.id, error: errorMessage }
        }
      })
    )

    return new Response(
      JSON.stringify({
        success: true,
        results: results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason }),
        executed: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in trigger-automation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

// Helper function to check conditions
function checkConditions(conditions: any, data: any): boolean {
  try {
    // Simple condition checking - can be extended
    for (const [key, value] of Object.entries(conditions)) {
      // Special handling for new_status - check both status and new_status fields
      if (key === 'new_status') {
        const dataStatus = data.new_status || data.status;
        if (dataStatus !== value) {
          return false;
        }
      } else if (data[key] !== value) {
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('Error checking conditions:', error)
    return false;
  }
}

// Execute webhook action
async function executeWebhook(config: any, data: any) {
  console.log('Executing webhook:', config.url)
  console.log('Webhook data:', data)
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(config.headers || {}),
  }

  // Send data as flat JSON object with individual fields
  // This makes it easy to map fields in Make.com
  const bodyData = JSON.stringify(data)

  console.log('Webhook body:', bodyData)

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers: headers,
    body: bodyData,
  })

  const responseText = await response.text()
  console.log('Webhook response:', { status: response.status, body: responseText })
  
  return {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
  }
}

// Execute email action (placeholder)
async function executeEmail(config: any, data: any) {
  console.log('Email action not yet implemented')
  return { message: 'Email action not implemented' }
}

// Execute notification action (placeholder)
async function executeNotification(config: any, data: any) {
  console.log('Notification action not yet implemented')
  return { message: 'Notification action not implemented' }
}

// Execute status update action
async function executeStatusUpdate(supabase: any, config: any, data: any) {
  console.log('Executing status update:', config)
  
  const { entity, status, update_field, update_field_value } = config
  const recordId = data.id
  
  if (!recordId) {
    throw new Error('No record ID provided for status update')
  }
  
  // Determine which table to update
  const table = entity === 'lead' ? 'leads' : 'tasks'
  
  console.log(`Updating ${table} ${recordId}`)
  
  // Build update object
  const updateData: any = {}
  
  // Update status only if provided (optional now)
  if (status) {
    updateData.status = status
  }
  
  // Update additional date field if specified
  if (update_field && update_field !== 'none' && update_field_value === 'today') {
    const today = new Date().toISOString().split('T')[0] // Format: YYYY-MM-DD
    updateData[update_field] = today
    console.log(`Setting ${update_field} to ${today}`)
  }
  
  // Ensure we have something to update
  if (Object.keys(updateData).length === 0) {
    console.log('No updates to perform')
    return { success: true, message: 'No updates needed' }
  }
  
  console.log('Update data:', updateData)
  
  const { data: updateResult, error } = await supabase
    .from(table)
    .update(updateData)
    .eq('id', recordId)
    .select()
    .single()
  
  if (error) {
    console.error(`Error updating ${table}:`, error)
    throw error
  }
  
  console.log(`Successfully updated ${table}:`, updateResult)
  
  return {
    success: true,
    entity: entity,
    recordId: recordId,
    updates: updateData,
    result: updateResult
  }
}

// Execute send WhatsApp action via ManyChat
async function executeSendWhatsapp(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing send WhatsApp:', config)
  console.log('Data:', data)
  
  const { manychat_tag_id, field_mapping } = config
  
  // Get ManyChat integration settings for this tenant
  const { data: integration, error: integrationError } = await supabase
    .from('tenant_integrations')
    .select('api_key, settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .eq('is_active', true)
    .maybeSingle()
  
  if (integrationError) {
    console.error('Error fetching ManyChat integration:', integrationError)
    throw new Error('שגיאה בטעינת הגדרות ManyChat')
  }
  
  if (!integration?.api_key) {
    throw new Error('לא נמצא חיבור ManyChat פעיל לארגון זה')
  }
  
  const apiKey = integration.api_key
  const baseUrl = 'https://api.manychat.com/fb'
  
  // Get the subscriber ID from lead or client
  let subscriberId: string | null = null
  let contactPhone: string | null = null
  let contactRecord: any = null
  let contactType: 'lead' | 'client' | null = null
  
  if (data.lead_id) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, manychat_subscriber_id, contact_name, phone')
      .eq('id', data.lead_id)
      .single()
    contactRecord = lead
    contactType = 'lead'
    subscriberId = lead?.manychat_subscriber_id
    contactPhone = lead?.phone
  } else if (data.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('id, manychat_subscriber_id, contact_name, phone')
      .eq('id', data.client_id)
      .single()
    contactRecord = client
    contactType = 'client'
    subscriberId = client?.manychat_subscriber_id
    contactPhone = client?.phone
  }
  
  // If no subscriber ID, try to find by phone number
  if (!subscriberId && contactPhone) {
    console.log(`No subscriber ID found, trying to sync by phone: ${contactPhone}`)
    
    // Clean phone number - remove all non-digits
    const cleanPhone = contactPhone.replace(/\D/g, '')
    
    // Try multiple phone formats - without + sign first (ManyChat may not use +)
    const phoneFormats = [
      cleanPhone,                           // Full number: 972507677613
      cleanPhone.slice(-9),                 // Last 9 digits: 507677613
      '972' + cleanPhone.slice(-9),         // With country code: 972507677613
      '0' + cleanPhone.slice(-9),           // With leading 0: 0507677613
    ]
    
    // Remove duplicates
    const uniqueFormats = [...new Set(phoneFormats)]
    console.log('Trying phone formats:', uniqueFormats)
    
    for (const phoneFormat of uniqueFormats) {
      console.log(`Trying phone format: ${phoneFormat}`)
      
      // ManyChat API uses direct "phone" parameter (not field_name/field_value)
      const searchUrl = `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(phoneFormat)}`
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })
      
      console.log(`Search response status for ${phoneFormat}: ${searchResponse.status}`)
      
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json()
        console.log(`ManyChat findBySystemField response for ${phoneFormat}:`, searchResult)
        
        if (searchResult.status === 'success' && searchResult.data?.id) {
          subscriberId = searchResult.data.id.toString()
          console.log(`Found subscriber by phone ${phoneFormat}: ${subscriberId}`)
          
          // Update the contact record with the found subscriber ID
          if (contactType === 'lead' && contactRecord?.id) {
            await supabase
              .from('leads')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
            console.log(`Updated lead ${contactRecord.id} with subscriber ID ${subscriberId}`)
          } else if (contactType === 'client' && contactRecord?.id) {
            await supabase
              .from('clients')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
            console.log(`Updated client ${contactRecord.id} with subscriber ID ${subscriberId}`)
          }
          break // Found subscriber, exit loop
        }
      } else {
        const errorText = await searchResponse.text()
        console.log(`Search failed for ${phoneFormat}: ${searchResponse.status} - ${errorText}`)
      }
    }
  }
  
  // If still no subscriber found, try to create a new one in ManyChat
  if (!subscriberId && contactPhone) {
    console.log('No subscriber found via search, attempting to create new subscriber in ManyChat')
    
    const cleanPhone = contactPhone.replace(/\D/g, '')
    // Format for WhatsApp: international format with + for whatsapp_phone
    const last9Digits = cleanPhone.slice(-9)
    const whatsappPhone = '+972' + last9Digits
    
    console.log(`Creating subscriber with whatsapp_phone: ${whatsappPhone}`)
    
    try {
      const createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: contactRecord?.contact_name || 'Unknown',
          whatsapp_phone: whatsappPhone,
          consent_phrase: 'Opted in via CRM automation'
        }),
      })
      
      const createResult = await createResponse.json()
      console.log('ManyChat createSubscriber response:', createResult)
      
      if (createResult.status === 'success' && createResult.data?.id) {
        subscriberId = createResult.data.id.toString()
        console.log(`Created new subscriber: ${subscriberId}`)
        
        // Save the new subscriber ID to the lead/client
        if (contactType === 'lead' && contactRecord?.id) {
          await supabase.from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', contactRecord.id)
          console.log(`Updated lead ${contactRecord.id} with new subscriber ID ${subscriberId}`)
        } else if (contactType === 'client' && contactRecord?.id) {
          await supabase.from('clients')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', contactRecord.id)
          console.log(`Updated client ${contactRecord.id} with new subscriber ID ${subscriberId}`)
        }
      } else {
        console.error('Failed to create subscriber:', createResult)
      }
    } catch (createError) {
      console.error('Error creating subscriber:', createError)
    }
  }
  
  if (!subscriberId) {
    throw new Error('לא נמצא Subscriber ID של ManyChat ולא ניתן היה ליצור subscriber חדש. ודא שלליד יש מספר טלפון תקין')
  }
  
  // Update custom fields if mapping is provided
  const customFieldUpdates: any[] = []
  
  if (field_mapping?.date && data.meeting_date) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.date),
      field_value: data.meeting_date
    })
  }
  
  if (field_mapping?.time && data.meeting_time) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.time),
      field_value: data.meeting_time
    })
  }
  
  if (field_mapping?.location && data.meeting_location) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.location),
      field_value: data.meeting_location
    })
  }
  
  if (field_mapping?.contact && data.contact_name) {
    customFieldUpdates.push({
      field_id: parseInt(field_mapping.contact),
      field_value: data.contact_name
    })
  }
  
  // Update custom fields
  if (customFieldUpdates.length > 0) {
    console.log('Updating ManyChat custom fields:', customFieldUpdates)
    
    for (const fieldUpdate of customFieldUpdates) {
      const fieldResponse = await fetch(`${baseUrl}/subscriber/setCustomField`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: subscriberId,
          field_id: fieldUpdate.field_id,
          field_value: fieldUpdate.field_value,
        }),
      })
      
      if (!fieldResponse.ok) {
        const errorText = await fieldResponse.text()
        console.error(`Failed to set custom field ${fieldUpdate.field_id}:`, errorText)
      }
    }
  }
  
  // Add tag to trigger ManyChat automation (instead of sending a Flow)
  if (manychat_tag_id) {
    console.log(`Adding ManyChat tag: ${manychat_tag_id}`)
    
    const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        tag_id: parseInt(manychat_tag_id),
      }),
    })
    
    const tagResult = await tagResponse.json()
    console.log('ManyChat addTag response:', tagResult)
    
    if (!tagResponse.ok) {
      throw new Error(`שגיאה בהוספת טאג ב-ManyChat: ${JSON.stringify(tagResult)}`)
    }
    
    return {
      success: true,
      subscriber_id: subscriberId,
      fields_updated: customFieldUpdates.length,
      tag_id: manychat_tag_id,
      tag_result: tagResult
    }
  }
  
  return {
    success: true,
    subscriber_id: subscriberId,
    fields_updated: customFieldUpdates.length,
    message: 'No tag configured'
  }
}

// Execute create ManyChat subscriber action
async function executeCreateManychatSubscriber(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing create ManyChat subscriber:', config)
  console.log('Data:', data)
  
  const { manychat_tag_id } = config
  
  // Get ManyChat integration settings for this tenant
  const { data: integration, error: integrationError } = await supabase
    .from('tenant_integrations')
    .select('api_key, settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manychat')
    .eq('is_active', true)
    .maybeSingle()
  
  if (integrationError) {
    console.error('Error fetching ManyChat integration:', integrationError)
    throw new Error('שגיאה בטעינת הגדרות ManyChat')
  }
  
  if (!integration?.api_key) {
    throw new Error('לא נמצא חיבור ManyChat פעיל לארגון זה')
  }
  
  const apiKey = integration.api_key
  const baseUrl = 'https://api.manychat.com/fb'
  
  // Get lead data
  let leadRecord: any = null
  const leadId = data.id || data.lead_id
  
  if (leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id, manychat_subscriber_id, contact_name, company_name, phone')
      .eq('id', leadId)
      .single()
    leadRecord = lead
  }
  
  if (!leadRecord) {
    throw new Error('לא נמצא ליד עם נתונים')
  }
  
  // If subscriber already exists, skip creation
  if (leadRecord.manychat_subscriber_id) {
    console.log(`Lead already has subscriber ID: ${leadRecord.manychat_subscriber_id}`)
    
    // Still add tag if configured
    if (manychat_tag_id && manychat_tag_id !== 'none') {
      console.log(`Adding tag ${manychat_tag_id} to existing subscriber`)
      const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriber_id: leadRecord.manychat_subscriber_id,
          tag_id: parseInt(manychat_tag_id),
        }),
      })
      const tagResult = await tagResponse.json()
      console.log('ManyChat addTag response:', tagResult)
    }
    
    return {
      success: true,
      subscriber_id: leadRecord.manychat_subscriber_id,
      message: 'Subscriber already exists, tag added if configured'
    }
  }
  
  // Create new subscriber
  const contactPhone = leadRecord.phone
  if (!contactPhone) {
    throw new Error('לליד אין מספר טלפון')
  }
  
  const cleanPhone = contactPhone.replace(/\D/g, '')
  const last9Digits = cleanPhone.slice(-9)
  const whatsappPhone = '+972' + last9Digits
  const contactName = leadRecord.contact_name || leadRecord.company_name || 'Unknown'
  
  console.log(`Creating subscriber with whatsapp_phone: ${whatsappPhone}, name: ${contactName}`)
  
  const createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      first_name: contactName,
      whatsapp_phone: whatsappPhone,
      consent_phrase: 'Opted in via CRM automation'
    }),
  })
  
  const createResult = await createResponse.json()
  console.log('ManyChat createSubscriber response:', createResult)
  
  if (createResult.status !== 'success' || !createResult.data?.id) {
    throw new Error(`שגיאה ביצירת subscriber ב-ManyChat: ${JSON.stringify(createResult)}`)
  }
  
  const subscriberId = createResult.data.id.toString()
  console.log(`Created new subscriber: ${subscriberId}`)
  
  // Save subscriber ID to lead
  await supabase.from('leads')
    .update({ manychat_subscriber_id: subscriberId })
    .eq('id', leadRecord.id)
  console.log(`Updated lead ${leadRecord.id} with subscriber ID ${subscriberId}`)
  
  // Add tag if configured
  if (manychat_tag_id && manychat_tag_id !== 'none') {
    console.log(`Adding tag ${manychat_tag_id} to new subscriber`)
    const tagResponse = await fetch(`${baseUrl}/subscriber/addTag`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        tag_id: parseInt(manychat_tag_id),
      }),
    })
    const tagResult = await tagResponse.json()
    console.log('ManyChat addTag response:', tagResult)
    
    return {
      success: true,
      subscriber_id: subscriberId,
      tag_id: manychat_tag_id,
      tag_result: tagResult,
      message: 'Subscriber created and tag added'
    }
  }
  
  return {
    success: true,
    subscriber_id: subscriberId,
    message: 'Subscriber created successfully'
  }
}
