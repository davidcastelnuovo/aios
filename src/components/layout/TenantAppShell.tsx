import { Outlet } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "./AppLayout";

/**
 * Persistent shell for all tenant-scoped pages with the main sidebar.
 * Mounted once per /t/:tenantSlug/* navigation — child routes render via Outlet
 * so AppLayout does not remount on every module switch (fixes error/loading flashes).
 */
export function TenantAppShell() {
  return (
    <ProtectedRoute>
      <AppLayout />
    </ProtectedRoute>
  );
}
