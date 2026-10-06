import { forwardRef, useState, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
const SharedDashboard = lazyWithRetry(() => import("@/pages/SharedDashboard"));

interface Props {
  shareToken: string;
  /** Match combined dashboard date preset (default: last 30 days — Woo + ads window). */
  dateFilter?: string;
}

/**
 * Renders the actual SharedDashboard page (the public share view) so html-to-image
 * can capture a 100%-faithful snapshot of the dashboard with real data
 * (no iframe, no auth issues).
 *
 * NOTE: We do NOT wrap with MemoryRouter — nesting routers inside the app's
 * BrowserRouter throws "You cannot render a <Router> inside another <Router>".
 * Instead we pass shareToken directly as a prop to SharedDashboard.
 *
 * We wrap with our own QueryClient so cached "shared-dashboard" queries from
 * the host app don't bleed in (and vice-versa).
 */
export const ClientDashboardSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ shareToken, dateFilter = "last_30_days" }, ref) => {
    const [client] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
        }),
    );

    return (
      <div
        ref={ref}
        style={{
          width: "1200px",
          minHeight: "600px",
          backgroundColor: "#ffffff",
          padding: "0",
        }}
      >
        <QueryClientProvider client={client}>
          <Suspense fallback={<div aria-busy="true" style={{ minHeight: 600 }} />}>
          <SharedDashboard
            shareTokenOverride={shareToken}
            initialDateFilter={dateFilter}
            snapshotMode
          />
          </Suspense>
        </QueryClientProvider>
      </div>
    );
  },
);

ClientDashboardSnapshot.displayName = "ClientDashboardSnapshot";
