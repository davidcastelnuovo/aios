import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GSC_PERIOD_DEFINITIONS,
  fetchGscKeywordsFromApi,
  gscPeriodBounds,
  resolveGscAccessToken,
  upsertGscSnapshot,
} from "../_shared/gscKeywords.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 6;
const STALE_HOURS = 20;

type SyncTarget = {
  tenantId: string;
  clientId: string;
  siteUrl: string;
};

function collectSyncTargets(integrations: Array<{ tenant_id: string; settings: unknown }>): SyncTarget[] {
  const seen = new Set<string>();
  const targets: SyncTarget[] = [];

  for (const integration of integrations) {
    const settings = (integration.settings as Record<string, unknown>) || {};
    const clientSites = (settings.client_sites as Record<string, string>) || {};
    for (const [clientId, siteUrl] of Object.entries(clientSites)) {
      if (!clientId || !siteUrl) continue;
      const key = `${integration.tenant_id}|${siteUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      targets.push({ tenantId: integration.tenant_id, clientId, siteUrl });
    }
  }
  return targets;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let batchOffset = 0;
  let forceAll = false;
  try {
    const body = await req.json();
    batchOffset = Number(body?.batch_offset) || 0;
    forceAll = body?.force === true;
  } catch {
    /* empty cron body */
  }

  const startedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  try {
    const { data: integrations, error } = await supabase
      .from("tenant_integrations")
      .select("id, tenant_id, settings")
      .eq("integration_type", "google_search_console")
      .eq("is_active", true);

    if (error) throw error;

    const allTargets = collectSyncTargets(integrations || []);

    // Skip targets synced recently unless force=true
    let pending = allTargets;
    if (!forceAll && allTargets.length > 0) {
      const siteUrls = [...new Set(allTargets.map((t) => t.siteUrl))];
      const tenantIds = [...new Set(allTargets.map((t) => t.tenantId))];
      const staleBefore = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();

      const { data: freshSnaps } = await supabase
        .from("gsc_keyword_snapshots")
        .select("tenant_id, site_url, synced_at")
        .in("tenant_id", tenantIds)
        .in("site_url", siteUrls)
        .eq("period_key", "current_90d")
        .gte("synced_at", staleBefore);

      const freshKeys = new Set(
        (freshSnaps || []).map((s) => `${s.tenant_id}|${s.site_url}`),
      );
      pending = allTargets.filter((t) => !freshKeys.has(`${t.tenantId}|${t.siteUrl}`));
    }

    const batch = pending.slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = pending.length > batchOffset + BATCH_SIZE;

    console.log(
      `[cron-gsc-keywords] offset=${batchOffset} batch=${batch.length} pending=${pending.length} total=${allTargets.length} hasMore=${hasMore}`,
    );

    if (hasMore) {
      fetch(`${supabaseUrl}/functions/v1/cron-sync-gsc-keywords`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ batch_offset: batchOffset + BATCH_SIZE, force: forceAll }),
      }).catch((e) => console.error("[cron-gsc-keywords] next batch failed:", e?.message));
    }

    for (const target of batch) {
      const tenantList = [target.tenantId];
      try {
        const accessToken = await resolveGscAccessToken(supabase, tenantList);
        if (!accessToken) {
          results.push({ ...target, status: "skipped", reason: "no_token" });
          continue;
        }

        let totalRows = 0;
        for (const period of GSC_PERIOD_DEFINITIONS) {
          const { startDate, endDate } = gscPeriodBounds(period);
          const keywords = await fetchGscKeywordsFromApi(
            accessToken,
            target.siteUrl,
            startDate,
            endDate,
            period.maxRows,
          );
          await upsertGscSnapshot(supabase, {
            tenantId: target.tenantId,
            clientId: target.clientId,
            siteUrl: target.siteUrl,
            periodKey: period.key,
            startDate,
            endDate,
            keywords,
          });
          totalRows += keywords.length;
        }

        results.push({ ...target, status: "ok", rows: totalRows });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[cron-gsc-keywords] target failed:", target, msg);
        results.push({ ...target, status: "error", error: msg });
      }
    }

    return new Response(
      JSON.stringify({
        startedAt,
        total_targets: allTargets.length,
        pending: pending.length,
        batch_offset: batchOffset,
        synced: results.filter((r) => r.status === "ok").length,
        results,
        hasMore,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[cron-gsc-keywords] fatal:", msg);
    return new Response(JSON.stringify({ error: msg, startedAt, results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
