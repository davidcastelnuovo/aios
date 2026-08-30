import type { CSSProperties } from "react";
import type { BrainRoute, ChatLike, ParliamentSeatView } from "@/lib/agentChannelRouting";
import {
  councilSeatFromSlug,
  slugForCouncilSeat,
  speakerLabel,
  type CouncilSeatId,
  type HudStage,
} from "@/lib/agentChannelRouting";

export type { CouncilSeatId };

const SEATS: Array<{ id: CouncilSeatId; label: string; role: string; sprite: string }> = [
  { id: "carmen", label: "כרמן", role: "יו\"ר", sprite: "/command-center/ghost-carmen.png" },
  { id: "cursor", label: "Cursor", role: "מוח", sprite: "/command-center/ghost-cursor.png" },
  { id: "grok", label: "Grok", role: "Grok", sprite: "/command-center/ghost-grok.png" },
  { id: "codex", label: "Codex", role: "Codex", sprite: "/command-center/ghost-codex.png" },
];

/** Parliament agents orbit the council sphere at even thirds. */
const ORBIT_AGENTS = SEATS.filter((s) => s.id !== "carmen");
const ORBIT_ANGLES: Record<string, number> = {
  cursor: 210,
  grok: 330,
  codex: 90,
};
const ORBIT_RADIUS = 44;

function orbitPosition(angleDeg: number): { left: string; top: string } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const x = 50 + ORBIT_RADIUS * Math.cos(rad);
  const y = 50 + ORBIT_RADIUS * Math.sin(rad);
  return { left: `${x}%`, top: `${y}%` };
}

interface RoundTableBoardProps {
  route: BrainRoute | null;
  messages?: ChatLike[];
  seats?: ParliamentSeatView[];
  selectedProvider?: string | null;
  debating?: boolean;
  stage?: HudStage;
  onAddress?: (seat: CouncilSeatId) => void;
  onOpenCouncil?: () => void;
  onBackToTable?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
  onSynthesize?: () => void;
  onClarify?: (provider: string) => void;
}

function speakerOf(m: ChatLike): string {
  return (m.speaker || m.channel || (m.role === "user" ? "user" : "")).toLowerCase();
}

function lastLine(messages: ChatLike[] | undefined, who: CouncilSeatId, activeSlug: string): { text: string; from: string; to: string } | null {
  const list = messages || [];
  const seatSlug = slugForCouncilSeat(who);
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

function GhostSeat({
  seat,
  line,
  state,
  selected,
  debating,
  parliament,
  onAddress,
  onClarify,
  style,
  compact,
}: {
  seat: (typeof SEATS)[number];
  line: ReturnType<typeof lastLine>;
  state: string;
  selected: boolean;
  debating?: boolean;
  parliament: boolean;
  onAddress?: (seat: CouncilSeatId) => void;
  onClarify?: (provider: string) => void;
  style?: CSSProperties;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`cc-ghost cc-ghost-orbit is-${state}${selected ? " is-selected" : ""}${compact ? " is-compact" : ""}`}
      style={style}
      title={`פנה אל ${seat.label}`}
      onClick={() => onAddress?.(seat.id)}
    >
      <span className="cc-ghost-aura" data-seat={seat.id} />
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
      {parliament && debating && onClarify && seat.id !== "carmen" && (
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
}

export function RoundTableBoard({
  route,
  messages = [],
  seats = [],
  selectedProvider,
  debating,
  stage = "table",
  onAddress,
  onOpenCouncil,
  onBackToTable,
  onCancel,
  onContinue,
  onSynthesize,
  onClarify,
}: RoundTableBoardProps) {
  const active = (selectedProvider || route?.slug || "cursor") as string;
  const parliament = route?.route_type === "parliament";
  const log = recentTalk(messages);
  const soloId = councilSeatFromSlug(selectedProvider || route?.slug);
  const solo = SEATS.find((s) => s.id === soloId) || SEATS[0];

  if (stage === "direct") {
    const line = lastLine(messages, solo.id, active);
    return (
      <div className="cc-direct-stage" dir="rtl">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="cc-panel-title">{solo.label}</p>
          <button type="button" onClick={() => onBackToTable?.()} className="text-[10px] text-[var(--cc-accent)] hover:underline">
            שולחן אבירים
          </button>
        </div>
        <button type="button" className="cc-ghost cc-ghost-solo is-selected" tabIndex={-1}>
          <span className="cc-ghost-aura" data-seat={solo.id} />
          <span
            className="cc-ghost-sprite"
            style={{ backgroundImage: `url(${solo.sprite})` }}
            aria-hidden
          />
          <span className="cc-ghost-body">
            <span className="cc-ghost-name">{solo.label}</span>
            <span className="cc-ghost-role">{solo.role}</span>
          </span>
          {line && (
            <span className="cc-ghost-bubble">
              <span className="cc-ghost-bubble-meta">
                {line.from} → {line.to}
              </span>
              {line.text}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="cc-roundtable" dir="rtl">
      <div className="mb-1 flex shrink-0 items-center justify-between gap-2 px-1">
        <p className="cc-panel-title">שולחן אבירים</p>
        <div className="flex flex-wrap gap-2">
          {onOpenCouncil && (
            <button type="button" onClick={onOpenCouncil} className="text-[10px] text-[var(--cc-accent)] hover:underline">
              {parliament ? "מועצה" : "הפעל מועצה"}
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
      <div className="cc-roundtable-stage cc-orb-stage">
        <button
          type="button"
          className={`cc-orb-sphere ${parliament ? "is-live" : ""}`}
          title="הפעל שולחן אבירים"
          onClick={() => onOpenCouncil?.()}
          aria-label="שולחן אבירים"
        >
          <span className="cc-orb-surface" aria-hidden />
          <span className="cc-orb-glow" aria-hidden />
          <span className="cc-orb-chair">
            <span className="cc-orb-chair-name">כרמן</span>
            <span className="cc-orb-chair-role">יו&quot;ר</span>
          </span>
        </button>
        {ORBIT_AGENTS.map((seat) => {
          const angle = ORBIT_ANGLES[seat.id] ?? 0;
          const pos = orbitPosition(angle);
          const line = parliament ? lastLine(messages, seat.id, active) : null;
          const state = seatState(seats, seat.id);
          const selected = councilSeatFromSlug(selectedProvider) === seat.id || selectedProvider === seat.id;
          return (
            <GhostSeat
              key={seat.id}
              seat={seat}
              line={line}
              state={state}
              selected={selected}
              debating={debating}
              parliament={parliament}
              onAddress={onAddress}
              onClarify={onClarify}
              style={{ left: pos.left, top: pos.top }}
              compact
            />
          );
        })}
      </div>
      {parliament && log.length > 0 && (
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
