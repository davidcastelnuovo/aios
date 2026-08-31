import { forwardRef } from "react";
import DynamicTableView from "@/pages/DynamicTableView";

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
        <DynamicTableView embedTableSlug={tableSlug} embedMode summaryOnly={summaryOnly} />
      </div>
    );
  },
);

ClientTableSnapshot.displayName = "ClientTableSnapshot";
