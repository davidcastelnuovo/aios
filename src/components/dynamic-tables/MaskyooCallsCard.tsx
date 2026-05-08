import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhoneIncoming, Phone, Users, Pencil } from "lucide-react";
import { MaskyooManualEditDialog } from "./MaskyooManualEditDialog";

interface MaskyooNumberConfig {
  label: string;
  number: string;
  accent?: "emerald" | "blue" | "purple";
}

/** Stat snapshot for a single Maskyoo line (used in public/prefetched mode). */
export interface MaskyooPrefetchedStat {
  last9: string;
  incoming: number;
  unique: number;
  answered: number;
  override?: {
    incoming_count: number | null;
    unique_count: number | null;
    answered_count: number | null;
    note: string | null;
  } | null;
}

interface MaskyooCallsCardProps {
  tenantId: string;
  /** Backward-compat single number. */
  maskyooNumber?: string;
  /** New: multiple labeled numbers (organic / paid / etc.). */
  numbers?: MaskyooNumberConfig[];
  /** Number of days to look back. Defaults to 30. */
  days?: number;
  /** When provided, no DB queries are made — used by public share view. */
  prefetchedStats?: MaskyooPrefetchedStat[];
  /** Hide the manual-edit pencil. Default: false (visible for internal). */
  readOnly?: boolean;
}

interface CallStats {
  incomingCount: number;
  uniqueCount: number;
  answeredCount: number;
}

interface OverrideRow {
  id: string;
  maskyoo_last9: string;
  incoming_count: number | null;
  unique_count: number | null;
  answered_count: number | null;
  note: string | null;
}

/**
 * KPI card showing INCOMING + UNIQUE phone activity for Maskyoo lines
 * (e.g. organic & paid) over the last N days.
 *
 * Reads from local `call_logs` table. Supports manual overrides per
 * (tenant, maskyoo_last9, period_days) so staff can correct counts when the
 * webhook missed events.
 *
 * In public/share mode, pass `prefetchedStats` and `readOnly` so the same
 * card renders without authenticated DB access.
 */
export function MaskyooCallsCard({
  tenantId, maskyooNumber, numbers, days = 30, prefetchedStats, readOnly = false,
}: MaskyooCallsCardProps) {
  const resolved: MaskyooNumberConfig[] = (numbers && numbers.length > 0)
    ? numbers
    : (maskyooNumber ? [{ label: "מסקיו", number: maskyooNumber, accent: "emerald" }] : []);

  const validNumbers = resolved
    .map((n) => ({ ...n, last9: (n.number || "").replace(/\D/g, "").slice(-9) }))
    .filter((n) => n.last9.length === 9);

  if (validNumbers.length === 0) return null;

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
          <Phone className="h-4 w-4" />
          שיחות מסקיו · {days} ימים אחרונים
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {validNumbers.map((n) => (
          <NumberRow
            key={n.label + n.last9}
            tenantId={tenantId}
            cfg={n}
            days={days}
            prefetched={prefetchedStats?.find((p) => p.last9 === n.last9)}
            readOnly={readOnly}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function NumberRow({ tenantId, cfg, days, prefetched, readOnly }: {
  tenantId: string;
  cfg: MaskyooNumberConfig & { last9: string };
  days: number;
  prefetched?: MaskyooPrefetchedStat;
  readOnly: boolean;
}) {
  const accent = cfg.accent || "emerald";
  const accentText =
    accent === "blue" ? "text-blue-700 dark:text-blue-200"
    : accent === "purple" ? "text-purple-700 dark:text-purple-200"
    : "text-emerald-700 dark:text-emerald-200";
  const iconColor =
    accent === "blue" ? "text-blue-600"
    : accent === "purple" ? "text-purple-600"
    : "text-emerald-600";
  const [editOpen, setEditOpen] = useState(false);

  // === Live mode: query call_logs ===
  const live = useQuery({
    queryKey: ["maskyoo-call-logs-kpi", tenantId, cfg.last9, days],
    enabled: !prefetched && !!tenantId && cfg.last9.length === 9,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CallStats> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("call_logs")
        .select("from_number, to_number, status, duration, created_at")
        .eq("tenant_id", tenantId)
        .eq("provider", "maskyoo")
        .gte("created_at", since)
        .ilike("to_number", `%${cfg.last9}`)
        .limit(5000);
      if (error) throw error;
      const rows = (data || []) as Array<{ from_number: string | null; status: string | null; duration: number | null }>;
      const uniq = new Set<string>();
      let answered = 0;
      for (const r of rows) {
        const last9 = (r.from_number || "").replace(/\D/g, "").slice(-9);
        if (last9) uniq.add(last9);
        if ((r.status || "").toLowerCase() === "completed" || Number(r.duration || 0) > 0) answered++;
      }
      return { incomingCount: rows.length, uniqueCount: uniq.size, answeredCount: answered };
    },
  });

  // === Live mode: query overrides ===
  const overrideQuery = useQuery({
    queryKey: ["maskyoo-overrides", tenantId, cfg.last9, days],
    enabled: !prefetched && !!tenantId && cfg.last9.length === 9,
    staleTime: 60_000,
    queryFn: async (): Promise<OverrideRow | null> => {
      const { data, error } = await supabase
        .from("maskyoo_manual_overrides")
        .select("id, maskyoo_last9, incoming_count, unique_count, answered_count, note")
        .eq("tenant_id", tenantId)
        .eq("maskyoo_last9", cfg.last9)
        .eq("period_days", days)
        .maybeSingle();
      if (error) throw error;
      return data as OverrideRow | null;
    },
  });

  // === Resolve display values ===
  const isLoading = !prefetched && live.isLoading;
  const errored = !prefetched && live.error;
  const auto: CallStats = prefetched
    ? { incomingCount: prefetched.incoming, uniqueCount: prefetched.unique, answeredCount: prefetched.answered }
    : (live.data || { incomingCount: 0, uniqueCount: 0, answeredCount: 0 });
  const ov = prefetched?.override ?? overrideQuery.data ?? null;

  const display = {
    incoming: ov?.incoming_count ?? auto.incomingCount,
    unique: ov?.unique_count ?? auto.uniqueCount,
    answered: ov?.answered_count ?? auto.answeredCount,
  };
  const hasOverride = !!ov && (
    ov.incoming_count != null || ov.unique_count != null || ov.answered_count != null
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className={`text-xs font-semibold flex items-center gap-2 ${accentText}`}>
          <span>{cfg.label}</span>
          {hasOverride && (
            <Badge variant="outline" className="h-4 text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200">
              ידני
            </Badge>
          )}
        </div>
        {!readOnly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditOpen(true)}
            title="ערוך ספירה ידנית"
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
      {errored ? (
        <div className="text-xs text-destructive">שגיאה בטעינת נתוני מסקיו</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<PhoneIncoming className={`h-4 w-4 ${iconColor}`} />}
            label="נכנסות"
            value={isLoading ? "…" : String(display.incoming ?? 0)}
          />
          <Stat
            icon={<Users className={`h-4 w-4 ${iconColor}`} />}
            label="ייחודיות"
            value={isLoading ? "…" : String(display.unique ?? 0)}
          />
          <Stat
            icon={<Phone className={`h-4 w-4 ${iconColor}`} />}
            label="נענו"
            value={isLoading ? "…" : String(display.answered ?? 0)}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground" dir="ltr">{cfg.number}</p>

      {!readOnly && (
        <MaskyooManualEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          tenantId={tenantId}
          last9={cfg.last9}
          displayNumber={cfg.number}
          label={cfg.label}
          periodDays={days}
          autoStats={{ incoming: auto.incomingCount, unique: auto.uniqueCount, answered: auto.answeredCount }}
          override={ov}
        />
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}
