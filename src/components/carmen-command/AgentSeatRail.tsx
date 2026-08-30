import type { BrainRoute } from "@/lib/agentChannelRouting";
import { billingNoteForRoute } from "@/lib/agentChannelRouting";
import {
  AGENT_SPRITES,
  RAIL_SEAT_ORDER,
  type AgentSeatKey,
  routeForSeatKey,
  seatKeyFromRoute,
} from "@/lib/agentSeats";
import { Loader2 } from "lucide-react";

const SEAT_ARIA: Record<AgentSeatKey, string> = {
  shared: "מרחב משותף",
  carmen: "כרמן פנימית",
  cursor: "Cursor Direct",
  grok: "Grok",
  codex: "Codex",
  claude: "Claude",
  chatgpt: "ChatGPT",
  user: "אתה",
};

interface AgentSeatRailProps {
  routes: BrainRoute[];
  selected: BrainRoute;
  status?: string | null;
  externalUrl?: string | null;
  debating?: boolean;
  className?: string;
  /** Seats only — for single-row header bar */
  embedded?: boolean;
  /** Hide status row (render via AgentSeatStatus below header) */
  hideStatus?: boolean;
  onSelect: (route: BrainRoute) => void;
  onContinue?: () => void;
  onSynthesize?: () => void;
  onCancel?: () => void;
}

function SharedCluster() {
  return (
    <span className="cc-seat-cluster" aria-hidden>
      <span className="cc-seat-cluster-dot is-cursor" style={{ backgroundImage: `url(${AGENT_SPRITES.cursor})` }} />
      <span className="cc-seat-cluster-dot is-grok" style={{ backgroundImage: `url(${AGENT_SPRITES.grok})` }} />
      <span className="cc-seat-cluster-dot is-codex" style={{ backgroundImage: `url(${AGENT_SPRITES.codex})` }} />
    </span>
  );
}

export function AgentSeatButtons({
  routes,
  selected,
  onSelect,
  className = "",
}: Pick<AgentSeatRailProps, "routes" | "selected" | "onSelect" | "className">) {
  const activeKey = seatKeyFromRoute(selected);
  return (
    <div className={`cc-seat-buttons flex items-center justify-center gap-1.5 sm:gap-2${className ? ` ${className}` : ""}`} dir="rtl">
      {RAIL_SEAT_ORDER.map((key) => {
        const route = routeForSeatKey(routes, key);
        if (!route && key !== "shared") return null;
        const isActive = activeKey === key;
        const sprite = key === "shared" ? null : AGENT_SPRITES[key];
        return (
          <button
            key={key}
            type="button"
            title={SEAT_ARIA[key]}
            aria-label={SEAT_ARIA[key]}
            aria-pressed={isActive}
            onClick={() => {
              const next = routeForSeatKey(routes, key);
              if (next) onSelect(next);
            }}
            className={`cc-seat-btn${isActive ? " is-active" : ""}${key === "shared" ? " is-shared" : ""}`}
          >
            {key === "shared" ? (
              <SharedCluster />
            ) : (
              <span
                className="cc-seat-sprite"
                style={{ backgroundImage: `url(${sprite})` }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function AgentSeatStatus({
  selected,
  status,
  externalUrl,
  debating,
  onContinue,
  onSynthesize,
  onCancel,
}: Pick<
  AgentSeatRailProps,
  "selected" | "status" | "externalUrl" | "debating" | "onContinue" | "onSynthesize" | "onCancel"
>) {
  const activeKey = seatKeyFromRoute(selected);
  const waiting = status === "waiting_external" || status === "debating";
  const note = billingNoteForRoute(selected.provider);
  const showParliament = debating && activeKey === "shared";
  if (!note && !waiting && !externalUrl && !showParliament) return null;

  return (
    <div className="cc-seat-status flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1 text-center text-[10px] text-[var(--cc-text-dim)]" dir="rtl">
      {note && <span>{note}</span>}
      {waiting && (
        <span className="inline-flex items-center gap-1 text-[var(--cc-accent)]">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          {status === "debating" ? "שואלים את הצוות ⚡" : "ממתין לערוץ"}
        </span>
      )}
      {externalUrl && (
        <a href={externalUrl} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)] hover:underline">
          סשן חיצוני
        </a>
      )}
      {showParliament && (
        <span className="flex flex-wrap justify-center gap-2">
          {onContinue && (
            <button type="button" onClick={onContinue} className="text-[var(--cc-accent)] hover:underline">
              המשך
            </button>
          )}
          {onSynthesize && (
            <button type="button" onClick={onSynthesize} className="text-[var(--cc-ok)] hover:underline">
              סכם
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-[var(--cc-crit)] hover:underline">
              עצור
            </button>
          )}
        </span>
      )}
    </div>
  );
}

export function AgentSeatRail({
  routes,
  selected,
  status,
  externalUrl,
  debating,
  onSelect,
  onContinue,
  onSynthesize,
  onCancel,
  className = "",
  embedded = false,
  hideStatus = false,
}: AgentSeatRailProps) {
  const buttons = (
    <AgentSeatButtons routes={routes} selected={selected} onSelect={onSelect} />
  );

  if (embedded) {
    return buttons;
  }

  return (
    <div className={`cc-seat-rail shrink-0 px-2 py-2 sm:px-3${className ? ` ${className}` : ""}`} dir="rtl">
      {buttons}
      {!hideStatus && (
        <AgentSeatStatus
          selected={selected}
          status={status}
          externalUrl={externalUrl}
          debating={debating}
          onContinue={onContinue}
          onSynthesize={onSynthesize}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}
