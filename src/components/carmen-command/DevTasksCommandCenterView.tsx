import { DevTasksPanel } from "./DevTasksPanel";

/** Full-screen Dev Task Command Center view inside Carmen CC. */
export function DevTasksCommandCenterView({ tenantId }: { tenantId: string | null }) {
  return (
    <main className="cc-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2 sm:p-3">
      <DevTasksPanel tenantId={tenantId} />
    </main>
  );
}
