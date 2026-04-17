import { forwardRef, useEffect, useState } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SharedDashboard from "@/pages/SharedDashboard";

interface Props {
  shareToken: string;
}

/**
 * Renders the actual SharedDashboard page (the public share view) inside a
 * MemoryRouter so html-to-image can capture a 100%-faithful snapshot of the
 * dashboard with real data (no iframe, no auth issues).
 *
 * We wrap with our own QueryClient so cached "shared-dashboard" queries from
 * the host app don't bleed in (and vice-versa).
 */
export const ClientDashboardSnapshot = forwardRef<HTMLDivElement, Props>(
  ({ shareToken }, ref) => {
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
          <MemoryRouter initialEntries={[`/shared/dashboard/${shareToken}`]}>
            <Routes>
              <Route
                path="/shared/dashboard/:shareToken"
                element={<SharedDashboard />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </div>
    );
  },
);

ClientDashboardSnapshot.displayName = "ClientDashboardSnapshot";
