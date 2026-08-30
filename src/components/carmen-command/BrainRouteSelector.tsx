import { Brain, ChevronDown, ExternalLink, Landmark, Loader2 } from "lucide-react";
import type { BrainRoute, BrainRouteType } from "@/lib/agentChannelRouting";
import { FALLBACK_BRAIN_ROUTES, groupLabel } from "@/lib/agentChannelRouting";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  if (type === "parliament") return <Landmark className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />;
  if (type === "direct_channel") return <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />;
  return <Brain className="h-3.5 w-3.5 shrink-0 text-[var(--cc-accent)]" />;
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
  const groups = Object.keys(grouped) as BrainRouteType[];

  return (
    <div className={`flex min-w-0 max-w-[16rem] flex-col gap-0.5 ${className}`} dir="rtl">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <button
            type="button"
            title="בורר מוח — משנה את נתיב השליחה"
            className="flex h-11 w-full min-w-[11rem] items-center gap-1.5 rounded-lg border border-[var(--cc-line)] bg-[rgba(5,10,22,0.6)] px-2 text-xs text-[var(--cc-text)] outline-none hover:border-[var(--cc-line-strong)] disabled:opacity-50"
          >
            <RouteIcon type={current?.route_type || "internal"} />
            <span className="min-w-0 flex-1 truncate text-right">{current?.label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--cc-text-dim)]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="cc-root z-[90] min-w-[16rem] border-[var(--cc-line)] bg-[rgba(8,16,34,0.98)] text-[var(--cc-text)]"
        >
          {groups.map((type, i) => (
            <div key={type}>
              {i > 0 && <DropdownMenuSeparator className="bg-[var(--cc-line)]" />}
              <DropdownMenuLabel className="text-[10px] text-[var(--cc-text-dim)]">
                {groupLabel(type)}
              </DropdownMenuLabel>
              {grouped[type].map((r) => (
                <DropdownMenuItem
                  key={r.id}
                  className="cursor-pointer gap-2 text-right"
                  onSelect={() => onChange(r)}
                >
                  <RouteIcon type={r.route_type} />
                  <span className="flex-1">{r.label}</span>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
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
