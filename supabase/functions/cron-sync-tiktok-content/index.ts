import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: tables, error } = await supabaseAdmin
      .from('crm_tables')
      .select('id, name, tenant_id')
      .eq('integration_type', 'tiktok_content');
    if (error) throw error;

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const results: any[] = [];

    for (const table of tables || []) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/sync-tiktok-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'x-cron-internal': 'true',
          },
          body: JSON.stringify({ table_id: table.id, _internal_cron: true }),
        });
        const body = await res.json();
        console.log(`[cron-tiktok] ${table.name} (${table.id}): ${res.status}`, body?.records_synced ?? body?.error);
        results.push({ table_id: table.id, name: table.name, ok: res.ok, ...body });
      } catch (e: any) {
        console.error(`[cron-tiktok] failed for ${table.id}:`, e.message);
        results.push({ table_id: table.id, name: table.name, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, total: tables?.length || 0, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('cron-sync-tiktok-content error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
