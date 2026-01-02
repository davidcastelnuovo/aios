import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SheetRow {
  company_name?: string;
  phone?: string;
  email?: string;
  created_at?: string;
  source?: string;
  status?: string;
  notes?: string;
  contact_name?: string;
}

// Column name mappings (Hebrew and English)
const columnMappings: Record<string, keyof SheetRow> = {
  // Hebrew
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
  // English
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sheetId, range, agencyId, addNotesAsUpdates = true } = await req.json()

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

    // Get user's tenant
    const { data: tenantUser, error: tenantError } = await supabaseUser
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()

    if (tenantError || !tenantUser) {
      return new Response(
        JSON.stringify({ error: 'User tenant not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tenantId = tenantUser.tenant_id
    console.log(`Importing leads for tenant: ${tenantId}, agency: ${agencyId}`)

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
    const headers = rows[0].map((h: string) => h.trim().toLowerCase())
    console.log('Sheet headers:', headers)

    // Map headers to our fields
    const headerMapping: Record<number, keyof SheetRow> = {}
    headers.forEach((header: string, index: number) => {
      const mapped = columnMappings[header]
      if (mapped) {
        headerMapping[index] = mapped
      }
    })
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
      const rowData: SheetRow = {}

      // Map row values to fields
      row.forEach((value: string, index: number) => {
        const field = headerMapping[index]
        if (field && value) {
          rowData[field] = value.trim()
        }
      })

      // Skip empty rows
      if (!rowData.company_name && !rowData.phone && !rowData.email) {
        continue
      }

      // Prepare lead data
      const leadData: Record<string, any> = {
        company_name: rowData.company_name || rowData.phone || 'Unknown',
        phone: rowData.phone || null,
        email: rowData.email || null,
        contact_name: rowData.contact_name || null,
        notes: rowData.notes || null,
        tenant_id: tenantId,
        agency_id: agencyId || null,
      }

      // Map source
      if (rowData.source) {
        const sourceLower = rowData.source.toLowerCase()
        leadData.source = sourceMappings[sourceLower] || 'other'
      }

      // Map status
      if (rowData.status) {
        const statusLower = rowData.status.toLowerCase()
        leadData.status = statusMappings[statusLower] || 'new'
      }

      // Parse created_at date
      if (rowData.created_at) {
        try {
          // Try parsing various date formats
          const dateStr = rowData.created_at
          let parsedDate: Date | null = null
          
          // Try DD/MM/YYYY format
          const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
          if (ddmmyyyy) {
            parsedDate = new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`)
          }
          
          // Try YYYY-MM-DD format
          if (!parsedDate || isNaN(parsedDate.getTime())) {
            parsedDate = new Date(dateStr)
          }
          
          if (parsedDate && !isNaN(parsedDate.getTime())) {
            leadData.created_at = parsedDate.toISOString()
          }
        } catch (e) {
          console.log(`Could not parse date: ${rowData.created_at}`)
        }
      }

      try {
        // Check if lead exists by phone or email
        let existingLead = null
        if (rowData.phone) {
          const { data } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('phone', rowData.phone)
            .maybeSingle()
          existingLead = data
        }
        
        if (!existingLead && rowData.email) {
          const { data } = await supabaseAdmin
            .from('leads')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('email', rowData.email)
            .maybeSingle()
          existingLead = data
        }

        let leadId: string

        if (existingLead) {
          // Update existing lead
          const { error: updateError } = await supabaseAdmin
            .from('leads')
            .update({
              ...leadData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id)

          if (updateError) {
            throw updateError
          }
          leadId = existingLead.id
          updatedCount++
          console.log(`Updated lead: ${leadId}`)
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
