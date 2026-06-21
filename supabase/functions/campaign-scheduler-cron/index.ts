// Campaign Scheduler Cron — picks campaign_schedules rows whose next_run_at has arrived
// and executes pause/resume via carmen-fb-tools / carmen-google-tools.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

const SB_URL = Deno.env.get('SUPABASE_URL')!;
const SB_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function pickFn(entity_type: string): { fn: string; level?: string } | null {
  if (entity_type.startsWith('fb_')) return { fn: 'carmen-fb-tools' };
  if (entity_type.startsWith('google_')) return { fn: 'carmen-google-tools' };
  return null;
}

// Minimal cron-next calc: only supports HH:MM daily ("min hour * * *") and "min hour * * dow"
// For richer cron use: rely on run_at for one-shot, and store next_run_at upfront.
function naiveNextRun(cron: string, fromUtc: Date, tz = 'Asia/Jerusalem'): Date | null {
  // Format: "min hour * * *" or "min hour * * dow"
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minStr, hourStr, , , dowStr] = parts;
  const minute = parseInt(minStr, 10);
  const hour = parseInt(hourStr, 10);
  if (Number.isNaN(minute) || Number.isNaN(hour)) return null;
  const allowedDows = dowStr === '*' ? null : dowStr.split(',').map(d => parseInt(d, 10)).filter(d => !Number.isNaN(d));
  // Compute next occurrence in tz
  for (let i = 1; i <= 8; i++) {
    const d = new Date(fromUtc.getTime() + i * 60 * 1000); // start a minute after now
    // Convert to tz
    const tzDate = new Date(d.toLocaleString('en-US', { timeZone: tz }));
    // brute-force forward day-by-day up to 8 days
    for (let day = 0; day < 8; day++) {
      const candidate = new Date(tzDate);
      candidate.setDate(candidate.getDate() + day);
      candidate.setHours(hour, minute, 0, 0);
      if (candidate.getTime() <= tzDate.getTime()) continue;
      if (allowedDows && !allowedDows.includes(candidate.getDay())) continue;
      // Convert candidate (in tz) back to UTC
      const utcGuess = new Date(candidate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const offset = candidate.getTime() - utcGuess.getTime();
      return new Date(candidate.getTime() - offset);
    }
    break;
  }
  return null;
}

async function invokeEdgeFn(name: string, payload: any) {
  const r = await fetch(`${SB_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SB_SERVICE}`,
      'Content-Type': 'application/json',
      'apikey': SB_SERVICE,
    },
    body: JSON.stringify(payload),
  });
  const json = await r.json().catch(() => ({}));
  return { ok: r.ok, json };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(SB_URL, SB_SERVICE);
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: due } = await supabase
      .from('campaign_schedules')
      .select('*')
      .eq('enabled', true)
      .not('approved_at', 'is', null)
      .lte('next_run_at', nowIso)
      .limit(50);

    const results: any[] = [];
    for (const row of (due || [])) {
      const route = pickFn(row.entity_type);
      if (!route) {
        await supabase.from('campaign_schedules').update({ last_run_at: nowIso, last_run_status: 'failed', last_run_error: 'unknown_entity_type' }).eq('id', row.id);
        continue;
      }

      const payload: any = {
        tenant_id: row.tenant_id,
        action: row.action,
        confirmed: true,
      };
      if (route.fn === 'carmen-fb-tools') payload.entity_id = row.entity_id;
      if (route.fn === 'carmen-google-tools') {
        payload.campaign_id = row.entity_id;
        // customer_id stored in notes? In a richer impl we'd add a column. For now expect entity_id format "customer/campaign"
        const parts = String(row.entity_id).split('/');
        if (parts.length === 2) { payload.customer_id = parts[0]; payload.campaign_id = parts[1]; }
        else { payload.customer_id = row.tenant_id; }
      }

      const r = await invokeEdgeFn(route.fn, payload);

      // Compute next_run_at
      let nextRun: string | null = null;
      let stillEnabled = row.enabled;
      if (row.cron_expression) {
        const next = naiveNextRun(row.cron_expression, now, row.timezone || 'Asia/Jerusalem');
        nextRun = next ? next.toISOString() : null;
      } else {
        // one-shot run_at — disable after running
        stillEnabled = false;
      }

      await supabase.from('campaign_schedules').update({
        last_run_at: nowIso,
        last_run_status: r.ok ? 'success' : 'failed',
        last_run_error: r.ok ? null : JSON.stringify(r.json).slice(0, 500),
        next_run_at: nextRun,
        enabled: stillEnabled,
      }).eq('id', row.id);

      results.push({ id: row.id, ok: r.ok, action: row.action, entity_id: row.entity_id });
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error('[campaign-scheduler-cron]', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
