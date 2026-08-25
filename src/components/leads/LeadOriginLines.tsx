import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  leadArrivalSourceChanged,
  leadCreatedAtWasBumped,
  leadFirstSourceDisplay,
  leadSourceDisplay,
  leadSourceFieldLabel,
} from "@/lib/leadFields";

function formatLeadDate(value: string | null | undefined, withTime = true): string {
  if (!value) return "—";
  const pattern = withTime ? "dd/MM/yyyy HH:mm" : "dd/MM/yyyy";
  return format(new Date(value), pattern, { locale: he });
}

export function LeadCreatedAtLines({
  lead,
  compact = false,
  className,
}: {
  lead: { created_at?: string | null; first_created_at?: string | null };
  compact?: boolean;
  className?: string;
}) {
  const bumped = leadCreatedAtWasBumped(lead);
  return (
    <div className={cn(compact ? "space-y-0.5" : "space-y-2", className)}>
      <div className={cn("flex items-center gap-2", compact ? "text-xs text-muted-foreground" : "text-sm justify-end")}>
        {compact && <Clock className="h-3 w-3 shrink-0" />}
        <span className={compact ? undefined : "font-medium"}>{formatLeadDate(lead.created_at)}</span>
        <span className={compact ? undefined : "text-muted-foreground"}>
          {bumped ? (compact ? " · מעודכן" : ":תאריך יצירה מעודכן") : compact ? "" : ":נוצר"}
        </span>
      </div>
      {bumped && (
        <div className={cn(compact ? "text-[11px] text-muted-foreground pr-5" : "flex items-center justify-end gap-2 text-sm")}>
          {compact ? (
            <>ראשוני: {formatLeadDate(lead.first_created_at, false)}</>
          ) : (
            <>
              <span className="font-medium">{formatLeadDate(lead.first_created_at)}</span>
              <span className="text-muted-foreground">:תאריך יצירה ראשוני</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function LeadSourceLines({
  lead,
  compact = false,
  showCampaign = true,
}: {
  lead: { source?: string | null; first_source?: string | null; campaign_name?: string | null };
  compact?: boolean;
  showCampaign?: boolean;
}) {
  const changed = leadArrivalSourceChanged(lead);
  const current = leadSourceDisplay(lead);
  const first = leadFirstSourceDisplay(lead);
  const campaign = showCampaign ? lead.campaign_name : null;
  if (compact) {
    if (!current && !campaign) return null;
    return (
      <div className="text-xs text-muted-foreground truncate" title={[current, first && changed ? `ראשוני: ${first}` : null, campaign].filter(Boolean).join(" · ")}>
        {changed
          ? `${current} (מעודכן) · ${first} (ראשוני)${campaign ? ` · ${campaign}` : ""}`
          : [current, campaign].filter(Boolean).join(" · ")}
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="font-medium">{current || "—"}</span>
        <span className="text-muted-foreground">:{leadSourceFieldLabel(lead)}</span>
      </div>
      {changed && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <span className="font-medium">{first || "—"}</span>
          <span className="text-muted-foreground">:מקור הגעה ראשוני</span>
        </div>
      )}
    </>
  );
}
