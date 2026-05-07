import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneIncoming, PhoneOutgoing, Phone } from "lucide-react";
import { subDays } from "date-fns";

interface MaskyooNumberConfig {
  label: string;
  number: string;
  /** Tailwind accent for badges/icons. e.g. "emerald" | "blue" */
  accent?: "emerald" | "blue" | "purple";
}

interface MaskyooCallsCardProps {
  tenantId: string;
  /** Backward-compat: single number (treated as a single section). */
  maskyooNumber?: string;
  /** New: multiple labeled numbers (organic / paid / etc.). */
  numbers?: MaskyooNumberConfig[];
  /** Number of days to look back. Defaults to 30. */
  days?: number;
}

/**
 * KPI card showing call activity for one or more Maskyoo phone numbers
 * (e.g. organic & paid lines) over the last N days. Used inside SEO /
 * Google report dashboards so a client can see how many phone leads the
 * report period generated, broken down per line.
 *
 * Matching is done by the last 9 digits of each number, consistent with
 * the project-wide phone normalization policy.
 */
export function MaskyooCallsCard({ tenantId, maskyooNumber, numbers, days = 30 }: MaskyooCallsCardProps) {
  const resolved: MaskyooNumberConfig[] = (numbers && numbers.length > 0)
    ? numbers
    : (maskyooNumber ? [{ label: "מסקיו", number: maskyooNumber, accent: "emerald" }] : []);

  const validNumbers = resolved
    .map((n) => ({ ...n, last9: (n.number || "").replace(/\D/g, "").slice(-9) }))
    .filter((n) => n.last9.length === 9);

  const allLast9 = validNumbers.map((n) => n.last9).sort().join(",");
  const since = subDays(new Date(), days).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["maskyoo-calls-kpi", tenantId, allLast9, days],
    enabled: !!tenantId && validNumbers.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, from_number, to_number, status, duration, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;

      const byLast9: Record<string, { incoming: number; outgoing: number; answered: number }> = {};
      for (const n of validNumbers) {
        const incoming = (data || []).filter((c) =>
          (c.to_number || "").replace(/\D/g, "").endsWith(n.last9)
        );
        const outgoing = (data || []).filter((c) =>
          (c.from_number || "").replace(/\D/g, "").endsWith(n.last9)
        );
        const answered = incoming.filter(
          (c) => (c.status || "").toLowerCase() === "answered" || (c.duration || 0) > 0
        );
        byLast9[n.last9] = {
          incoming: incoming.length,
          outgoing: outgoing.length,
          answered: answered.length,
        };
      }
      return byLast9;
    },
  });

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
        {validNumbers.map((n) => {
          const stats = data?.[n.last9];
          const accent = n.accent || "emerald";
          const accentText =
            accent === "blue" ? "text-blue-700 dark:text-blue-200"
            : accent === "purple" ? "text-purple-700 dark:text-purple-200"
            : "text-emerald-700 dark:text-emerald-200";
          const iconColor =
            accent === "blue" ? "text-blue-600"
            : accent === "purple" ? "text-purple-600"
            : "text-emerald-600";
          return (
            <div key={n.last9} className="space-y-2">
              <div className={`text-xs font-semibold ${accentText}`}>{n.label}</div>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  icon={<PhoneIncoming className={`h-4 w-4 ${iconColor}`} />}
                  label="נכנסות"
                  value={isLoading ? "…" : String(stats?.incoming ?? 0)}
                />
                <Stat
                  icon={<Phone className={`h-4 w-4 ${iconColor}`} />}
                  label="נענו"
                  value={isLoading ? "…" : String(stats?.answered ?? 0)}
                />
                <Stat
                  icon={<PhoneOutgoing className={`h-4 w-4 ${iconColor}`} />}
                  label="יוצאות"
                  value={isLoading ? "…" : String(stats?.outgoing ?? 0)}
                />
              </div>
              <p className="text-xs text-muted-foreground" dir="ltr">
                {n.number}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
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
