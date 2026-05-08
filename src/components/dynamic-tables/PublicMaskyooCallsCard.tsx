import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Snapshot {
  category: "organic" | "paid" | string;
  incoming_count: number;
  is_manual: boolean;
}

interface Props {
  snapshots: Snapshot[];
  periodLabel?: string;
}

const CATEGORIES: Array<{ key: "organic" | "paid"; label: string }> = [
  { key: "organic", label: "אורגני" },
  { key: "paid", label: "ממומן" },
];

/**
 * Read-only Maskyoo calls card for public/shared views.
 * Receives snapshots already fetched by the edge function (RLS-bypassed).
 */
export function PublicMaskyooCallsCard({ snapshots, periodLabel }: Props) {
  const byCat: Record<string, Snapshot> = {};
  for (const s of snapshots || []) byCat[s.category] = s;

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-blue-50/40 dark:from-emerald-950/20 dark:to-blue-950/20">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-emerald-700" />
          שיחות מסקיו
        </CardTitle>
        {periodLabel && (
          <span className="text-xs text-muted-foreground">{periodLabel}</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => {
            const snap = byCat[cat.key];
            const value = snap?.incoming_count ?? 0;
            const isOrganic = cat.key === "organic";
            const accent = isOrganic
              ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
              : "bg-blue-50/80 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900";
            const titleColor = isOrganic
              ? "text-emerald-800 dark:text-emerald-200"
              : "text-blue-800 dark:text-blue-200";
            return (
              <div key={cat.key} className={cn("rounded-lg border p-4", accent)}>
                <div className={cn("text-sm font-semibold mb-2", titleColor)}>
                  {cat.label}
                </div>
                <div className="text-3xl font-bold tabular-nums">
                  {value.toLocaleString("he-IL")}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  שיחות נכנסות
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
