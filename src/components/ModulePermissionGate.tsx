import { Navigate } from "react-router-dom";
import { useUserPermissions, ModulePermission } from "@/hooks/useUserPermissions";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Skeleton } from "@/components/ui/skeleton";

interface ModulePermissionGateProps {
  children: React.ReactNode;
  permission?: ModulePermission;
  redirectTo?: string;
}

/**
 * Lightweight permission check for nested tenant routes.
 * Auth is handled by TenantAppShell; this only gates module access.
 */
export function ModulePermissionGate({
  children,
  permission,
  redirectTo = "my-profile",
}: ModulePermissionGateProps) {
  const { hasPermission, isLoading, isFetching } = useUserPermissions();
  const { buildPath } = useTenantPath();

  if (isLoading || isFetching) {
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

  if (permission && !hasPermission(permission)) {
    return <Navigate to={buildPath(redirectTo)} replace />;
  }

  return <>{children}</>;
}
