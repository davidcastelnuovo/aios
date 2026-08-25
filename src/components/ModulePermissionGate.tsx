import { Navigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useTenantPath } from "@/hooks/useTenantPath";
import { resolvePermissionGateView } from "@/lib/permissionGate";
import { permissionHandleForPathname } from "@/lib/moduleRoutePermissions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface ModulePermissionGateProps {
  children: React.ReactNode;
  permission?: ModulePermission;
  redirectTo?: string;
}

function PermissionGateSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

/**
 * Lightweight permission check for nested tenant routes.
 * Auth is handled by TenantAppShell; this only gates module access.
 *
 * Keep a single instance around the shell Outlet (RoutedModulePermissionGate)
 * so switching modules does not remount the query observer and flash stale errors.
 */
export function ModulePermissionGate({
  children,
  permission,
  redirectTo = "my-profile",
}: ModulePermissionGateProps) {
  const {
    hasPermission,
    isLoading,
    isFetching,
    isError,
    isReady,
    isFetchedAfterMount,
    isSuperAdmin,
  } = useUserPermissions();
  const { buildPath } = useTenantPath();
  const queryClient = useQueryClient();

  const view = resolvePermissionGateView({
    permission,
    isSuperAdmin,
    isLoading,
    isFetching,
    isError,
    isReady,
    isFetchedAfterMount,
    allowed: !permission || hasPermission(permission),
  });

  if (view === "skeleton") {
    return <PermissionGateSkeleton />;
  }

  if (view === "error") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center" dir="rtl">
        <p className="text-muted-foreground">לא הצלחנו לטעון את ההרשאות שלך. נסה שוב.</p>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["user-permissions"] })}
        >
          נסה שוב
        </Button>
      </div>
    );
  }

  if (view === "redirect") {
    return <Navigate to={buildPath(redirectTo)} replace />;
  }

  return <>{children}</>;
}

/** Persistent gate that reads the module permission from the tenant URL. */
export function RoutedModulePermissionGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const handle = permissionHandleForPathname(pathname);

  return (
    <ModulePermissionGate permission={handle?.permission} redirectTo={handle?.redirectTo}>
      {children}
    </ModulePermissionGate>
  );
}
