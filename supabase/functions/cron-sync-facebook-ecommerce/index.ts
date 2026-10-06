import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { kickNextBatch } from '../_shared/kick-next-batch.ts';
import { jerusalemToday, planScheduledSyncWindows } from '../_shared/report-sync-window.ts';

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

    let body: any = {};
    try { body = await req.json(); } catch { /* cron posts an empty body */ }
    const batchOffset = Number(body.batch_offset) || 0;
    const BATCH_SIZE = 4;

    // Skip explicitly paused campaigns (campaign_active = false) — those are
    // excluded from pulse/health too, so there is no point refreshing them.
    const { data: allTables, error } = await supabaseAdmin
      .from('crm_tables')
      .select('id, name, tenant_id, campaign_active, integration_settings')
      .eq('integration_type', 'facebook_ecommerce')
      .not('campaign_active', 'is', false)
      .order('id');

    if (error) throw error;

    const tables = (allTables || []).slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = (allTables || []).length > batchOffset + BATCH_SIZE;
    console.log(`[cron-sync-facebook-ecommerce] batch offset=${batchOffset} size=${tables.length} of ${allTables?.length || 0}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const results: any[] = [];
    const today = jerusalemToday();

    const postSync = async (payload: Record<string, unknown>) => {
      const res = await fetch(`${supabaseUrl}/functions/v1/sync-facebook-ecommerce`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
          'x-cron-internal': 'true',
        },
        body: JSON.stringify({ ...payload, _internal_cron: true }),
      });
      const responseBody = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, body: responseBody };
    };

    for (const table of tables) {
      try {
        const settings = (table.integration_settings || {}) as { scheduled_history_from?: string };
        const plan = planScheduledSyncWindows(today, settings.scheduled_history_from);
        if (plan.catchup) {
          const chunk = await postSync({
            table_id: table.id,
            start_date: plan.catchup.startDate,
            end_date: plan.catchup.endDate,
            scheduled_history_from: plan.historyFrom,
            update_last_sync: false,
          });
          if (!chunk.ok) {
            results.push({ table_id: table.id, name: table.name, ok: false, stage: 'catchup', ...chunk.body });
            continue;
          }
        }
        const refreshed = await postSync({
          table_id: table.id,
          start_date: plan.refresh.startDate,
          end_date: plan.refresh.endDate,
          ...(plan.catchup ? {} : { scheduled_history_from: plan.historyFrom }),
        });
        console.log(`[cron] ${table.name} (${table.id}): ${refreshed.status}`, refreshed.body?.records_synced ?? refreshed.body?.error);
        results.push({ table_id: table.id, name: table.name, ok: refreshed.ok, ...refreshed.body });
      } catch (e: any) {
        console.error(`[cron] failed for ${table.id}:`, e.message);
        results.push({ table_id: table.id, name: table.name, ok: false, error: e.message });
      }
    }

    if (hasMore) {
      await kickNextBatch(supabaseAdmin, 'cron-sync-facebook-ecommerce', { batch_offset: batchOffset + BATCH_SIZE });
    } else {
      // Pulse reads these rows. Refresh the snapshot after the chain finishes;
      // do not send WhatsApp from the sync.
      const pulseResponse = await fetch(`${supabaseUrl}/functions/v1/campaign-pulse-snapshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ deliver: false, source: 'post_facebook_ecommerce_sync' }),
      });
      if (!pulseResponse.ok) {
        console.error('[cron-sync-facebook-ecommerce] pulse calculation failed:', await pulseResponse.text());
      }
    }

    return new Response(JSON.stringify({ success: true, total: allTables?.length || 0, batch_offset: batchOffset, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    console.error('Error in cron-sync-facebook-ecommerce:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
