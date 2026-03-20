import { useUIMode } from "@/contexts/UIModeContext";
import Dashboard from "./Dashboard";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const AIOSDashboard = lazy(() => import("./AIOSDashboard"));

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-96" />
    </div>
  );
}

export default function DashboardRouter() {
  const { mode } = useUIMode();

  if (mode === "aios") {
    return (
      <Suspense fallback={<PageLoader />}>
        <AIOSDashboard />
      </Suspense>
    );
  }

  return <Dashboard />;
}
