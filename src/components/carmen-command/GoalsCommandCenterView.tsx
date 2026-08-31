import { GoalsPanel } from "./GoalsPanel";

export function GoalsCommandCenterView({ tenantId }: { tenantId: string | null }) {
  return (
    <main className="cc-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-2 sm:p-3">
      <GoalsPanel tenantId={tenantId} />
    </main>
  );
}
