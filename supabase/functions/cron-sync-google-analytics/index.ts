import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 8;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse batch params
    let body: any = {};
    try { body = await req.json(); } catch {}
    const batchOffset: number = body.batch_offset || 0;
    const tableIds: string[] | null = body.table_ids || null;

    // Get Google Analytics tables
    let query = supabase
      .from('crm_tables')
      .select('id, name, tenant_id, integration_settings')
      .eq('integration_type', 'google_analytics')
      .order('id');

    if (tableIds && tableIds.length > 0) {
      query = query.in('id', tableIds);
    }

    const { data: allTables, error: tablesError } = await query;
    if (tablesError) {
      console.error('Error fetching GA tables:', tablesError);
      throw tablesError;
    }

    // Slice for current batch
    const tables = (allTables || []).slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = (allTables || []).length > batchOffset + BATCH_SIZE;

    const results = {
      total: (allTables || []).length,
      batch_offset: batchOffset,
      batch_size: tables.length,
      has_more: hasMore,
      synced: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Rolling 30-day window ending today
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const start = new Date(today);
    start.setDate(start.getDate() - 30);
    const startDate = start.toISOString().split('T')[0];

    for (const table of tables) {
      try {
        const settings = (table.integration_settings || {}) as any;
        const integrationId = settings?.integrationId || settings?.integration_id;
        const propertyId = settings?.propertyId || settings?.property_id;

        if (!integrationId || !propertyId) {
          console.log(`⏭ Skipping table ${table.name} — missing integration/property id`);
          continue;
        }

        const resp = await fetch(`${supabaseUrl}/functions/v1/sync-google-analytics-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            tableId: table.id,
            startDate,
            endDate,
          }),
        });

        if (!resp.ok) {
          const txt = await resp.text();
          console.error(`❌ GA sync failed for ${table.name}: ${txt}`);
          results.failed++;
          results.errors.push(`${table.name}: ${txt.slice(0, 200)}`);
          continue;
        }

        // Update last_sync_at
        await supabase
          .from('crm_tables')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('id', table.id);

        results.synced++;
      } catch (tableError: any) {
        console.error(`❌ Error syncing GA table ${table.name}:`, tableError.message);
        results.failed++;
        results.errors.push(`${table.name}: ${tableError.message}`);
      }
    }

    // Auto-invoke next batch if there are more tables
    if (hasMore && !tableIds) {
      const nextOffset = batchOffset + BATCH_SIZE;
      console.log(`🔄 Triggering next GA batch at offset ${nextOffset}...`);
      fetch(`${supabaseUrl}/functions/v1/cron-sync-google-analytics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ batch_offset: nextOffset }),
      }).catch(err => console.error('Failed to trigger next GA batch:', err));
    }

    return new Response(JSON.stringify({
      success: true,
      ...results,
      window: { startDate, endDate },
      completed_at: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('❌ GA cron sync error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
