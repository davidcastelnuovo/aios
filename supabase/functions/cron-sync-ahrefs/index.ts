import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function needsSyncThisMonth(lastSyncAt: string | null | undefined): boolean {
  if (!lastSyncAt) return true;
  const d = new Date(lastSyncAt);
  if (Number.isNaN(d.getTime())) return true;
  const now = new Date();
  return d.getUTCFullYear() !== now.getUTCFullYear() || d.getUTCMonth() !== now.getUTCMonth();
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

    const pending = forceAll
      ? seoTables
      : seoTables.filter((t) =>
          needsSyncThisMonth((t.integration_settings as any)?.last_sync_at)
        );

    const tables = pending.slice(batchOffset, batchOffset + BATCH_SIZE);
    const hasMore = pending.length > batchOffset + BATCH_SIZE;

    console.log(
      `[cron-ahrefs] offset=${batchOffset} batch=${tables.length} pending=${pending.length} seo=${seoTables.length} dryRun=${dryRun} hasMore=${hasMore}`,
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          startedAt,
          dry_run: true,
          total_seo_tables: seoTables.length,
          pending_this_month: pending.length,
          batch_offset: batchOffset,
          batch: tables.map((t) => ({
            tableId: t.id,
            name: t.name,
            tenant_id: t.tenant_id,
            client_id: t.client_id,
            last_sync_at: (t.integration_settings as any)?.last_sync_at ?? null,
          })),
          hasMore,
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
      const clientId =
        (settings.clientId as string) || (settings.client_id as string) || t.client_id;
      const domain =
        (settings.targetDomain as string) || (settings.target as string) || (settings.domain as string);

      if (!clientId) {
        results.push({ tableId: t.id, status: "skipped", reason: "missing clientId" });
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
          });
          continue;
        }

        const syncedAt = new Date().toISOString();
        await supabase
          .from("crm_tables")
          .update({
            integration_settings: { ...settings, last_sync_at: syncedAt },
          })
          .eq("id", t.id);

        results.push({
          tableId: t.id,
          name: t.name,
          status: "success",
          domain: fetchJson?.domain ?? domain ?? null,
          keywords_count: fetchJson?.keywords_count ?? null,
          tracked_count: fetchJson?.tracked_count ?? null,
          last_sync_at: syncedAt,
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
