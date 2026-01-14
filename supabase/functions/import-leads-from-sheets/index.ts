import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize phone for comparison
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-\(\)\.+]/g, '').replace(/^0/, '972');
}

// Source mappings
const sourceMappings: Record<string, string> = {
  'facebook': 'facebook',
  'פייסבוק': 'facebook',
  'website': 'website',
  'אתר': 'website',
  'referral': 'referral',
  'הפניה': 'referral',
  'linkedin': 'linkedin',
  'לינקדאין': 'linkedin',
  'other': 'other',
  'אחר': 'other',
}

// Status mappings
const statusMappings: Record<string, string> = {
  'new': 'new',
  'חדש': 'new',
  'contacted': 'contacted',
  'יצרנו קשר': 'contacted',
  'follow_up': 'follow_up',
  'מעקב': 'follow_up',
  'proposal_sent': 'proposal_sent',
  'נשלחה הצעה': 'proposal_sent',
  'closed': 'closed',
  'נסגר': 'closed',
}

const parseDate = (val: string): string | null => {
  if (!val) return null;
  
  const strVal = String(val).trim();
  if (!strVal) return null;
  
  // Helper function to validate year is reasonable (1900-2100)
  const isValidYear = (year: number) => year >= 1900 && year <= 2100;
  
  // Try DD/MM/YY or DD/MM/YYYY format
  const slashParts = strVal.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10);
    let year = parseInt(slashParts[2], 10);
    
    // Convert 2-digit year
    if (year < 100) year = year > 50 ? 1900 + year : 2000 + year;
    
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) {
        return d.toISOString().split('T')[0];
      }
    }
  }
  
  // Try DD-MM-YYYY or DD.MM.YYYY format
  const otherParts = strVal.split(/[-.]/).filter(p => p);
  if (otherParts.length === 3) {
    const day = parseInt(otherParts[0], 10);
    const month = parseInt(otherParts[1], 10);
    const year = parseInt(otherParts[2], 10);
    
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime()) && d.getFullYear() === year) {
        return d.toISOString().split('T')[0];
      }
    }
  }
  
  // Try ISO format (YYYY-MM-DD)
  const isoMatch = strVal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    
    if (isValidYear(year) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
  }
  
  // Don't use generic Date() parsing - it produces weird results
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sheetId, range, tenantId: requestTenantId, agencyId, addNotesAsUpdates = true, fetchHeadersOnly = false, fieldMap } = await req.json()

    if (!sheetId) {
      return new Response(
        JSON.stringify({ error: 'Sheet ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')

    if (!googleApiKey) {
      return new Response(
        JSON.stringify({ error: 'Google API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's token to get their tenant
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Use tenant_id from request (preferred) or fallback to user's first tenant
    let tenantId = requestTenantId
    if (!tenantId) {
      const { data: tenantUser } = await supabaseUser
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle()
      tenantId = tenantUser?.tenant_id
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing sheet for tenant: ${tenantId}`)

    // Fetch data from Google Sheets
    const sheetRange = range || 'Sheet1!A:Z'
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetRange)}?key=${googleApiKey}`
    
    console.log(`Fetching from Google Sheets: ${sheetId}, range: ${sheetRange}`)
    
    const sheetsResponse = await fetch(sheetsUrl)
    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text()
      console.error('Google Sheets API error:', errorText)
      return new Response(
        JSON.stringify({ error: `Failed to fetch sheet data: ${sheetsResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const sheetsData = await sheetsResponse.json()
    const rows = sheetsData.values || []

    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Sheet has no data rows (only header or empty)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse headers
    const headers = rows[0].map((h: string) => String(h).trim())
    console.log('Sheet headers:', headers)

    // If only fetching headers for mapping UI
    if (fetchHeadersOnly) {
      const previewRows = rows.slice(1, 6).map((row: any[]) => 
        row.map((cell: any) => String(cell || '').trim())
      )
      return new Response(
        JSON.stringify({ headers, previewRows }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build header index mapping from fieldMap
    const headerMapping: Record<number, string> = {}
    if (fieldMap && typeof fieldMap === 'object') {
      // fieldMap: { "שם העמודה": "system_field" }
      headers.forEach((header: string, index: number) => {
        const systemField = fieldMap[header]
        if (systemField) {
          headerMapping[index] = systemField
        }
      })
    } else {
      // Legacy: auto-detect (for backwards compatibility)
      const columnMappings: Record<string, string> = {
        'שם': 'company_name',
        'שם חברה': 'company_name',
        'טלפון': 'phone',
        'מייל': 'email',
        'אימייל': 'email',
        'תאריך יצירה': 'created_at',
        'תאריך': 'created_at',
        'מקור': 'source',
        'סטטוס': 'status',
        'הערות': 'notes',
        'איש קשר': 'contact_name',
        'company_name': 'company_name',
        'name': 'company_name',
        'phone': 'phone',
        'email': 'email',
        'created_at': 'created_at',
        'date': 'created_at',
        'source': 'source',
        'status': 'status',
        'notes': 'notes',
        'contact_name': 'contact_name',
      }
      headers.forEach((header: string, index: number) => {
        const mapped = columnMappings[header.toLowerCase()]
        if (mapped) {
          headerMapping[index] = mapped
        }
      })
    }
    console.log('Header mapping:', headerMapping)

    // Use service role for inserts
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    let importedCount = 0
    let updatedCount = 0
    let updatesAddedCount = 0
    const errors: string[] = []

    // Process each data row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const rowData: Record<string, any> = {}

      // Map row values to fields
      row.forEach((value: any, index: number) => {
        const field = headerMapping[index]
        if (field && value) {
          rowData[field] = String(value).trim()
        }
      })

      // Skip empty rows
      if (!rowData.company_name && !rowData.phone && !rowData.email && !rowData.contact_name) {
        continue
      }

      // Prepare lead data
      const leadData: Record<string, any> = {
        tenant_id: tenantId,
        agency_id: agencyId || null,
      }

      // Map fields
      for (const [field, value] of Object.entries(rowData)) {
        if (!value) continue
        const strValue = String(value).trim()

        switch (field) {
          case 'company_name':
          case 'contact_name':
          case 'notes':
          case 'products':
          case 'campaign_name':
          case 'industry':
          case 'folder_link':
            leadData[field] = strValue
            break
          case 'email':
            if (strValue.includes('@')) leadData.email = strValue
            break
          case 'phone':
            leadData.phone = strValue.replace(/[^\d+\-\s]/g, '')
            break
          case 'source':
            leadData.source = sourceMappings[strValue.toLowerCase()] || 'other'
            break
          case 'status':
            leadData.status = statusMappings[strValue.toLowerCase()] || 'new'
            break
          case 'monthly_budget':
          case 'three_month_budget':
          case 'estimated_deal_value':
            const num = parseFloat(strValue.replace(/[^\d.-]/g, ''))
            if (!isNaN(num) && num > 0) leadData[field] = num
            break
          case 'created_at':
            const createdDate = parseDate(strValue)
            if (createdDate) leadData.created_at = createdDate + 'T00:00:00Z'
            break
          case 'proposal_date':
            const propDate = parseDate(strValue)
            if (propDate) {
              leadData.proposal_date = propDate
              leadData.proposal_sent_date = propDate
            }
            break
          case 'won_date':
            const wonDate = parseDate(strValue)
            if (wonDate) {
              leadData.won_date = wonDate
              leadData.sale_date = wonDate
              leadData.closing_date = wonDate
              leadData.status = 'closed'
            }
            break
        }
      }

      // Fallbacks
      if (!leadData.company_name) {
        if (rowData.contact_name) {
          leadData.company_name = rowData.contact_name
        } else if (leadData.phone) {
          leadData.company_name = `ליד ${leadData.phone}`
        } else if (leadData.email) {
          leadData.company_name = leadData.email.split('@')[0]
        } else {
          continue // Skip row with no identifier
        }
      }

      try {
        // Check if lead exists by phone or email using normalized comparison
        let existingLead = null
        const normalizedPhone = normalizePhone(leadData.phone);
        const normalizedEmail = leadData.email?.trim().toLowerCase() || null;
        
        if (normalizedPhone) {
          // Fetch all leads to do normalized phone comparison
          const { data: leadsByPhone } = await supabaseAdmin
            .from('leads')
            .select('id, phone, email, company_name, contact_name, notes, monthly_budget, three_month_budget, products, campaign_name, industry, folder_link, source, status')
            .eq('tenant_id', tenantId)
          
          existingLead = leadsByPhone?.find(l => normalizePhone(l.phone) === normalizedPhone) || null
        }
        
        if (!existingLead && normalizedEmail) {
          const { data } = await supabaseAdmin
            .from('leads')
            .select('id, phone, email, company_name, contact_name, notes, monthly_budget, three_month_budget, products, campaign_name, industry, folder_link, source, status')
            .eq('tenant_id', tenantId)
            .ilike('email', normalizedEmail)
            .maybeSingle()
          existingLead = data
        }

        let leadId: string

        if (existingLead) {
          // Only update fields that are empty in existing lead but have values in new data
          const updates: Record<string, any> = {}
          let hasUpdates = false
          
          const existingLeadRecord = existingLead as Record<string, any>
          
          // Fields to check and update if empty
          const fieldsToCheck = [
            'contact_name', 'email', 'phone', 'notes', 'monthly_budget', 
            'three_month_budget', 'products', 'campaign_name', 'industry', 'folder_link'
          ]
          
          for (const field of fieldsToCheck) {
            if (!existingLeadRecord[field] && leadData[field]) {
              updates[field] = leadData[field]
              hasUpdates = true
            }
          }
          
          // Always update if new status is more advanced (not 'new')
          if (leadData.status && leadData.status !== 'new' && existingLead.status === 'new') {
            updates.status = leadData.status
            hasUpdates = true
          }
          
          if (hasUpdates) {
            updates.updated_at = new Date().toISOString()
            
            const { error: updateError } = await supabaseAdmin
              .from('leads')
              .update(updates)
              .eq('id', existingLead.id)

            if (updateError) {
              throw updateError
            }
            updatedCount++
            console.log(`Updated lead ${existingLead.id} with fields:`, Object.keys(updates))
          } else {
            console.log(`Skipping duplicate lead - no new information: ${existingLead.id}`)
          }
          leadId = existingLead.id
        } else {
          // Insert new lead
          const { data: newLead, error: insertError } = await supabaseAdmin
            .from('leads')
            .insert(leadData)
            .select('id')
            .single()

          if (insertError) {
            throw insertError
          }
          leadId = newLead.id
          importedCount++
          console.log(`Imported lead: ${leadId}`)
        }

        // Add notes as lead_update if enabled and notes exist
        if (addNotesAsUpdates && rowData.notes && rowData.notes.trim()) {
          const { error: updateError } = await supabaseAdmin
            .from('lead_updates')
            .insert({
              lead_id: leadId,
              user_id: user.id,
              content: rowData.notes.trim()
            })

          if (updateError) {
            console.error(`Error adding update for lead ${leadId}:`, updateError)
          } else {
            updatesAddedCount++
          }
        }

      } catch (error: any) {
        console.error(`Error processing row ${i + 1}:`, error)
        errors.push(`Row ${i + 1}: ${error.message}`)
      }
    }

    console.log(`Import complete: ${importedCount} imported, ${updatedCount} updated, ${updatesAddedCount} updates added`)

    return new Response(
      JSON.stringify({
        success: true,
        imported: importedCount,
        updated: updatedCount,
        updatesAdded: updatesAddedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Import error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
