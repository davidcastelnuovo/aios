// Periodic job: ensures every connected calendar has a healthy push channel.
// - Renews channels expiring in the next 48 hours.
// - Starts channels for connected users that don't have one yet.
// Designed to run hourly via pg_cron.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const renewBefore = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: tokens, error } = await serviceClient
      .from('calendar_tokens')
      .select('user_id, watch_channel_id, watch_expires_at, needs_reconnect')
      .eq('needs_reconnect', false);

    if (error) throw error;

    const due = (tokens || []).filter((t: any) =>
      !t.watch_channel_id || !t.watch_expires_at || t.watch_expires_at < renewBefore
    );

    const results: any[] = [];
    for (const t of due) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/google-calendar-watch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
          body: JSON.stringify({ user_id: t.user_id }),
        });
        const body = await r.json().catch(() => ({}));
        results.push({ user_id: t.user_id, ok: r.ok, body });
      } catch (e) {
        results.push({ user_id: t.user_id, ok: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ checked: tokens?.length || 0, renewed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('cron-renew-calendar-watches error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
