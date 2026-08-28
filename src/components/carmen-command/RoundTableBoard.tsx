import type { BrainRoute, ChatLike, ParliamentSeatView } from "@/lib/agentChannelRouting";
import { speakerLabel } from "@/lib/agentChannelRouting";

export type CouncilSeatId = "carmen" | "cursor" | "grok" | "codex";

const SEATS: Array<{ id: CouncilSeatId; label: string; role: string; place: string; sprite: string }> = [
  { id: "carmen", label: "כרמן", role: "יו\"ר · יעדים", place: "south", sprite: "/command-center/ghost-carmen.jpg" },
  { id: "cursor", label: "Cursor", role: "מוח ברירת מחדל", place: "west", sprite: "/command-center/ghost-cursor.jpg" },
  { id: "grok", label: "Grok", role: "ערוץ ישיר", place: "east", sprite: "/command-center/ghost-grok.jpg" },
  { id: "codex", label: "Codex", role: "ביצוע + QA", place: "north", sprite: "/command-center/ghost-codex.jpg" },
];

interface RoundTableBoardProps {
  route: BrainRoute | null;
  messages?: ChatLike[];
  seats?: ParliamentSeatView[];
  selectedProvider?: string | null;
  debating?: boolean;
  onAddress?: (seat: CouncilSeatId) => void;
  onOpenCouncil?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
  onSynthesize?: () => void;
  onClarify?: (provider: string) => void;
}

function slugForSeat(id: CouncilSeatId): string {
  return id === "carmen" ? "internal" : id;
}

function speakerOf(m: ChatLike): string {
  return (m.speaker || m.channel || (m.role === "user" ? "user" : "")).toLowerCase();
}

function lastLine(messages: ChatLike[] | undefined, who: CouncilSeatId, activeSlug: string): { text: string; from: string; to: string } | null {
  const list = messages || [];
  const seatSlug = slugForSeat(who);
  const own = [...list].reverse().find((m) => {
    if (m.role === "tool_call" || !m.content) return false;
    const speaker = speakerOf(m);
    if (who === "carmen") {
      return m.role === "assistant" && (speaker === "carmen" || speaker === "internal" || speaker === "parliament" || !m.speaker);
    }
    return speaker === who;
  });
  const incoming = [...list].reverse().find((m) =>
    m.role === "user" && m.content && (m.channel === seatSlug || m.channel === who || (!m.channel && activeSlug === seatSlug)),
  );
  const ownAt = own ? list.lastIndexOf(own) : -1;
  const inAt = incoming ? list.lastIndexOf(incoming) : -1;
  if (inAt > ownAt && incoming?.content) {
    return { text: incoming.content.slice(0, 220), from: "אתה", to: speakerLabel(who) };
  }
  if (own?.content) {
    const to = own.channel && own.channel !== who && own.channel !== "parliament"
      ? speakerLabel(own.channel)
      : "השולחן";
    return { text: own.content.slice(0, 220), from: speakerLabel(who), to };
  }
  return null;
}

function seatState(seats: ParliamentSeatView[] | undefined, id: string): string {
  if (id === "carmen") return "chair";
  return seats?.find((s) => s.provider === id)?.state || "idle";
}

function recentTalk(messages: ChatLike[] | undefined): Array<{ from: string; to: string; text: string }> {
  return (messages || [])
    .filter((m) => m.role !== "tool_call" && m.content)
    .slice(-5)
    .map((m) => {
      const from = m.role === "user" ? "אתה" : speakerLabel(m.speaker, m.channel);
      const to = m.role === "user" ? speakerLabel(m.channel || m.speaker) : "השולחן";
      return { from, to, text: (m.content || "").slice(0, 90) };
    })
    .reverse();
}

export function RoundTableBoard({
  route,
  messages = [],
  seats = [],
  selectedProvider,
  debating,
  onAddress,
  onOpenCouncil,
  onCancel,
  onContinue,
  onSynthesize,
  onClarify,
}: RoundTableBoardProps) {
  const active = (selectedProvider || route?.slug || "cursor") as string;
  const parliament = route?.route_type === "parliament";
  const log = recentTalk(messages);

  return (
    <div className="cc-roundtable" dir="rtl">
      <div className="mb-1 flex items-center justify-between gap-2 px-1">
        <p className="cc-panel-title">שולחן אבירים</p>
        <div className="flex flex-wrap gap-2">
          {!parliament && onOpenCouncil && (
            <button type="button" onClick={onOpenCouncil} className="text-[10px] text-[var(--cc-accent)] hover:underline">
              הפעל מועצה
            </button>
          )}
          {parliament && debating && onContinue && (
            <button type="button" onClick={onContinue} className="text-[10px] text-[var(--cc-accent)] hover:underline">המשך סבב</button>
          )}
          {parliament && debating && onSynthesize && (
            <button type="button" onClick={onSynthesize} className="text-[10px] text-[var(--cc-ok)] hover:underline">סיים וסכם</button>
          )}
          {onCancel && debating && (
            <button type="button" onClick={onCancel} className="text-[10px] text-[var(--cc-crit)] hover:underline">עצור</button>
          )}
        </div>
      </div>
      <p className="mb-2 px-1 text-[10px] text-[var(--cc-text-dim)]">
        לחצי על רוח כדי לפנות אליה ישירות. ברירת מחדל: Cursor. כרמן מנצחת על היעדים. לחיצה על השולחן פותחת מועצה.
      </p>
      <div className="cc-roundtable-stage">
        <button
          type="button"
          className={`cc-roundtable-table ${parliament ? "is-live" : ""}`}
          title="הפעל שולחן אבירים"
          onClick={() => onOpenCouncil?.()}
          aria-label="שולחן אבירים"
        />
        {SEATS.map((seat) => {
          const line = lastLine(messages, seat.id, active);
          const state = seatState(seats, seat.id);
          const selected = active === seat.id || active === slugForSeat(seat.id);
          return (
            <button
              key={seat.id}
              type="button"
              className={`cc-ghost cc-ghost-${seat.place} ${selected ? "is-selected" : ""} is-${state}`}
              title={`פנה אל ${seat.label}`}
              onClick={() => onAddress?.(seat.id)}
            >
              <span className="cc-ghost-aura" />
              <span
                className="cc-ghost-sprite"
                style={{ backgroundImage: `url(${seat.sprite})` }}
                aria-hidden
              />
              <span className="cc-ghost-body">
                <span className="cc-ghost-name">{seat.label}</span>
                <span className="cc-ghost-role">{seat.role}</span>
              </span>
              {line && (
                <span className="cc-ghost-bubble">
                  <span className="cc-ghost-bubble-meta">
                    {line.from} → {line.to}
                  </span>
                  {line.text}
                </span>
              )}
              {selected && <span className="cc-ghost-live">מדברים איתה</span>}
              {parliament && debating && onClarify && seat.id !== "carmen" && selected && (
                <span
                  role="link"
                  className="cc-ghost-clarify"
                  onClick={(e) => { e.stopPropagation(); onClarify(seat.id); }}
                >
                  בקש הבהרה
                </span>
              )}
            </button>
          );
        })}
      </div>
      {log.length > 0 && (
        <ol className="cc-roundtable-log">
          {log.map((row, i) => (
            <li key={`${row.from}-${i}`}>
              <span className="cc-roundtable-log-meta">{row.from} → {row.to}</span>
              {row.text}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
