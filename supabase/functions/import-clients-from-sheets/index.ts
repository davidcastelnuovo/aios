import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SheetRow {
  name?: string | null;
  agency_id?: string | null;
  phone?: string | null;
  email?: string | null;
  folder_link?: string | null;
  industry?: string | null;
  monthly_budget?: string | null;
  website?: string | null;
  notes?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sheetId, range } = await req.json()
    
    if (!sheetId) {
      throw new Error('Sheet ID is required')
    }

    const googleApiKey = Deno.env.get('GOOGLE_API_KEY')
    if (!googleApiKey) {
      throw new Error('Google API key not configured')
    }

    const sheetRange = !range || String(range).trim() === '' ? 'Sheet1!A:I' : String(range).trim()
    console.log('Fetching data from Google Sheets:', sheetId, sheetRange)

    // Fetch data from Google Sheets
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetRange}?key=${googleApiKey}`
    const sheetsResponse = await fetch(sheetsUrl)
    
    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text()
      console.error('Google Sheets API error:', errorText)
      throw new Error(`Failed to fetch from Google Sheets: ${sheetsResponse.statusText}`)
    }

    const sheetsData = await sheetsResponse.json()
    const rows = sheetsData.values as string[][]

    if (!rows || rows.length === 0) {
      throw new Error('No data found in the sheet')
    }

    console.log('Found rows:', rows.length)

    // First row is headers
    const headers = rows[0].map((h: string) => h.toLowerCase().trim())
    const dataRows = rows.slice(1)

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const clients: SheetRow[] = []
    const errors: string[] = []

    // Map rows to client objects
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      if (!row || row.length === 0) continue

      const client: SheetRow = {}
      
      headers.forEach((header: string, index: number) => {
        const value = row[index]?.trim() || null
        
        switch (header) {
          case 'name':
          case 'שם':
            client.name = value
            break
          case 'agency_id':
          case 'מזהה סוכנות':
          case 'סוכנות':
            client.agency_id = value
            break
          case 'phone':
          case 'טלפון':
            client.phone = value
            break
          case 'email':
          case 'אימייל':
            client.email = value
            break
          case 'folder_link':
          case 'קישור לתיקיה':
            client.folder_link = value
            break
          case 'industry':
          case 'תעשייה':
            client.industry = value
            break
          case 'monthly_budget':
          case 'תקציב חודשי':
            client.monthly_budget = value
            break
          case 'website':
          case 'אתר':
            client.website = value
            break
          case 'notes':
          case 'הערות':
            client.notes = value
            break
        }
      })

      if (!client.name) {
        errors.push(`Row ${i + 2}: Missing client name`)
        continue
      }

      if (!client.agency_id) {
        errors.push(`Row ${i + 2}: Missing agency ID for client ${client.name}`)
        continue
      }

      clients.push(client)
    }

    console.log('Valid clients to import:', clients.length)
    console.log('Errors:', errors.length)

    // Insert clients into database
    const { data, error } = await supabaseClient
      .from('clients')
      .insert(clients.map(c => ({
        name: c.name,
        agency_id: c.agency_id,
        phone: c.phone || null,
        email: c.email || null,
        folder_link: c.folder_link || null,
        industry: c.industry || null,
        monthly_budget: c.monthly_budget ? parseFloat(c.monthly_budget) : null,
        website: c.website || null,
        notes: c.notes || null,
      })))
      .select()

    if (error) {
      console.error('Database error:', error)
      throw error
    }

    console.log('Successfully imported:', data?.length || 0)

    return new Response(
      JSON.stringify({
        success: true,
        imported: data?.length || 0,
        errors: errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in import-clients-from-sheets:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
