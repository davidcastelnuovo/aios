// One-off import for tenant פ.ד פסגות. Safe to leave; idempotent via DELETE+INSERT for empty tenant only when ?reset=1.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import leads from './leads.json' with { type: 'json' }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TENANT = 'ac7f9a3e-a042-4a64-afea-53e21a544d3d'
const USER = 'bcd21d1c-3b39-4a7c-9dbf-4c89679110b9'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Tag map (existing inserted earlier)
    const { data: tags } = await supabase.from('chat_tags').select('id,name').eq('tenant_id', TENANT)
    const tagMap = new Map<string,string>((tags ?? []).map(t => [t.name as string, t.id as string]))

    // Insert leads in batches
    const BATCH = 100
    let inserted = 0
    const tagLinks: { lead_id: string; tag_id: string }[] = []

    for (let i=0; i<leads.length; i+=BATCH) {
      const batch = leads.slice(i, i+BATCH).map((l: any) => {
        const id = crypto.randomUUID()
        const company = l.name || (l.email ? l.email.split('@')[0] : `ליד ${l.phone}`)
        const row = {
          id,
          tenant_id: TENANT,
          status: 'new',
          source: 'other',
          company_name: company,
          contact_name: l.name || null,
          email: l.email || null,
          phone: l.phone || null,
          notes: l.notes || null,
          campaign_name: l.form || null,
          created_at: l.date || new Date().toISOString(),
        }
        if (l.status && tagMap.has(l.status)) {
          tagLinks.push({ lead_id: id, tag_id: tagMap.get(l.status)! })
        }
        return row
      })
      const { error } = await supabase.from('leads').insert(batch)
      if (error) throw new Error(`leads batch ${i}: ${error.message}`)
      inserted += batch.length
    }

    // Insert tag links
    let linksInserted = 0
    for (let i=0; i<tagLinks.length; i+=BATCH) {
      const batch = tagLinks.slice(i, i+BATCH).map(l => ({
        tag_id: l.tag_id,
        user_id: USER,
        tenant_id: TENANT,
        lead_id: l.lead_id,
      }))
      const { error } = await supabase.from('chat_contact_tags').insert(batch)
      if (error) throw new Error(`ct batch ${i}: ${error.message}`)
      linksInserted += batch.length
    }

    return new Response(JSON.stringify({ ok: true, inserted, linksInserted, leads: leads.length, tagsAvailable: tagMap.size }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
