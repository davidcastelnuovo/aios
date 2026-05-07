import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneIncoming, PhoneOutgoing, Phone } from "lucide-react";
import { subDays } from "date-fns";

interface MaskyooCallsCardProps {
  tenantId: string;
  maskyooNumber: string;
  /** Number of days to look back. Defaults to 30. */
  days?: number;
}

/**
 * KPI card showing incoming call count (from call_logs) for a specific
 * Maskyoo phone number over the last N days. Used inside SEO / Google
 * report dashboards so a client can see how many phone leads the report
 * period generated.
 *
 * Matching is done by the last 9 digits of the number, consistent with
 * the project-wide phone normalization policy.
 */
export function MaskyooCallsCard({ tenantId, maskyooNumber, days = 30 }: MaskyooCallsCardProps) {
  const last9 = (maskyooNumber || "").replace(/\D/g, "").slice(-9);
  const since = subDays(new Date(), days).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["maskyoo-calls-kpi", tenantId, last9, days],
    enabled: !!tenantId && last9.length === 9,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, from_number, to_number, status, duration, created_at")
        .eq("tenant_id", tenantId)
        .gte("created_at", since)
        .limit(5000);
      if (error) throw error;

      const incoming = (data || []).filter((c) =>
        (c.to_number || "").replace(/\D/g, "").endsWith(last9)
      );
      const outgoing = (data || []).filter((c) =>
        (c.from_number || "").replace(/\D/g, "").endsWith(last9)
      );
      const answered = incoming.filter(
        (c) => (c.status || "").toLowerCase() === "answered" || (c.duration || 0) > 0
      );
      return {
        incomingCount: incoming.length,
        outgoingCount: outgoing.length,
        answeredCount: answered.length,
      };
    },
  });

  if (last9.length !== 9) return null;

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
          <Phone className="h-4 w-4" />
          שיחות מסקיו · {days} ימים אחרונים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          <Stat
            icon={<PhoneIncoming className="h-4 w-4 text-emerald-600" />}
            label="נכנסות"
            value={isLoading ? "…" : String(data?.incomingCount ?? 0)}
          />
          <Stat
            icon={<Phone className="h-4 w-4 text-emerald-600" />}
            label="נענו"
            value={isLoading ? "…" : String(data?.answeredCount ?? 0)}
          />
          <Stat
            icon={<PhoneOutgoing className="h-4 w-4 text-emerald-600" />}
            label="יוצאות"
            value={isLoading ? "…" : String(data?.outgoingCount ?? 0)}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground" dir="ltr">
          {maskyooNumber}
        </p>
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
