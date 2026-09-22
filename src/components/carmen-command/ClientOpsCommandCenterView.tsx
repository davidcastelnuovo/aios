import { ClientOpsPanel } from "./ClientOpsPanel";

export function ClientOpsCommandCenterView({ tenantId }: { tenantId: string | null }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
      <ClientOpsPanel tenantId={tenantId} />
    </div>
  );
}
