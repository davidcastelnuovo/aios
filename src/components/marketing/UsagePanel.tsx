import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Coins, Activity, CheckCircle2, AlertTriangle } from "lucide-react";

interface Props {
  tenantId: string;
  clientId: string;
}

export function UsagePanel({ tenantId, clientId }: Props) {
  const { data: stats } = useQuery({
    queryKey: ["marketing-usage", tenantId, clientId],
    queryFn: async () => {
      // Items for this client
      const { data: items } = await supabase
        .from("marketing_work_items")
        .select("id")
        .eq("client_id", clientId);
      const ids = (items ?? []).map((i: any) => i.id);
      if (ids.length === 0) {
        return { total: 0, success: 0, failed: 0, tokensIn: 0, tokensOut: 0, cost: 0, runs: [] };
      }
      const { data: runs } = await supabase
        .from("marketing_runs")
        .select("status, tokens_in, tokens_out, cost_usd, created_at, model")
        .in("item_id", ids)
        .order("created_at", { ascending: false })
        .limit(200);
      const r = runs ?? [];
      return {
        total: r.length,
        success: r.filter((x: any) => x.status === "completed").length,
        failed: r.filter((x: any) => x.status === "failed").length,
        tokensIn: r.reduce((s: number, x: any) => s + (x.tokens_in ?? 0), 0),
        tokensOut: r.reduce((s: number, x: any) => s + (x.tokens_out ?? 0), 0),
        cost: r.reduce((s: number, x: any) => s + Number(x.cost_usd ?? 0), 0),
        runs: r,
      };
    },
  });

  if (!stats) return <div className="p-6 text-sm text-muted-foreground">טוען...</div>;

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className="h-3 w-3" /> ריצות
          </div>
          <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" /> הצלחה
          </div>
          <div className="mt-1 text-2xl font-semibold text-emerald-600">{stats.success}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Coins className="h-3 w-3" /> טוקנים סה"כ
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {(stats.tokensIn + stats.tokensOut).toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {stats.tokensIn.toLocaleString()} in · {stats.tokensOut.toLocaleString()} out
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" /> עלות
          </div>
          <div className="mt-1 text-2xl font-semibold">${stats.cost.toFixed(4)}</div>
        </Card>
      </div>

      <Card className="p-3">
        <div className="mb-2 text-sm font-medium">ריצות אחרונות</div>
        {stats.runs.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">אין ריצות עדיין</div>
        ) : (
          <div className="space-y-1 text-xs">
            {stats.runs.slice(0, 30).map((r: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 border-b py-1 last:border-0">
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("he-IL")}
                </span>
                <span>{r.model ?? "—"}</span>
                <span className="ms-auto text-muted-foreground">
                  {(r.tokens_in ?? 0) + (r.tokens_out ?? 0)} tok · ${Number(r.cost_usd ?? 0).toFixed(4)}
                </span>
                <span
                  className={
                    r.status === "completed"
                      ? "text-emerald-600"
                      : r.status === "failed"
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
