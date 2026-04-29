import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();
  const results: any[] = [];

  try {
    // Find all crm_tables that are linked to a google_analytics integration.
    // We sync per-table because sync-google-analytics-data expects { tableId }.
    const { data: tables, error: tablesError } = await supabase
      .from('crm_tables')
      .select('id, tenant_id, name, integration_settings, integration_provider')
      .eq('integration_provider', 'google_analytics');

    if (tablesError) throw tablesError;

    console.log(`[cron-ga] Found ${tables?.length || 0} GA tables to sync`);

    // Compute 90-day window (per project rule).
    const endDate = new Date().toISOString().split('T')[0];
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const startDate = start.toISOString().split('T')[0];

    for (const t of tables || []) {
      const settings = (t.integration_settings as any) || {};
      const integrationId = settings.integrationId || settings.integration_id;
      const propertyId = settings.propertyId || settings.property_id;
      if (!integrationId || !propertyId) {
        results.push({ tableId: t.id, status: 'skipped', reason: 'missing integration/property' });
        continue;
      }

      // Skip if the linked integration is flagged needs_reauth.
      const { data: integ } = await supabase
        .from('tenant_integrations')
        .select('id, settings, is_active')
        .eq('id', integrationId)
        .maybeSingle();

      if (!integ || integ.is_active === false) {
        results.push({ tableId: t.id, status: 'skipped', reason: 'integration inactive or missing' });
        continue;
      }
      if ((integ.settings as any)?.needs_reauth) {
        results.push({ tableId: t.id, status: 'skipped', reason: 'needs_reauth' });
        continue;
      }

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/sync-google-analytics-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ tableId: t.id, startDate, endDate }),
        });

        const ok = resp.ok;
        const text = await resp.text();
        results.push({
          tableId: t.id,
          tenantId: t.tenant_id,
          name: t.name,
          status: ok ? 'success' : 'failed',
          httpStatus: resp.status,
          response: ok ? undefined : text.slice(0, 500),
        });

        // Record health.
        try {
          await supabase.rpc('record_integration_result', {
            p_tenant_id: t.tenant_id,
            p_provider: 'google_analytics',
            p_success: ok,
          });
        } catch (_e) { /* non-fatal */ }
      } catch (err: any) {
        results.push({ tableId: t.id, status: 'error', error: String(err?.message || err) });
        try {
          await supabase.rpc('record_integration_result', {
            p_tenant_id: t.tenant_id,
            p_provider: 'google_analytics',
            p_success: false,
          });
        } catch (_e) { /* non-fatal */ }
      }
    }

    const summary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      total: results.length,
      success: results.filter((r) => r.status === 'success').length,
      failed: results.filter((r) => r.status === 'failed' || r.status === 'error').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results,
    };
    console.log('[cron-ga] Done:', JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[cron-ga] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: String(error?.message || error), results }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
