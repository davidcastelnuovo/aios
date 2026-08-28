import { Landmark } from "lucide-react";
import type { BrainRoute } from "@/lib/agentChannelRouting";
import type { ParliamentSeatView } from "@/lib/agentChannelRouting";

interface ParliamentBoardProps {
  route: BrainRoute | null;
  round?: number;
  maxRounds?: number;
  topic?: string;
  seats?: ParliamentSeatView[];
  carmenSummary?: string | null;
  selectedProvider?: string | null;
  debating?: boolean;
  onCancel?: () => void;
  onContinue?: () => void;
  onSynthesize?: () => void;
  onSelectSeat?: (provider: string) => void;
  onClarify?: (provider: string) => void;
}

const STATE_HE: Record<string, string> = {
  waiting: "ממתין",
  thinking: "חושב",
  replied: "השיב",
  reviewing: "מבקר",
  failed: "נכשל",
};

export function ParliamentBoard({
  route: _route,
  round = 1,
  maxRounds = 2,
  topic,
  seats = [],
  carmenSummary,
  selectedProvider,
  debating,
  onCancel,
  onContinue,
  onSynthesize,
  onSelectSeat,
  onClarify,
}: ParliamentBoardProps) {
  const selected = seats.find((s) => s.provider === selectedProvider);

  return (
    <div className="border-b border-[var(--cc-line)] px-3 py-2" dir="rtl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] tracking-[0.14em] text-[var(--cc-accent)]">
          <Landmark className="h-3.5 w-3.5" />
          פרלמנט · סבב {round}/{maxRounds} · כרמן יושבת ראש
        </p>
        <div className="flex flex-wrap gap-2">
          {debating && onContinue && (
            <button onClick={onContinue} className="text-[10px] text-[var(--cc-accent)] hover:underline">המשך סבב</button>
          )}
          {debating && onSynthesize && (
            <button onClick={onSynthesize} className="text-[10px] text-[var(--cc-ok)] hover:underline">סיים וסכם</button>
          )}
          {onCancel && (
            <button onClick={onCancel} className="text-[10px] text-[var(--cc-crit)] hover:underline">עצור</button>
          )}
        </div>
      </div>
      {topic && <p className="mb-2 line-clamp-2 text-xs text-[var(--cc-text)]">{topic}</p>}
      <div className="flex items-center justify-center gap-3">
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-[var(--cc-line-strong)] bg-[rgba(76,195,255,0.12)] text-[10px] font-bold text-[var(--cc-accent)]">
          כרמן
        </div>
        {seats.map((seat) => (
          <button
            key={seat.provider}
            type="button"
            onClick={() => onSelectSeat?.(seat.provider)}
            title={seat.preview || seat.label}
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border text-[10px] ${
              selectedProvider === seat.provider ? "border-[var(--cc-accent)] bg-[rgba(76,195,255,0.12)]" : ""
            } ${
              seat.state === "failed"
                ? "border-[var(--cc-crit)] text-[var(--cc-crit)]"
                : seat.state === "thinking" || seat.state === "reviewing"
                ? "border-[var(--cc-warn)] text-[var(--cc-warn)]"
                : "border-[var(--cc-line)] text-[var(--cc-text)]"
            }`}
          >
            <span className="font-semibold">{seat.label}</span>
            <span className="opacity-70">{STATE_HE[seat.state] || seat.state}</span>
          </button>
        ))}
      </div>
      {selected?.preview && (
        <div className="mt-2 rounded-md border border-[var(--cc-line)] bg-[rgba(5,10,22,0.45)] p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[var(--cc-accent)]">{selected.label}</span>
            {debating && onClarify && (
              <button onClick={() => onClarify(selected.provider)} className="text-[10px] text-[var(--cc-accent)] hover:underline">
                בקש הבהרה
              </button>
            )}
          </div>
          <p className="whitespace-pre-wrap text-[var(--cc-text)]">{selected.preview}</p>
        </div>
      )}
      {carmenSummary && (
        <div className="mt-2 rounded-md border border-[var(--cc-line-strong)] p-2 text-xs text-[var(--cc-text)]">
          <p className="mb-1 text-[10px] tracking-wide text-[var(--cc-accent)]">סיכום כרמן</p>
          <p className="line-clamp-6 whitespace-pre-wrap">{carmenSummary}</p>
        </div>
      )}
    </div>
  );
}
