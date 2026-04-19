import { forwardRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DynamicTableView from "@/pages/DynamicTableView";

interface Props {
  tableSlug: string;
}

/**
 * Renders the actual DynamicTableView page in embed mode so html-to-image
 * can capture a 100%-faithful snapshot of the report exactly as it appears
 * to the user — same logic, same KPIs, same campaign breakdown.
 *
 * NOTE: We do NOT wrap with MemoryRouter — the portal stays inside the
 * host app's BrowserRouter. We pass tableSlug directly as a prop so the
 * embedded view doesn't depend on the URL.
 *
 * Wrapped in its own QueryClient so cached queries from the host app
 * don't bleed in (and vice-versa).
 */
export const ClientTableSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ tableSlug }, ref) => {
    const [client] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
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
          <DynamicTableView embedTableSlug={tableSlug} embedMode />
        </QueryClientProvider>
      </div>
    );
  },
);

ClientTableSnapshot.displayName = "ClientTableSnapshot";
