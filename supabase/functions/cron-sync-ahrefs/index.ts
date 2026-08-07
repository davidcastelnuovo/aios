import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  needsSeoSyncThisMonth,
  pickSeoSyncDomain,
} from "../_shared/seo-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEO_REPORT_SOURCES = new Set(["ahrefs_reports", "seo_unified"]);
const BATCH_SIZE = 4;

function isSeoReportTable(settings: Record<string, unknown> | null | undefined): boolean {
  const ds = settings?.data_source;
  return typeof ds === "string" && SEO_REPORT_SOURCES.has(ds);
}

function clientIdFromTable(t: {
  client_id?: string | null;
  integration_settings?: unknown;
}): string | null {
  const settings = (t.integration_settings as Record<string, unknown>) || {};
  return (
    (settings.clientId as string) ||
    (settings.client_id as string) ||
    t.client_id ||
    null
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const startedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  let batchOffset = 0;
  let dryRun = false;
  let forceAll = false;
  try {
    const body = await req.json();
    batchOffset = Number(body?.batch_offset) || 0;
    dryRun = body?.dry_run === true;
    forceAll = body?.force === true;
  } catch {
    /* empty cron body */
  }

  try {
    const { data: allTables, error: tablesError } = await supabase
      .from("crm_tables")
      .select("id, tenant_id, name, client_id, integration_settings, integration_type")
      .eq("integration_type", "ahrefs")
      .order("id");

    if (tablesError) throw tablesError;

    const seoTables = (allTables || []).filter((t) =>
      isSeoReportTable((t.integration_settings as Record<string, unknown>) || {})
    );

    const clientIds = Array.from(
      new Set(seoTables.map((t) => clientIdFromTable(t)).filter(Boolean) as string[]),
    );

    const latestReportByClient = new Map<string, { domain?: string; received_at?: string }>();
    if (clientIds.length > 0) {
      const { data: reportRows } = await supabase
        .from("ahrefs_reports")
        .select("client_id, domain, received_at")
        .in("client_id", clientIds)
        .order("received_at", { ascending: false });
      for (const row of reportRows || []) {
        if (row.client_id && !latestReportByClient.has(row.client_id)) {
          latestReportByClient.set(row.client_id, row);
        }
      }
    }

    const clientRows = new Map<string, { name?: string; website?: string | null; ahrefs_domain?: string | null }>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, website, ahrefs_domain")
        .in("id", clientIds);
      for (const c of clients || []) {
        if (c.id) clientRows.set(c.id, c);
      }
    }

    const pending = forceAll
      ? seoTables
      : seoTables.filter((t) => {
          const settings = (t.integration_settings as Record<string, unknown>) || {};
          const clientId = clientIdFromTable(t);
          const latest = clientId ? latestReportByClient.get(clientId) : undefined;
          return needsSeoSyncThisMonth(
            settings.last_sync_at as string | undefined,
            latest?.received_at,
          );
        });

    const tables = pending.slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = pending.length > batchOffset + BATCH_SIZE;

    console.log(
      `[cron-ahrefs] offset=${batchOffset} batch=${tables.length} pending=${pending.length} seo=${seoTables.length} dryRun=${dryRun} hasMore=${hasMore}`,
    );

    if (dryRun) {
      const batchDetails = tables.map((t) => {
        const settings = (t.integration_settings as Record<string, unknown>) || {};
        const clientId = clientIdFromTable(t);
        const client = clientId ? clientRows.get(clientId) : null;
        const latest = clientId ? latestReportByClient.get(clientId) : undefined;
        const resolved = pickSeoSyncDomain({
          settings,
          client,
          tableName: t.name,
          latestReportDomain: latest?.domain,
        });
        return {
          tableId: t.id,
          name: t.name,
          tenant_id: t.tenant_id,
          client_id: clientId,
          client_name: client?.name ?? null,
          website: client?.website ?? null,
          ahrefs_domain: client?.ahrefs_domain ?? null,
          targetDomain: settings.targetDomain ?? null,
          linkedGscSiteUrl: settings.linkedGscSiteUrl ?? null,
          latest_report_domain: latest?.domain ?? null,
          latest_report_received_at: latest?.received_at ?? null,
          table_last_sync_at: settings.last_sync_at ?? null,
          resolved_domain: resolved.domain || null,
          resolved_from: resolved.from,
          client_missing: clientId && !client,
        };
      });

      return new Response(
        JSON.stringify({
          startedAt,
          dry_run: true,
          total_seo_tables: seoTables.length,
          pending_this_month: pending.length,
          batch_offset: batchOffset,
          batch: batchDetails,
          hasMore,
          note:
            "UI 'סונכרן' = ahrefs_reports.received_at; CategorySyncControl/cron used only integration_settings.last_sync_at until aligned.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (hasMore) {
      fetch(`${supabaseUrl}/functions/v1/cron-sync-ahrefs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ batch_offset: batchOffset + BATCH_SIZE, force: forceAll }),
      }).catch((e) => console.error("[cron-ahrefs] next batch trigger failed:", e?.message));
    }

    for (const t of tables) {
      const settings = (t.integration_settings as Record<string, unknown>) || {};
      const clientId = clientIdFromTable(t);

      if (!clientId) {
        results.push({ tableId: t.id, status: "skipped", reason: "missing clientId" });
        continue;
      }

      const client = clientRows.get(clientId);
      if (!client) {
        results.push({
          tableId: t.id,
          name: t.name,
          status: "skipped",
          reason: "client not found — orphaned SEO table; re-link or delete",
        });
        continue;
      }

      const latest = latestReportByClient.get(clientId);
      const resolved = pickSeoSyncDomain({
        settings,
        client,
        tableName: t.name,
        latestReportDomain: latest?.domain,
      });
      const domain = resolved.domain;

      if (!domain) {
        results.push({
          tableId: t.id,
          name: t.name,
          status: "skipped",
          reason: "no domain — set דומיין Ahrefs / אתר בחיבורים, GSC link, or sync Ahrefs once",
          client_name: client.name,
        });
        continue;
      }

      try {
        const fetchRes = await fetch(`${supabaseUrl}/functions/v1/fetch-ahrefs-snapshot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
          },
          body: JSON.stringify({
            clientId,
            domain,
            country: (settings.country as string) || "il",
            ...(settings.ahrefs_project_id ? { projectId: settings.ahrefs_project_id } : {}),
            ...(settings.ahrefs_mode ? { mode: settings.ahrefs_mode } : {}),
            ...(settings.ahrefs_protocol ? { protocol: settings.ahrefs_protocol } : {}),
          }),
        });

        const fetchJson = await fetchRes.json().catch(() => ({}));
        if (!fetchRes.ok || fetchJson?.error) {
          results.push({
            tableId: t.id,
            name: t.name,
            status: "failed",
            error: fetchJson?.error || fetchRes.statusText,
            details: fetchJson?.details ?? null,
            resolved_domain: domain,
            resolved_from: resolved.from,
          });
          continue;
        }

        const syncedAt = new Date().toISOString();
        await supabase
          .from("crm_tables")
          .update({
            integration_settings: { ...settings, last_sync_at: syncedAt, targetDomain: domain },
          })
          .eq("id", t.id);

        results.push({
          tableId: t.id,
          name: t.name,
          status: "success",
          domain: fetchJson?.domain ?? domain,
          resolved_from: resolved.from,
          keywords_count: fetchJson?.keywords_count ?? null,
          tracked_count: fetchJson?.tracked_count ?? null,
          last_sync_at: syncedAt,
          previous_report_received_at: latest?.received_at ?? null,
        });
      } catch (e: unknown) {
        results.push({
          tableId: t.id,
          name: t.name,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const success = results.filter((r) => r.status === "success").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return new Response(
      JSON.stringify({
        startedAt,
        finishedAt: new Date().toISOString(),
        batch_offset: batchOffset,
        total_seo_tables: seoTables.length,
        pending_this_month: pending.length,
        batch_size: tables.length,
        hasMore,
        success,
        failed,
        skipped,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("[cron-ahrefs] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
