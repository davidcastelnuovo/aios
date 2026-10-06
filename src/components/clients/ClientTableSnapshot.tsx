import { forwardRef, Suspense } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
const DynamicTableView = lazyWithRetry(() => import("@/pages/DynamicTableView"));

interface Props {
  tableSlug: string;
  summaryOnly?: boolean;
}

/**
 * Renders DynamicTableView in embed mode for faithful report snapshots.
 * Uses the host app's QueryClient + persisted report cache for instant open.
 */
export const ClientTableSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ tableSlug, summaryOnly = true }, ref) => {
    return (
      <div
        ref={ref}
        style={{
          width: "1200px",
          height: "auto",
          backgroundColor: "#ffffff",
          padding: "0",
          display: "block",
        }}
      >
        <Suspense fallback={<div aria-busy="true" style={{ minHeight: 500 }} />}>
          <DynamicTableView embedTableSlug={tableSlug} embedMode summaryOnly={summaryOnly} />
        </Suspense>
      </div>
    );
  },
);

ClientTableSnapshot.displayName = "ClientTableSnapshot";
