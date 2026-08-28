import { Brain, ExternalLink, Landmark, Loader2 } from "lucide-react";
import type { BrainRoute, BrainRouteType } from "@/lib/agentChannelRouting";
import { FALLBACK_BRAIN_ROUTES, groupLabel } from "@/lib/agentChannelRouting";

interface BrainRouteSelectorProps {
  routes: BrainRoute[];
  value: string | null;
  onChange: (route: BrainRoute) => void;
  disabled?: boolean;
  status?: string | null;
  externalUrl?: string | null;
  className?: string;
}

function RouteIcon({ type }: { type: BrainRouteType }) {
  if (type === "parliament") return <Landmark className="h-3.5 w-3.5 text-[var(--cc-accent)]" />;
  if (type === "direct_channel") return <ExternalLink className="h-3.5 w-3.5 text-[var(--cc-accent)]" />;
  return <Brain className="h-3.5 w-3.5 text-[var(--cc-accent)]" />;
}

function statusLabel(status?: string | null): string | null {
  if (status === "waiting_external") return "ממתין לערוץ";
  if (status === "debating") return "פרלמנט פעיל";
  if (status === "streaming") return "זורם";
  if (status === "error") return "שגיאה";
  return null;
}

export function BrainRouteSelector({
  routes,
  value,
  onChange,
  disabled,
  status,
  externalUrl,
  className = "",
}: BrainRouteSelectorProps) {
  const list = routes.length ? routes : FALLBACK_BRAIN_ROUTES;
  const current = list.find((r) => r.id === value || r.slug === value) || list[0];
  const grouped = list.reduce<Record<string, BrainRoute[]>>((acc, r) => {
    (acc[r.route_type] ||= []).push(r);
    return acc;
  }, {});
  const waiting = status === "waiting_external" || status === "debating";

  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`} dir="rtl">
      <div className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-2">
        <RouteIcon type={current?.route_type || "internal"} />
        <select
          value={current?.id || ""}
          disabled={disabled}
          title="בורר מוח — משנה את נתיב השליחה"
          onChange={(e) => {
            const next = list.find((r) => r.id === e.target.value);
            if (next) onChange(next);
          }}
          className="min-w-0 flex-1 bg-transparent text-xs text-[var(--cc-text)] outline-none disabled:opacity-50"
        >
          {(Object.keys(grouped) as BrainRouteType[]).map((type) => (
            <optgroup key={type} label={groupLabel(type)}>
              {grouped[type].map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {(waiting || externalUrl) && (
        <p className="px-1 text-[10px] text-[var(--cc-text-dim)]">
          {statusLabel(status)}
          {waiting && <Loader2 className="mr-1 inline h-2.5 w-2.5 animate-spin" />}
          {externalUrl && (
            <>
              {" · "}
              <a href={externalUrl} target="_blank" rel="noreferrer" className="text-[var(--cc-accent)] hover:underline">
                סשן
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
