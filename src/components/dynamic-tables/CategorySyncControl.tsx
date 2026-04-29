import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CategoryTable {
  id: string;
  name: string;
  integration_type: string | null;
  integration_settings?: any;
}

interface Props {
  category: string;
  tables: CategoryTable[];
}

const FN_BY_TYPE: Record<string, string> = {
  google_analytics: "sync-google-analytics-data",
  facebook_ecommerce: "sync-facebook-ecommerce",
  facebook_insights: "sync-facebook-insights",
  google_ads: "sync-google-ads-data",
  google_search_console: "sync-google-search-console-data",
  ahrefs: "sync-ahrefs-data",
};

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, idx: number) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

export function CategorySyncControl({ category, tables }: Props) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const syncableTables = useMemo(
    () => tables.filter((t) => t.integration_type && FN_BY_TYPE[t.integration_type]),
    [tables]
  );

  // Show the OLDEST sync among syncable tables — reflects the staleness of the
  // category as a whole. A single freshly-synced table shouldn't make everything look fresh.
  const { oldestSyncAt, neverSyncedCount } = useMemo(() => {
    let oldest: Date | null = null;
    let never = 0;
    for (const t of syncableTables) {
      const ts = t.integration_settings?.last_sync_at;
      if (!ts) {
        never++;
        continue;
      }
      const d = new Date(ts);
      if (!oldest || d < oldest) oldest = d;
    }
    return { oldestSyncAt: oldest, neverSyncedCount: never };
  }, [syncableTables]);

  const handleSyncAll = async () => {
    if (syncableTables.length === 0) {
      toast.error("אין דוחות לסנכרון בקטגוריה זו");
      return;
    }
    setIsSyncing(true);
    setProgress({ done: 0, total: syncableTables.length });
    let success = 0;
    let failed = 0;

    await runWithConcurrency(syncableTables, 3, async (t) => {
      const fnName = FN_BY_TYPE[t.integration_type as string];
      try {
        const { error } = await supabase.functions.invoke(fnName, {
          // send both common param shapes for safety across functions
          body: { tableId: t.id, table_id: t.id },
        });
        if (error) throw error;
        success++;
      } catch (e: any) {
        console.error(`[CategorySyncControl] sync failed for ${t.name}:`, e);
        failed++;
      } finally {
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    });

    setIsSyncing(false);
    if (failed === 0) {
      toast.success(`סונכרנו ${success} דוחות בהצלחה`);
    } else if (success === 0) {
      toast.error(`הסנכרון נכשל עבור כל ${failed} הדוחות`);
    } else {
      toast.warning(`סונכרנו ${success} דוחות, ${failed} נכשלו`);
    }
    // Refresh tables list so last_sync_at updates
    queryClient.invalidateQueries({ queryKey: ["crm-tables"] });
    queryClient.invalidateQueries({ queryKey: ["dynamic-tables"] });
  };

  const lastSyncLabel = lastSyncAt
    ? `סנכרון אחרון: לפני ${formatDistanceToNow(lastSyncAt, { locale: he })}`
    : "לא סונכרן עדיין";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>{lastSyncLabel}</span>
            </div>
          </TooltipTrigger>
          {lastSyncAt && (
            <TooltipContent>
              {lastSyncAt.toLocaleString("he-IL")}
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <Button
        size="sm"
        variant="outline"
        onClick={handleSyncAll}
        disabled={isSyncing || syncableTables.length === 0}
        className="gap-1.5 h-8"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
        {isSyncing
          ? `מסנכרן… (${progress.done}/${progress.total})`
          : `סנכרן עכשיו${syncableTables.length ? ` (${syncableTables.length})` : ""}`}
      </Button>
    </div>
  );
}
