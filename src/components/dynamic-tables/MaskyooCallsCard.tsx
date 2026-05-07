import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneIncoming, Phone, Users } from "lucide-react";

interface MaskyooNumberConfig {
  label: string;
  number: string;
  accent?: "emerald" | "blue" | "purple";
}

interface MaskyooCallsCardProps {
  tenantId: string;
  /** Backward-compat single number. */
  maskyooNumber?: string;
  /** New: multiple labeled numbers (organic / paid / etc.). */
  numbers?: MaskyooNumberConfig[];
  /** Number of days to look back. Defaults to 30. */
  days?: number;
}

interface CallStats {
  incomingCount: number;
  uniqueCount: number;
  answeredCount: number;
}

/**
 * KPI card showing INCOMING + UNIQUE phone activity for Maskyoo lines
 * (e.g. organic & paid) over the last N days.
 *
 * Reads from local `call_logs` table (synced from Maskyoo via webhook +
 * sync-maskyoo-cdr). We do NOT call Maskyoo's API live from the browser
 * because Maskyoo enforces an IP whitelist that blocks Supabase Edge Functions.
 *
 * Outgoing calls are intentionally excluded — this card is meant for marketing
 * reports where only inbound demand matters.
 */
export function MaskyooCallsCard({ tenantId, maskyooNumber, numbers, days = 30 }: MaskyooCallsCardProps) {
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
          <NumberRow key={n.label + n.last9} tenantId={tenantId} cfg={n} days={days} />
        ))}
      </CardContent>
    </Card>
  );
}

function NumberRow({ tenantId, cfg, days }: {
  tenantId: string;
  cfg: MaskyooNumberConfig & { last9: string };
  days: number;
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

  const { data, isLoading, error } = useQuery({
    queryKey: ["maskyoo-call-logs-kpi", tenantId, cfg.last9, days],
    enabled: !!tenantId && cfg.last9.length === 9,
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

  return (
    <div className="space-y-2">
      <div className={`text-xs font-semibold ${accentText}`}>{cfg.label}</div>
      {error ? (
        <div className="text-xs text-destructive">שגיאה בטעינת נתוני מסקיו</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<PhoneIncoming className={`h-4 w-4 ${iconColor}`} />}
            label="נכנסות"
            value={isLoading ? "…" : String(data?.incomingCount ?? 0)}
          />
          <Stat
            icon={<Users className={`h-4 w-4 ${iconColor}`} />}
            label="ייחודיות"
            value={isLoading ? "…" : String(data?.uniqueCount ?? 0)}
          />
          <Stat
            icon={<Phone className={`h-4 w-4 ${iconColor}`} />}
            label="נענו"
            value={isLoading ? "…" : String(data?.answeredCount ?? 0)}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground" dir="ltr">{cfg.number}</p>
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
