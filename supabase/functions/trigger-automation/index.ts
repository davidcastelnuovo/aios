import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Custom field name for phone number in ManyChat (must be created manually in ManyChat)
const PHONE_CUSTOM_FIELD_NAME = 'phone_number';

// Find subscriber by Custom Field (phone_number) in ManyChat
async function findSubscriberByCustomFieldMC(apiKey: string, phoneCandidates: string[]): Promise<string | null> {
  for (const candidate of phoneCandidates) {
    try {
      const url = `https://api.manychat.com/fb/subscriber/findByCustomField?field_name=${encodeURIComponent(PHONE_CUSTOM_FIELD_NAME)}&field_value=${encodeURIComponent(candidate)}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`🔍 Find subscriber by custom field (${PHONE_CUSTOM_FIELD_NAME}=${candidate}) response:`, data);
        if (data?.status === 'success' && data?.data?.id) {
          return String(data.data.id);
        }
      }
    } catch (e) {
      console.log(`Error finding subscriber by custom field ${candidate}:`, e);
    }
  }
  return null;
}

// Set phone_number custom field for a subscriber
async function setPhoneCustomFieldMC(apiKey: string, subscriberId: string, phoneValue: string): Promise<boolean> {
  try {
    const url = 'https://api.manychat.com/fb/subscriber/setCustomFieldByName';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_id: subscriberId,
        field_name: PHONE_CUSTOM_FIELD_NAME,
        field_value: phoneValue,
      }),
    });

    const data = await res.json();
    console.log(`📝 Set custom field (${PHONE_CUSTOM_FIELD_NAME}=${phoneValue}) response:`, data);
    return data?.status === 'success';
  } catch (e) {
    console.log(`Error setting custom field:`, e);
    return false;
  }
}

interface AutomationPayload {
  trigger_type?: string
  data?: any
  tenant_id?: string
  // Support direct automation execution by ID
  automationId?: string
  payload?: any
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

    const requestBody = await req.json()
    console.log('Automation triggered:', requestBody)

    let automations: any[] = []
    let payloadData: any
    let tenantId: string

    // Check if this is a direct automation execution by ID
    if (requestBody.automationId) {
      // Direct execution mode - fetch the specific automation
      const { data: automation, error: fetchError } = await supabase
        .from('automations')
        .select('*')
        .eq('id', requestBody.automationId)
        .single()

      if (fetchError) {
        console.error('Error fetching automation by ID:', fetchError)
        throw fetchError
      }

      if (!automation) {
        throw new Error(`Automation not found: ${requestBody.automationId}`)
      }

      automations = [automation]
      payloadData = requestBody.payload || requestBody
      tenantId = automation.tenant_id
      console.log(`Direct execution of automation: ${automation.name} (${automation.id})`)
    } else {
      // Standard trigger mode - find automations by trigger_type
      const payload = requestBody as AutomationPayload
      payloadData = payload.data
      tenantId = payload.tenant_id!

      const { data: foundAutomations, error: fetchError } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', payload.trigger_type)
        .eq('tenant_id', payload.tenant_id)
        .eq('active', true)

      if (fetchError) {
        console.error('Error fetching automations:', fetchError)
        throw fetchError
      }

      automations = foundAutomations || []
    }

    console.log(`Found ${automations.length} automation(s) to execute`)

    // Execute each matching automation
    const results = await Promise.allSettled(
      (automations || []).map(async (automation) => {
        const startTime = Date.now()
        
        try {
          // Check conditions if any
          if (automation.conditions && Object.keys(automation.conditions).length > 0) {
            const conditionsMet = checkConditions(automation.conditions, payloadData)
            if (!conditionsMet) {
              console.log(`Conditions not met for automation ${automation.id}`)
              return
            }
          }

          // Execute action based on type
          let response: any
          if (automation.action_type === 'webhook') {
            response = await executeWebhook(automation.configuration, payloadData)
          } else if (automation.action_type === 'email') {
            response = await executeEmail(automation.configuration, payloadData)
          } else if (automation.action_type === 'notification') {
            response = await executeNotification(automation.configuration, payloadData)
          } else if (automation.action_type === 'update_status') {
            response = await executeStatusUpdate(supabase, automation.configuration, payloadData)
          } else if (automation.action_type === 'send_whatsapp') {
            response = await executeSendWhatsapp(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'create_manychat_subscriber') {
            response = await executeCreateManychatSubscriber(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'send_greenapi_message') {
            response = await executeGreenApiMessage(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'send_greenapi_to_campaigner') {
            response = await executeGreenApiToCampaigner(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'add_lead_update') {
            response = await executeAddLeadUpdate(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'add_client_update') {
            response = await executeAddClientUpdate(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'create_task') {
            response = await executeCreateTask(supabase, automation.configuration, payloadData, tenantId)
          } else if (automation.action_type === 'create_lead') {
            response = await executeCreateLead(supabase, automation.configuration, payloadData, tenantId)
          }

          const executionTime = Date.now() - startTime

          // Log success
          await supabase.from('automation_logs').insert({
            automation_id: automation.id,
            success: true,
            payload: payloadData,
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
            payload: payloadData,
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

  // If still no subscriber, try lookup by WhatsApp ID (wa_id)
  if (!subscriberId && contactPhone) {
    const cleanPhone = contactPhone.replace(/\D/g, '')
    const last9Digits = cleanPhone.slice(-9)
    const waIdCandidates = [...new Set([`972${last9Digits}`, `+972${last9Digits}`])]
    console.log('No subscriber found by phone, trying wa_id candidates:', waIdCandidates)

    for (const waId of waIdCandidates) {
      const searchUrl = `${baseUrl}/subscriber/findBySystemField?wa_id=${encodeURIComponent(waId)}`
      const searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      console.log(`Search wa_id response status for ${waId}: ${searchResponse.status}`)
      if (searchResponse.ok) {
        const searchResult = await searchResponse.json()
        console.log(`ManyChat findBySystemField response for wa_id ${waId}:`, searchResult)

        if (searchResult.status === 'success' && searchResult.data?.id) {
          subscriberId = searchResult.data.id.toString()
          console.log(`Found subscriber by wa_id ${waId}: ${subscriberId}`)

          if (contactType === 'lead' && contactRecord?.id) {
            await supabase
              .from('leads')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
          } else if (contactType === 'client' && contactRecord?.id) {
            await supabase
              .from('clients')
              .update({ manychat_subscriber_id: subscriberId })
              .eq('id', contactRecord.id)
          }
          break
        }
      }
    }
  }

  // If still no subscriber, try Custom Field lookup (phone_number) - NEW!
  if (!subscriberId && contactPhone) {
    const cleanPhone = contactPhone.replace(/\D/g, '')
    const last9Digits = cleanPhone.slice(-9)
    const customFieldCandidates = [`+972${last9Digits}`, `972${last9Digits}`, `0${last9Digits}`]
    console.log('No subscriber found by wa_id, trying custom field lookup:', customFieldCandidates)

    subscriberId = await findSubscriberByCustomFieldMC(apiKey, customFieldCandidates)
    if (subscriberId) {
      console.log(`Found subscriber by custom field: ${subscriberId}`)
      if (contactType === 'lead' && contactRecord?.id) {
        await supabase.from('leads').update({ manychat_subscriber_id: subscriberId }).eq('id', contactRecord.id)
      } else if (contactType === 'client' && contactRecord?.id) {
        await supabase.from('clients').update({ manychat_subscriber_id: subscriberId }).eq('id', contactRecord.id)
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
          has_opt_in_sms: true,
          has_opt_in_email: true,
          consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
        }),
      })
      
      const createResult = await createResponse.json()
      console.log('ManyChat createSubscriber response:', createResult)
      
      if (createResult.status === 'success' && createResult.data?.id) {
        subscriberId = createResult.data.id.toString()
        console.log(`Created new subscriber: ${subscriberId}`)
        
        // IMPORTANT: Save phone to custom field for future lookups
        console.log(`📝 Saving phone to custom field for new subscriber ${subscriberId}...`)
        await setPhoneCustomFieldMC(apiKey, subscriberId!, whatsappPhone)
        
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
        // If creation failed due to existing wa_id, try to resolve via wa_id lookup
        const errStr = JSON.stringify(createResult)
        console.error('Failed to create subscriber:', createResult)

        if (errStr.includes('wa_id') || errStr.includes('WhatsApp ID already exists')) {
          console.log('Create failed with wa_id conflict, trying wa_id lookup...')
          const searchWaIds = [...new Set([`972${last9Digits}`, `+972${last9Digits}`])]

          for (const waId of searchWaIds) {
            const searchUrl = `${baseUrl}/subscriber/findBySystemField?wa_id=${encodeURIComponent(waId)}`
            const searchResponse = await fetch(searchUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            })

            if (searchResponse.ok) {
              const searchResult = await searchResponse.json()
              console.log(`ManyChat findBySystemField response for wa_id ${waId}:`, searchResult)
              if (searchResult.status === 'success' && searchResult.data?.id) {
                subscriberId = searchResult.data.id.toString()
                console.log(`Resolved subscriber by wa_id ${waId}: ${subscriberId}`)

                if (contactType === 'lead' && contactRecord?.id) {
                  await supabase.from('leads')
                    .update({ manychat_subscriber_id: subscriberId })
                    .eq('id', contactRecord.id)
                } else if (contactType === 'client' && contactRecord?.id) {
                  await supabase.from('clients')
                    .update({ manychat_subscriber_id: subscriberId })
                    .eq('id', contactRecord.id)
                }
                break
              }
            }
          }
        }
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
      .select('id, manychat_subscriber_id, contact_name, company_name, phone, email')
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
  
  // Prepare phone number for lookup/creation
  const contactPhone = leadRecord.phone
  if (!contactPhone) {
    throw new Error('לליד אין מספר טלפון')
  }
  
  const cleanPhone = contactPhone.replace(/\D/g, '')
  const last9Digits = cleanPhone.slice(-9)
  const whatsappPhone = '+972' + last9Digits
  const waIdCandidates = [...new Set([`972${last9Digits}`, `+972${last9Digits}`])]
  const contactName = leadRecord.contact_name || leadRecord.company_name || 'Unknown'
  
  // Generate phone candidates for lookup (multi-format)
  const phoneCandidates = [
    `+972${last9Digits}`,
    `972${last9Digits}`,
    `0${last9Digits}`,
    cleanPhone,
    contactPhone.replace(/[\s\-\(\)]/g, '')
  ]
  
  // Step 1: Try to find existing subscriber by phone in ManyChat
  console.log(`Searching for existing subscriber with phone candidates:`, phoneCandidates)
  let subscriberId: string | null = null
  
  for (const candidate of phoneCandidates) {
    try {
      const findResponse = await fetch(
        `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      )
      const findResult = await findResponse.json()
      console.log(`Find subscriber (${candidate}) response:`, findResult)
      
      if (findResult?.status === 'success' && findResult?.data?.id) {
        subscriberId = String(findResult.data.id)
        console.log(`Found existing subscriber: ${subscriberId}`)
        break
      }
    } catch (e) {
      console.log(`Error finding subscriber with ${candidate}:`, e)
    }
  }

  // Step 1b: Try to find by wa_id (important when phone import is disabled)
  if (!subscriberId) {
    console.log('No subscriber found by phone; trying wa_id candidates:', waIdCandidates)
    for (const waId of waIdCandidates) {
      try {
        const findResponse = await fetch(
          `${baseUrl}/subscriber/findBySystemField?wa_id=${encodeURIComponent(waId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        )
        const findResult = await findResponse.json()
        console.log(`Find subscriber (wa_id=${waId}) response:`, findResult)

        if (findResult?.status === 'success' && findResult?.data?.id) {
          subscriberId = String(findResult.data.id)
          console.log(`Found existing subscriber by wa_id: ${subscriberId}`)
          break
        }
      } catch (_e) {
        // Continue
      }
    }
  }

  // Step 1c: Try to find by Custom Field (phone_number) - NEW!
  if (!subscriberId) {
    console.log('No subscriber found by wa_id; trying custom field lookup:', phoneCandidates)
    subscriberId = await findSubscriberByCustomFieldMC(apiKey, phoneCandidates)
    if (subscriberId) {
      console.log(`Found existing subscriber by custom field: ${subscriberId}`)
    }
  }
  
  // Step 2: If found, update lead and add tag
  if (subscriberId) {
    console.log(`Subscriber exists in ManyChat: ${subscriberId}, updating lead record`)
    await supabase.from('leads')
      .update({ manychat_subscriber_id: subscriberId })
      .eq('id', leadRecord.id)
    
    if (manychat_tag_id && manychat_tag_id !== 'none') {
      console.log(`Adding tag ${manychat_tag_id} to existing subscriber`)
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
    }
    
    return {
      success: true,
      subscriber_id: subscriberId,
      message: 'Found existing subscriber in ManyChat, linked to lead'
    }
  }
  
  // Step 3: Create new subscriber (only if not found)
  console.log(`Creating NEW subscriber with whatsapp_phone: ${whatsappPhone}, name: ${contactName}`)

  const createBodyBase: any = {
    first_name: contactName,
    // NOTE: some ManyChat accounts deny importing phone to system field.
    // Keep whatsapp_phone; phone will be added only if allowed.
    whatsapp_phone: whatsappPhone,
    has_opt_in_sms: true,
    has_opt_in_email: !!leadRecord.email,
    consent_phrase: 'אני מאשר קבלת הודעות ודיוור פרסומי'
  }

  const createBodyWithPhone = {
    ...createBodyBase,
    phone: whatsappPhone,
    email: leadRecord.email || undefined,
  }

  let createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBodyWithPhone),
  })

  let createResult = await createResponse.json()
  console.log('ManyChat createSubscriber response:', createResult)

  // If ManyChat denies importing phone, retry without "phone" field
  const createResultStr = JSON.stringify(createResult)
  if (
    (createResultStr.includes('Permission denied to import phone') || createResultStr.includes('Permission denied')) &&
    (createResultStr.includes('phone') || createResultStr.includes('warning'))
  ) {
    console.log('Retrying createSubscriber WITHOUT phone field due to permission restriction...')
    createResponse = await fetch(`${baseUrl}/subscriber/createSubscriber`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...createBodyBase,
        email: leadRecord.email || undefined,
      }),
    })
    createResult = await createResponse.json()
    console.log('ManyChat createSubscriber response (no phone):', createResult)
  }
  
  if (createResult.status !== 'success' || !createResult.data?.id) {
    // If creation failed, try one more lookup in case of race condition
    console.log('Creation failed, trying one more lookup...')

    // First retry wa_id lookup (covers "already exists" conflicts)
    for (const waId of waIdCandidates) {
      try {
        const retryFind = await fetch(
          `${baseUrl}/subscriber/findBySystemField?wa_id=${encodeURIComponent(waId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        )
        const retryResult = await retryFind.json()
        if (retryResult?.status === 'success' && retryResult?.data?.id) {
          subscriberId = String(retryResult.data.id)
          console.log(`Found subscriber by wa_id on retry: ${subscriberId}`)

          await supabase.from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', leadRecord.id)

          if (manychat_tag_id && manychat_tag_id !== 'none') {
            await fetch(`${baseUrl}/subscriber/addTag`, {
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
          }

          return {
            success: true,
            subscriber_id: subscriberId,
            message: 'Found existing subscriber by wa_id on retry, linked to lead'
          }
        }
      } catch (_e) {
        // Continue
      }
    }

    for (const candidate of phoneCandidates) {
      try {
        const retryFind = await fetch(
          `${baseUrl}/subscriber/findBySystemField?phone=${encodeURIComponent(candidate)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        )
        const retryResult = await retryFind.json()
        if (retryResult?.status === 'success' && retryResult?.data?.id) {
          subscriberId = String(retryResult.data.id)
          console.log(`Found subscriber on retry: ${subscriberId}`)
          
          await supabase.from('leads')
            .update({ manychat_subscriber_id: subscriberId })
            .eq('id', leadRecord.id)
          
          if (manychat_tag_id && manychat_tag_id !== 'none') {
            await fetch(`${baseUrl}/subscriber/addTag`, {
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
          }
          
          return {
            success: true,
            subscriber_id: subscriberId,
            message: 'Found existing subscriber on retry, linked to lead'
          }
        }
      } catch (e) {
        // Continue to next candidate
      }
    }
    
    throw new Error(`שגיאה ביצירת subscriber ב-ManyChat: ${JSON.stringify(createResult)}`)
  }
  
  subscriberId = createResult.data.id.toString()
  console.log(`Created new subscriber: ${subscriberId}`)
  
  // IMPORTANT: Save phone to custom field for future lookups
  console.log(`📝 Saving phone to custom field for new subscriber ${subscriberId}...`)
  await setPhoneCustomFieldMC(apiKey, subscriberId!, whatsappPhone)
  
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

// Helper function to replace template variables
function replaceTemplateVariables(template: string, data: any, tenantSlug?: string): string {
  // Current date/time info
  const now = new Date()
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const dayOfWeek = days[now.getDay()]
  const formattedDate = `${now.getDate().toString().padStart(2, '0')}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getFullYear()}`
  const formattedTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  
  // Format due_date if provided
  let formattedDueDate = ''
  if (data.due_date) {
    const dueDate = new Date(data.due_date)
    formattedDueDate = `${dueDate.getDate().toString().padStart(2, '0')}.${(dueDate.getMonth() + 1).toString().padStart(2, '0')}.${dueDate.getFullYear()}`
  }
  
  // Priority translation
  const priorityMap: Record<string, string> = {
    'high': 'גבוהה',
    'medium': 'בינונית', 
    'low': 'נמוכה'
  }
  const priorityValue = data.priority?.toString() || ''
  const formattedPriority = priorityMap[priorityValue.toLowerCase()] || priorityValue
  
  // Base URL for links - use actual production URL
  const appUrl = Deno.env.get('APP_URL') || 'https://marketing-captain.lovable.app'
  const baseUrl = tenantSlug 
    ? `${appUrl}/t/${tenantSlug}` 
    : appUrl
  
  const variables: Record<string, string> = {
    // Contact info
    contact_name: data.contact_name || '',
    company_name: data.company_name || data.name || '',
    phone: data.phone || '',
    email: data.email || '',
    status: data.status || data.new_status || '',
    old_status: data.old_status || '',
    new_status: data.new_status || data.status || '',
    // Date/time
    date: formattedDate,
    time: formattedTime,
    day_of_week: dayOfWeek,
    // Task info
    task_title: data.task_title || '',
    task_status: data.task_status || '',
    client_name: data.client_name || '',
    campaigner_name: data.campaigner_name || '',
    agency_name: data.agency_name || '',
    priority: formattedPriority,
    due_date: formattedDueDate,
    // Link variables
    tasks_link: `${baseUrl}/tasks`,
    leads_link: `${baseUrl}/leads`,
    clients_link: `${baseUrl}/clients`,
  }
  
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  
  return result
}

// Execute Green API message action
async function executeGreenApiMessage(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing Green API message:', config)
  console.log('Data:', data)
  
  const { message_template, integration_id, send_to_type, manual_phone, manual_group_id } = config
  
  if (!message_template) {
    throw new Error('תבנית הודעה לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  // Determine chatId based on send_to_type
  let chatId: string
  let contactRecord: any = null
  
  if (send_to_type === "manual_group" && manual_group_id) {
    // Send to manual group
    chatId = manual_group_id.includes("@g.us") ? manual_group_id : `${manual_group_id}@g.us`
    console.log(`Sending to manual group: ${chatId}`)
  } else if (send_to_type === "manual_phone" && manual_phone) {
    // Send to manual phone number
    const cleanPhone = manual_phone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
    console.log(`Sending to manual phone: ${chatId}`)
  } else {
    // Default: send to contact (lead/client)
    let contactPhone: string | null = null
    
    if (data.lead_id || data.id) {
      const leadId = data.lead_id || data.id
      const { data: lead } = await supabase
        .from('leads')
        .select('id, phone, contact_name, company_name')
        .eq('id', leadId)
        .single()
      contactRecord = lead
      contactPhone = lead?.phone
    } else if (data.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, phone, contact_name, name')
        .eq('id', data.client_id)
        .single()
      contactRecord = client
      contactPhone = client?.phone
    }
    
    if (!contactPhone) {
      throw new Error('לא נמצא מספר טלפון לשליחה')
    }
    
    // Format phone for Green API
    const cleanPhone = contactPhone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
  }
  
  // Find Green API integration - use specified ID or fall back to first active
  let integration: any = null
  
  if (integration_id) {
    console.log(`Looking for specific integration: ${integration_id}`)
    const { data: specificIntegration, error } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id')
      .eq('id', integration_id)
      .eq('is_active', true)
      .maybeSingle()
    
    console.log('Specific integration query result:', { data: specificIntegration, error })
    
    if (!error && specificIntegration) {
      integration = specificIntegration
      console.log(`Using specified integration: ${integration.id}, has api_key: ${!!integration.api_key}`)
    } else {
      console.log(`Specified integration not found or error: ${JSON.stringify(error)}`)
    }
  }
  
  // Fallback to first active integration
  if (!integration) {
    const { data: fallbackIntegration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    
    if (integrationError || !fallbackIntegration) {
      throw new Error('לא נמצא חיבור Green API פעיל')
    }
    integration = fallbackIntegration
    console.log(`Using fallback integration: ${integration.id}`)
  }
  
  // Support both naming conventions: idInstance/apiTokenInstance and instance_id/api_key
  // Also check both settings object AND direct columns (fixed Dec 14, 2025)
  const idInstance = integration.settings?.idInstance || integration.settings?.instance_id || integration.instance_id
  const apiTokenInstance = integration.settings?.apiTokenInstance || integration.api_key
  
  if (!idInstance || !apiTokenInstance) {
    console.log('Integration settings:', JSON.stringify(integration.settings))
    console.log('api_key field:', integration.api_key ? 'exists' : 'missing')
    throw new Error('הגדרות Green API חסרות')
  }
  
  // Replace template variables
  const message = replaceTemplateVariables(message_template, {
    ...data,
    ...contactRecord,
  }, tenantSlug)
  
  // Send message via Green API
  const greenApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`
  
  const sendResponse = await fetch(greenApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message,
    }),
  })
  
  const sendResult = await sendResponse.json()
  console.log('Green API send response:', sendResult)
  
  if (!sendResponse.ok) {
    throw new Error(`שגיאה בשליחת הודעה: ${JSON.stringify(sendResult)}`)
  }
  
  return {
    success: true,
    message_sent: message,
    chat_id: chatId,
    result: sendResult,
  }
}

// Execute Green API message to campaigner action
async function executeGreenApiToCampaigner(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing Green API message to campaigner:', config)
  console.log('Data:', data)
  
  const { message_template, send_target, integration_id } = config
  
  if (!message_template) {
    throw new Error('תבנית הודעה לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  // Get campaigner data from the trigger data
  let campaignerPhone = data.campaigner_phone
  let campaignerGroupId = data.campaigner_whatsapp_group_id
  let campaignerId = data.campaigner_id
  
  // If no data from trigger, try to fetch from database
  if (campaignerId && (!campaignerPhone || !campaignerGroupId)) {
    const { data: campaigner } = await supabase
      .from('campaigners')
      .select('phone, whatsapp_group_id, full_name')
      .eq('id', campaignerId)
      .single()
    
    if (campaigner) {
      campaignerPhone = campaigner.phone || campaignerPhone
      campaignerGroupId = campaigner.whatsapp_group_id || campaignerGroupId
    }
  }
  
  // Determine chat ID based on send target
  let chatId: string | null = null
  
  if (send_target === 'group' && campaignerGroupId) {
    chatId = campaignerGroupId.includes('@g.us') ? campaignerGroupId : `${campaignerGroupId}@g.us`
    console.log(`Sending to group: ${chatId}`)
  } else if (campaignerPhone) {
    const cleanPhone = campaignerPhone.replace(/\D/g, '')
    const last9 = cleanPhone.slice(-9)
    chatId = `972${last9}@c.us`
    console.log(`Sending to phone: ${chatId}`)
  }
  
  if (!chatId) {
    if (send_target === 'group') {
      throw new Error('לא נמצא מזהה קבוצת WhatsApp לקמפיינר. יש להגדיר מזהה קבוצה בכרטיס הקמפיינר')
    }
    throw new Error('לא נמצא מספר טלפון לקמפיינר')
  }
  
  // Find Green API integration - use specified ID or fall back to first active
  let integration: any = null
  
  if (integration_id) {
    console.log(`Looking for specific integration: ${integration_id}`)
    const { data: specificIntegration, error } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id')
      .eq('id', integration_id)
      .eq('is_active', true)
      .maybeSingle()
    
    if (!error && specificIntegration) {
      integration = specificIntegration
      console.log(`Using specified integration: ${integration.id}`)
    }
  }
  
  // Fallback to first active integration
  if (!integration) {
    const { data: fallbackIntegration, error: integrationError } = await supabase
      .from('tenant_integrations')
      .select('id, api_key, settings, user_id')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'green_api')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
    
    if (integrationError || !fallbackIntegration) {
      throw new Error('לא נמצא חיבור Green API פעיל')
    }
    integration = fallbackIntegration
    console.log(`Using fallback integration: ${integration.id}`)
  }
  
  // Support both naming conventions: idInstance/apiTokenInstance and instance_id/api_key
  // Also check both settings object AND direct columns (fixed Dec 14, 2025)
  const idInstance = integration.settings?.idInstance || integration.settings?.instance_id || integration.instance_id
  const apiTokenInstance = integration.settings?.apiTokenInstance || integration.api_key
  
  if (!idInstance || !apiTokenInstance) {
    console.log('Integration settings:', JSON.stringify(integration.settings))
    console.log('api_key field:', integration.api_key ? 'exists' : 'missing')
    throw new Error('הגדרות Green API חסרות')
  }
  
  // Replace template variables
  console.log('Template variables before replacement:', {
    task_title: data.task_title,
    client_name: data.client_name,
    priority: data.priority,
    due_date: data.due_date,
  })
  const message = replaceTemplateVariables(message_template, data, tenantSlug)
  console.log('Final message after replacement:', message)
  
  // Send message via Green API
  const greenApiUrl = `https://api.green-api.com/waInstance${idInstance}/sendMessage/${apiTokenInstance}`
  
  const sendResponse = await fetch(greenApiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message,
    }),
  })
  
  const sendResult = await sendResponse.json()
  console.log('Green API send response:', sendResult)
  
  if (!sendResponse.ok) {
    throw new Error(`שגיאה בשליחת הודעה: ${JSON.stringify(sendResult)}`)
  }
  
  // Save message to chat_messages for chat history
  try {
    // Determine lead_id or client_id from the chatId (phone number)
    const phoneFromChat = chatId.replace('@c.us', '').replace('@g.us', '')
    const last9Digits = phoneFromChat.slice(-9)
    
    // Try to find matching lead or client by phone
    let leadId = null
    let clientId = null
    
    const { data: matchingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantId)
      .ilike('phone', `%${last9Digits}`)
      .limit(1)
      .maybeSingle()
    
    if (matchingLead) {
      leadId = matchingLead.id
    } else {
      const { data: matchingClient } = await supabase
        .from('clients')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('phone', `%${last9Digits}`)
        .limit(1)
        .maybeSingle()
      
      if (matchingClient) {
        clientId = matchingClient.id
      }
    }
    
    // Save to chat_messages
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert({
        tenant_id: tenantId,
        connection_user_id: integration.user_id,
        lead_id: leadId,
        client_id: clientId,
        sender_phone: phoneFromChat,
        message_text: message,
        direction: 'outbound',
        channel: 'whatsapp',
        provider: 'green_api',
        raw_provider_data: { automation: true, send_target, sendResult },
      })
    
    if (chatError) {
      console.error('Error saving message to chat_messages:', chatError)
    } else {
      console.log('Message saved to chat_messages successfully')
    }
  } catch (saveError) {
    console.error('Error saving to chat_messages:', saveError)
    // Don't throw - message was sent successfully, just logging failed
  }
  
  return {
    success: true,
    message_sent: message,
    chat_id: chatId,
    send_target: send_target,
    result: sendResult,
  }
}

// Execute add lead update action
async function executeAddLeadUpdate(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing add lead update:', config)
  console.log('Data:', data)
  
  const { update_template } = config
  
  if (!update_template) {
    throw new Error('תבנית עדכון לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  const leadId = data.lead_id || data.id
  
  if (!leadId) {
    throw new Error('לא נמצא ליד לעדכון')
  }
  
  // Get lead data for template
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()
  
  if (!lead) {
    throw new Error('ליד לא נמצא')
  }
  
  // Replace template variables
  const updateContent = replaceTemplateVariables(update_template, {
    ...data,
    ...lead,
  }, tenantSlug)
  
  // Get a system user ID for the update (we'll use the first owner in the tenant)
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()
  
  const userId = ownerRole?.user_id || data.user_id
  
  if (!userId) {
    throw new Error('לא נמצא משתמש לשמירת העדכון')
  }
  
  // Insert update into lead_updates table
  const { data: insertedUpdate, error: insertError } = await supabase
    .from('lead_updates')
    .insert({
      lead_id: leadId,
      user_id: userId,
      content: updateContent,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error inserting lead update:', insertError)
    throw new Error(`שגיאה בשמירת עדכון: ${insertError.message}`)
  }
  
  console.log('Lead update inserted:', insertedUpdate)
  
  return {
    success: true,
    update_id: insertedUpdate.id,
    content: updateContent,
  }
}

// Execute add client update action
async function executeAddClientUpdate(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing add client update:', config)
  console.log('Data:', data)
  
  const { update_template } = config
  
  if (!update_template) {
    throw new Error('תבנית עדכון לא הוגדרה')
  }
  
  // Get tenant slug for links
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  const tenantSlug = tenant?.slug
  
  const clientId = data.client_id
  
  if (!clientId) {
    throw new Error('לא נמצא לקוח לעדכון')
  }
  
  // Get client data for template
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  
  if (!client) {
    throw new Error('לקוח לא נמצא')
  }
  
  // Replace template variables
  const updateContent = replaceTemplateVariables(update_template, {
    ...data,
    ...client,
  }, tenantSlug)
  
  // Get a system user ID for the update
  const { data: ownerRole } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle()
  
  const userId = ownerRole?.user_id || data.user_id
  
  if (!userId) {
    throw new Error('לא נמצא משתמש לשמירת העדכון')
  }
  
  // Insert update into client_updates table
  const { data: insertedUpdate, error: insertError } = await supabase
    .from('client_updates')
    .insert({
      client_id: clientId,
      tenant_id: tenantId,
      user_id: userId,
      content: updateContent,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error inserting client update:', insertError)
    throw new Error(`שגיאה בשמירת עדכון: ${insertError.message}`)
  }
  
  console.log('Client update inserted:', insertedUpdate)
  
  return {
    success: true,
    update_id: insertedUpdate.id,
    content: updateContent,
  }
}

// Execute create task action
async function executeCreateTask(supabase: any, config: any, data: any, tenantId: string) {
  const { task_title_template, task_notes_template, task_priority, task_due_days, default_campaigner_id, default_agency_id } = config
  
  console.log('Executing create_task action:', { config, data, tenantId })
  
  // Get tenant slug for template variables
  const { data: tenant } = await supabase
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .single()
  
  const tenantSlug = tenant?.slug || ''
  
  // Replace template variables
  const title = replaceTemplateVariables(task_title_template || '{{company_name}} - משימה חדשה', data, tenantSlug)
  const notes = task_notes_template ? replaceTemplateVariables(task_notes_template, data, tenantSlug) : null
  
  // Calculate due date
  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + (task_due_days || 0))
  const dueDateStr = dueDate.toISOString().split('T')[0]
  
  // Get agency - prefer from data, then from config default, then first tenant agency
  let agencyId = data.agency_id || default_agency_id || null
  
  if (!agencyId) {
    const { data: agency } = await supabase
      .from('agencies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle()
    
    agencyId = agency?.id
  }
  
  if (!agencyId) {
    throw new Error('לא נמצאה סוכנות בארגון')
  }
  
  // Get campaigner - prefer from data, then from config default
  let campaignerId = data.campaigner_id || default_campaigner_id || null
  
  // If campaigner_name provided in data, try to resolve it
  if (!campaignerId && data.campaigner_name) {
    console.log(`Searching for campaigner by name: "${data.campaigner_name}"`)
    const { data: campaigner } = await supabase
      .from('campaigners')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${data.campaigner_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (campaigner) {
      campaignerId = campaigner.id
      console.log(`Found campaigner: ${campaigner.full_name} (${campaignerId})`)
    }
  }
  
  // Get sales person from data
  let salesPersonId = data.sales_person_id || null
  
  // If sales_person_name provided in data, try to resolve it
  if (!salesPersonId && data.sales_person_name) {
    console.log(`Searching for sales person by name: "${data.sales_person_name}"`)
    const { data: salesPerson } = await supabase
      .from('sales_people')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .ilike('full_name', `%${data.sales_person_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (salesPerson) {
      salesPersonId = salesPerson.id
      console.log(`Found sales person: ${salesPerson.full_name} (${salesPersonId})`)
    }
  }
  
  // Resolve client by name if needed
  let clientId = data.client_id || null
  if (!clientId && data.client_name) {
    console.log(`Searching for client by name: "${data.client_name}"`)
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .ilike('name', `%${data.client_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (client) {
      clientId = client.id
      console.log(`Found client: ${client.name} (${clientId})`)
    }
  }
  
  // Resolve lead by name if needed
  let leadId = data.lead_id || null
  if (!leadId && data.lead_name) {
    console.log(`Searching for lead by name: "${data.lead_name}"`)
    const { data: lead } = await supabase
      .from('leads')
      .select('id, company_name')
      .eq('tenant_id', tenantId)
      .ilike('company_name', `%${data.lead_name}%`)
      .limit(1)
      .maybeSingle()
    
    if (lead) {
      leadId = lead.id
      console.log(`Found lead: ${lead.company_name} (${leadId})`)
    }
  }
  
  const taskRecord = {
    title,
    notes,
    status: 'open',
    priority: task_priority || 5,
    due_date: dueDateStr,
    tenant_id: tenantId,
    agency_id: agencyId,
    campaigner_id: campaignerId,
    sales_person_id: salesPersonId,
    lead_id: leadId,
    client_id: clientId,
  }
  
  console.log('Creating task with record:', taskRecord)
  
  // Insert task
  const { data: newTask, error: insertError } = await supabase
    .from('tasks')
    .insert(taskRecord)
    .select()
    .single()
  
  if (insertError) {
    console.error('Error creating task:', insertError)
    throw new Error(`שגיאה ביצירת משימה: ${insertError.message}`)
  }
  
  console.log('Task created:', newTask)
  
  return {
    success: true,
    task_id: newTask.id,
    title,
  }
}

// Execute create lead action
async function executeCreateLead(supabase: any, config: any, data: any, tenantId: string) {
  console.log('Executing create lead:', config)
  console.log('Data:', data)
  
  // Extract lead data from payload
  const companyName = data.company_name || data.name || data.full_name || data.phone || 'ליד חדש'
  const contactName = data.contact_name || data.name || data.full_name || null
  const phone = data.phone || null
  const email = data.email || null
  const source = data.source || 'website'
  const notes = data.notes || null
  
  // Find default agency for this tenant
  let agencyId = data.agency_id
  
  if (!agencyId) {
    console.log(`Finding agency for tenant: ${tenantId}`)
    
    // First try to find default agency
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
      console.log(`Found default agency: ${defaultAgency.name} (${agencyId})`)
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
        console.log(`Found first active agency: ${firstAgency.name} (${agencyId})`)
      }
    }
  }
  
  if (!agencyId) {
    throw new Error('לא נמצאה סוכנות פעילה לארגון זה')
  }
  
  // Check for duplicate by phone
  if (phone) {
    const cleanPhone = phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972')
    
    const { data: existingLeads } = await supabase
      .from('leads')
      .select('id, company_name, phone')
      .eq('tenant_id', tenantId)
    
    const duplicateLead = existingLeads?.find((l: any) => {
      if (!l.phone) return false
      const existingClean = l.phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972')
      return existingClean === cleanPhone
    })
    
    if (duplicateLead) {
      console.log(`Duplicate lead found by phone: ${duplicateLead.id} (${duplicateLead.company_name})`)
      return {
        success: true,
        lead_id: duplicateLead.id,
        message: 'ליד כבר קיים במערכת',
        duplicate: true,
      }
    }
  }
  
  // Get first pipeline stage for new lead
  const { data: firstStage } = await supabase
    .from('lead_pipeline_stages')
    .select('stage_key')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()
  
  const status = firstStage?.stage_key || 'new'
  
  // Create the lead
  const { data: newLead, error: insertError } = await supabase
    .from('leads')
    .insert({
      company_name: companyName,
      contact_name: contactName,
      phone: phone,
      email: email,
      source: source,
      notes: notes,
      agency_id: agencyId,
      tenant_id: tenantId,
      status: status,
    })
    .select()
    .single()
  
  if (insertError) {
    console.error('Error creating lead:', insertError)
    throw new Error(`שגיאה ביצירת ליד: ${insertError.message}`)
  }
  
  console.log('Lead created:', newLead)
  
  return {
    success: true,
    lead_id: newLead.id,
    company_name: companyName,
    phone: phone,
  }
}
