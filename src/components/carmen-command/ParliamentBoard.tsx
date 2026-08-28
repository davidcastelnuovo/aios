import { Landmark } from "lucide-react";
import { parliamentSeats, type BrainRoute } from "@/lib/agentChannelRouting";

type SeatState = "waiting" | "thinking" | "replied" | "reviewing" | "failed";

export type ParliamentSeat = {
  provider: string;
  label: string;
  state: SeatState;
  preview?: string;
  url?: string | null;
};

interface ParliamentBoardProps {
  route: BrainRoute | null;
  round?: number;
  maxRounds?: number;
  topic?: string;
  seats?: ParliamentSeat[];
  onCancel?: () => void;
  onSelectSeat?: (provider: string) => void;
}

const STATE_HE: Record<SeatState, string> = {
  waiting: "ממתין",
  thinking: "חושב",
  replied: "השיב",
  reviewing: "מבקר",
  failed: "נכשל",
};

const DEFAULT_LABEL: Record<string, string> = {
  cursor: "Cursor",
  grok: "Grok",
  claude: "Claude",
  chatgpt: "ChatGPT",
  carmen: "כרמן",
};

export function ParliamentBoard({
  route,
  round = 1,
  maxRounds = 2,
  topic,
  seats,
  onCancel,
  onSelectSeat,
}: ParliamentBoardProps) {
  const names = parliamentSeats(route);
  const resolved: ParliamentSeat[] = seats?.length
    ? seats
    : names.map((p) => ({ provider: p, label: DEFAULT_LABEL[p] || p, state: "waiting" as SeatState }));

  return (
    <div className="border-b border-[var(--cc-line)] px-3 py-2" dir="rtl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-[var(--cc-accent)]">
          <Landmark className="h-3.5 w-3.5" />
          פרלמנט · סבב {round}/{maxRounds} · כרמן יושבת ראש
        </p>
        {onCancel && (
          <button onClick={onCancel} className="text-[10px] text-[var(--cc-crit)] hover:underline">
            עצור
          </button>
        )}
      </div>
      {topic && <p className="mb-2 line-clamp-2 text-xs text-[var(--cc-text)]">{topic}</p>}
      <div className="flex items-center justify-center gap-3">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-[var(--cc-line-strong)] bg-[rgba(76,195,255,0.12)] text-[10px] font-bold text-[var(--cc-accent)]">
          כרמן
        </div>
        {resolved.map((seat) => (
          <button
            key={seat.provider}
            type="button"
            onClick={() => onSelectSeat?.(seat.provider)}
            title={seat.preview || seat.label}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border text-[10px] ${
              seat.state === "failed"
                ? "border-[var(--cc-crit)] text-[var(--cc-crit)]"
                : seat.state === "thinking" || seat.state === "reviewing"
                ? "border-[var(--cc-warn)] text-[var(--cc-warn)]"
                : "border-[var(--cc-line)] text-[var(--cc-text)]"
            }`}
          >
            <span className="font-semibold">{seat.label}</span>
            <span className="opacity-70">{STATE_HE[seat.state]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
