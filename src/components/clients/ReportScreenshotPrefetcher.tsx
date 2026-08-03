import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DynamicTableView from "@/pages/DynamicTableView";
import { captureReportScreenshotNode } from "@/lib/captureReportScreenshot";
import {
  hasFreshReportScreenshot,
  reportScreenshotPrefetchDone,
  setCachedReportScreenshot,
  pickPrimaryReportTable,
} from "@/lib/reportScreenshotCache";

const MAX_PEER_PREFETCH = 12;
const GAP_BETWEEN_JOBS_MS = 400;

type TableRow = {
  id: string;
  slug?: string;
  client_id?: string;
  integration_type?: string;
  campaign_active?: boolean;
  name?: string;
};

interface Props {
  peerClientIds: string[];
  currentClientId: string;
  currentTableId?: string | null;
  allTables: TableRow[];
  /** Start only after the visible client's first paint is usable. */
  enabled: boolean;
}

/**
 * Off-screen sequential capture of peer clients' primary report tables so
 * switching clients in the filtered list feels instant (cache hit).
 * Skips sync — uses last stored data — and never blocks the UI.
 */
export function ReportScreenshotPrefetcher({
  peerClientIds,
  currentClientId,
  currentTableId,
  allTables,
  enabled,
}: Props) {
  const [job, setJob] = useState<{
    tableId: string;
    tableSlug: string;
    integrationType?: string;
  } | null>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: 5 * 60_000 } },
    });
  }
  const busyRef = useRef(false);
  const cancelledRef = useRef(false);

  const pickNextJob = useCallback(() => {
    const peers = peerClientIds
      .filter((id) => id !== currentClientId)
      .slice(0, MAX_PEER_PREFETCH);

    for (const clientId of peers) {
      const primary = pickPrimaryReportTable(allTables, clientId);
      if (!primary) continue;
      if (primary.id === currentTableId) continue;
      if (reportScreenshotPrefetchDone.has(primary.id)) continue;
      if (hasFreshReportScreenshot(primary.id)) {
        reportScreenshotPrefetchDone.add(primary.id);
        continue;
      }
      return {
        tableId: primary.id,
        tableSlug: primary.slug,
        integrationType: primary.integration_type,
      };
    }
    return null;
  }, [peerClientIds, currentClientId, currentTableId, allTables]);

  const advance = useCallback(() => {
    if (cancelledRef.current || busyRef.current || !enabled) return;
    const next = pickNextJob();
    if (!next) {
      setJob(null);
      return;
    }
    busyRef.current = true;
    reportScreenshotPrefetchDone.add(next.tableId);
    setJob(next);
  }, [enabled, pickNextJob]);

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) {
      busyRef.current = false;
      setJob(null);
      return;
    }
    const timer = window.setTimeout(() => advance(), 600);
    return () => {
      cancelledRef.current = true;
      window.clearTimeout(timer);
    };
  }, [enabled, advance, currentClientId, peerClientIds]);

  useEffect(() => {
    if (!job || !enabled) return;
    let cancelled = false;

    (async () => {
      try {
        // Give the off-screen DynamicTableView a tick to mount before polling.
        await new Promise((r) => window.setTimeout(r, 50));
        const node = snapshotRef.current;
        if (!node || cancelled || cancelledRef.current) return;

        const { dataUrl } = await captureReportScreenshotNode(node, {
          settleMs: 150,
          timeoutMs: 25_000,
        });
        if (cancelled || cancelledRef.current) return;
        setCachedReportScreenshot(job.tableId, dataUrl);
      } catch (err) {
        console.warn("[ReportScreenshotPrefetch] failed", job.tableId, err);
      } finally {
        busyRef.current = false;
        if (!cancelled && !cancelledRef.current) {
          window.setTimeout(() => {
            setJob(null);
            advance();
          }, GAP_BETWEEN_JOBS_MS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [job?.tableId, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;

  const summaryOnly = !["ahrefs", "google_analytics", "google_search_console"].includes(
    job.integrationType || "",
  );

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: -9999,
        top: -9999,
        zIndex: -9999,
        pointerEvents: "none",
        opacity: 0,
      }}
      aria-hidden="true"
      data-report-prefetch="true"
    >
      <div
        ref={snapshotRef}
        style={{
          width: "1200px",
          height: "auto",
          backgroundColor: "#ffffff",
          padding: "0",
          display: "block",
        }}
      >
        <QueryClientProvider client={queryClientRef.current!}>
          <DynamicTableView
            key={job.tableId}
            embedTableSlug={job.tableSlug}
            embedMode
            summaryOnly={summaryOnly}
          />
        </QueryClientProvider>
      </div>
    </div>,
    document.body,
  );
}
