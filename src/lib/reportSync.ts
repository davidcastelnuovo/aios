import { supabase } from "@/integrations/supabase/client";
import { isSeoReportSource } from "@/lib/seoReports";

export interface SyncableReportTable {
  id: string;
  tenant_id?: string | null;
  client_id?: string | null;
  integration_type?: string | null;
  integration_settings?: Record<string, unknown> | null;
}

export interface ReportSyncResult {
  tableId: string;
  status: "synced" | "skipped" | "failed";
  error?: string;
}

const dateRange = () => {
  const endDate = new Date().toISOString().slice(0, 10);
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 90);
  return { startDate: start.toISOString().slice(0, 10), endDate };
};

async function invoke(functionName: string, body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    method: "POST",
    body,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
}

export async function syncReportTable(table: SyncableReportTable): Promise<ReportSyncResult> {
  const type = table.integration_type;
  const settings = table.integration_settings || {};
  const range = dateRange();

  try {
    switch (type) {
      case "facebook_insights":
        await invoke("sync-facebook-insights", { table_id: table.id, tableId: table.id });
        break;
      case "facebook_ecommerce":
        await invoke("sync-facebook-ecommerce", { table_id: table.id, tableId: table.id });
        break;
      case "google_ads":
        await invoke("sync-google-ads-data", { table_id: table.id });
        break;
      case "google_analytics":
        await invoke("sync-google-analytics-data", { tableId: table.id, ...range });
        break;
      case "google_search_console":
        await invoke("sync-google-search-console-data", { tableId: table.id, ...range });
        break;
      case "ahrefs": {
        if (isSeoReportSource(settings.data_source)) {
          const clientId = settings.clientId || settings.client_id || table.client_id;
          if (!clientId) throw new Error("Missing client ID for SEO report");
          await invoke("fetch-ahrefs-snapshot", {
            clientId,
            domain: settings.targetDomain || settings.target || settings.domain,
            country: settings.country || "il",
            ...(settings.ahrefs_project_id ? { projectId: settings.ahrefs_project_id } : {}),
          });
        } else {
          await invoke("sync-ahrefs-data", {
            tableId: table.id,
            table_id: table.id,
            config: {
              target: settings.targetDomain || settings.target || settings.domain,
              dataType: settings.reportType || settings.dataType || "site_explorer",
              country: settings.country,
              limit: settings.limit,
            },
          });
        }
        break;
      }
      default:
        return { tableId: table.id, status: "skipped" };
    }
    return { tableId: table.id, status: "synced" };
  } catch (error: unknown) {
    console.error(`[reportSync] Failed to sync table ${table.id}:`, error);
    return {
      tableId: table.id,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function syncReportTables(
  tables: SyncableReportTable[],
  concurrency = 2,
): Promise<ReportSyncResult[]> {
  const results: ReportSyncResult[] = new Array(tables.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(concurrency, 1), Math.max(tables.length, 1)) },
    async () => {
      while (cursor < tables.length) {
        const index = cursor++;
        results[index] = await syncReportTable(tables[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export async function waitForSnapshotReady(
  node: HTMLElement,
  timeoutMs = 30_000,
  options?: { settleMs?: number; pollMs?: number },
): Promise<void> {
  const settleMs = options?.settleMs ?? 200;
  const pollMs = options?.pollMs ?? 100;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const ready =
      node.dataset.snapshotReady === "true" ||
      !!node.querySelector('[data-snapshot-ready="true"]');
    if (ready) {
      // Brief settle so fonts/layout finish — keep this short; capture already
      // waits on data-snapshot-ready from the report itself.
      if (settleMs > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, settleMs));
      }
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, pollMs));
  }
  throw new Error("הדוח לא סיים להיטען בזמן");
}
