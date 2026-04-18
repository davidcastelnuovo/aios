import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tables, error } = await supabase
      .from('crm_tables')
      .select('id, name, tenant_id')
      .eq('integration_type', 'google_analytics');

    if (error) throw error;
    console.log(`[cron-sync-google-analytics] Found ${tables?.length || 0} tables`);

    // Default last 30 days
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 30);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    const results: any[] = [];
    for (const table of tables || []) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/sync-google-analytics-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'x-cron-internal': 'true',
          },
          body: JSON.stringify({ tableId: table.id, startDate, endDate, _internal_cron: true }),
        });
        const body = await res.json().catch(() => ({}));
        console.log(`[cron-ga] ${table.name} (${table.id}): ${res.status}`, body?.error ?? 'ok');
        results.push({ table_id: table.id, name: table.name, ok: res.ok, ...body });
        // Throttle 2s between tables
        await new Promise(r => setTimeout(r, 2000));
      } catch (e: any) {
        console.error(`[cron-ga] failed for ${table.id}:`, e.message);
        results.push({ table_id: table.id, name: table.name, ok: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, total: tables?.length || 0, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('cron-sync-google-analytics error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
