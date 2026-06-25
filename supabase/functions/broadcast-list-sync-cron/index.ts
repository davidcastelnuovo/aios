// broadcast-list-sync-cron — re-syncs dynamic (Google Sheet) broadcast lists by
// re-invoking import-broadcast-list-sheet with each list's stored source_config.
// Schedule via pg_cron (e.g. hourly).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = createClient(SB_URL, SB_SERVICE, { auth: { persistSession: false } });
    const { data: lists } = await db
      .from('broadcast_lists')
      .select('id, tenant_id, source_config')
      .eq('auto_sync_enabled', true)
      .eq('source', 'google_sheet')
      .limit(50);

    const results: any[] = [];
    for (const l of lists || []) {
      const cfg = l.source_config || {};
      if (!cfg.sheetId) continue;
      const r = await fetch(`${SB_URL}/functions/v1/import-broadcast-list-sheet`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${SB_SERVICE}`, 'Content-Type': 'application/json', apikey: SB_SERVICE },
        body: JSON.stringify({ listId: l.id, tenantId: l.tenant_id, sheetId: cfg.sheetId, range: cfg.range, fieldMap: cfg.fieldMap }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        await db.from('broadcast_lists').update({ last_sync_status: 'failed', last_synced_at: new Date().toISOString() }).eq('id', l.id);
      }
      results.push({ id: l.id, ok: r.ok, total: j?.total });
    }
    return new Response(JSON.stringify({ success: true, synced: results.length, results }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[broadcast-list-sync-cron]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
