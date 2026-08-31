import type { RefObject } from "react";
import { CarmenFace, type CarmenFaceState } from "./CarmenFace";
import {
  CoreOverviewPanel,
  HealthPanel,
  IntelFeedPanel,
  QuickCommandsPanel,
  TasksPanel,
  TimelinePanel,
} from "./panels";
import { UsagePanel } from "./UsagePanel";
import type { CarmenChatBarHandle } from "./CarmenChatBar";

const FACE_STATUS: Record<CarmenFaceState, string> = {
  idle: "בהמתנה",
  listening: "מקשיבה…",
  speaking: "מדברת…",
  alert: "התראה!",
};

interface CarmenDashboardViewProps {
  tenantId: string | null;
  faceState: CarmenFaceState;
  audioLevelRef: RefObject<number>;
  chatRef: RefObject<CarmenChatBarHandle | null>;
  onHealthCheck: () => void;
}

/** Classic command center: Carmen in the center, all HUD panels open on the sides. */
export function CarmenDashboardView({
  tenantId,
  faceState,
  audioLevelRef,
  chatRef,
  onHealthCheck,
}: CarmenDashboardViewProps) {
  return (
    <main className="cc-dashboard-grid cc-scroll grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-2 sm:p-3 lg:grid-cols-12 lg:overflow-hidden">
      <div className="order-1 flex min-h-[280px] lg:order-2 lg:col-span-6 lg:min-h-0">
        <div className="cc-panel cc-dashboard-core relative flex-1 overflow-hidden">
          <CarmenFace state={faceState} audioLevelRef={audioLevelRef} className="absolute inset-0 h-full w-full" />
          <span className="absolute right-3 top-2 text-[10px] tracking-[0.2em] text-[var(--cc-text-dim)]">
            CARMEN AI CORE · {FACE_STATUS[faceState]}
          </span>
        </div>
      </div>

      <div className="cc-scroll order-2 flex min-h-0 flex-col gap-3 lg:order-1 lg:col-span-3 lg:overflow-y-auto">
        <TasksPanel tenantId={tenantId} className="max-h-[min(300px,32dvh)] shrink-0 lg:max-h-none lg:flex-1" />
        <TimelinePanel tenantId={tenantId} className="max-h-[min(240px,28dvh)] shrink-0" />
        <CoreOverviewPanel tenantId={tenantId} className="shrink-0" />
      </div>

      <div className="cc-scroll order-3 flex min-h-0 flex-col gap-3 lg:col-span-3 lg:overflow-y-auto">
        <IntelFeedPanel tenantId={tenantId} className="max-h-[min(300px,32dvh)] shrink-0 lg:max-h-none lg:flex-1" />
        <QuickCommandsPanel
          onCommand={(text) => chatRef.current?.prefill(text)}
          onVoice={() => chatRef.current?.startVoice()}
          onHealthCheck={onHealthCheck}
          className="shrink-0"
        />
        <HealthPanel tenantId={tenantId} className="shrink-0" />
        <UsagePanel tenantId={tenantId} className="shrink-0" />
      </div>
    </main>
  );
}
