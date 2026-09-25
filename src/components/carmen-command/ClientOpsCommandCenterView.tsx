import { useState } from "react";
import { ClientOpsPanel } from "./ClientOpsPanel";
import { CoclRunsPanel } from "./CoclRunsPanel";

type Tab = "recommendations" | "cocl_runs";

export function ClientOpsCommandCenterView({ tenantId }: { tenantId: string | null }) {
  const [tab, setTab] = useState<Tab>("recommendations");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
      <div className="flex gap-1 border-b border-[var(--cc-line)] pb-2">
        <button
          type="button"
          onClick={() => setTab("recommendations")}
          className={`rounded px-3 py-1 text-xs ${
            tab === "recommendations"
              ? "bg-[var(--cc-accent)] text-black"
              : "text-[var(--cc-text-dim)] hover:text-[var(--cc-text)]"
          }`}
        >
          המלצות לקוח
        </button>
        <button
          type="button"
          onClick={() => setTab("cocl_runs")}
          className={`rounded px-3 py-1 text-xs ${
            tab === "cocl_runs"
              ? "bg-[var(--cc-accent)] text-black"
              : "text-[var(--cc-text-dim)] hover:text-[var(--cc-text)]"
          }`}
        >
          ריצות COCL
        </button>
      </div>
      {tab === "recommendations" ? (
        <ClientOpsPanel tenantId={tenantId} />
      ) : (
        <CoclRunsPanel tenantId={tenantId} />
      )}
    </div>
  );
}
