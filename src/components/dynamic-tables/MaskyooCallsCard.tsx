import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Pencil, RefreshCw, CalendarIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface MaskyooLine {
  /** Display number (e.g. "077-8050632"). */
  number: string;
  /** Category — controls which cube this line is summed into. */
  category: "organic" | "paid";
}

interface Props {
  tenantId: string;
  clientId: string;
  /** Maskyoo numbers assigned to this client (split by category). */
  numbers: MaskyooLine[];
  /** Hide edit + sync controls (share view). */
  readOnly?: boolean;
}

interface Snapshot {
  id: string;
  category: "organic" | "paid";
  period_start: string;
  period_end: string;
  incoming_count: number;
  is_manual: boolean;
  note: string | null;
  synced_at: string;
}

const CATEGORIES: Array<{ key: "organic" | "paid"; label: string }> = [
  { key: "organic", label: "אורגני" },
  { key: "paid", label: "ממומן" },
];

export function MaskyooCallsCard({ tenantId, clientId, numbers, readOnly = false }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Date range state — default last 30 days
  const [range, setRange] = useState<DateRange>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const periodStart = range.from ? format(range.from, "yyyy-MM-dd") : "";
  const periodEnd = range.to ? format(range.to, "yyyy-MM-dd") : periodStart;

  // Fetch snapshots for this client+range
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["seo-call-snapshots", tenantId, clientId, periodStart, periodEnd],
    enabled: !!tenantId && !!clientId && !!periodStart && !!periodEnd,
    staleTime: 30_000,
    queryFn: async (): Promise<Snapshot[]> => {
      const { data, error } = await supabase
        .from("seo_call_snapshots")
        .select("id, category, period_start, period_end, incoming_count, is_manual, note, synced_at")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);
      if (error) throw error;
      return (data || []) as Snapshot[];
    },
  });

  const byCategory = useMemo(() => {
    const m: Record<string, Snapshot> = {};
    for (const s of snapshots) m[s.category] = s;
    return m;
  }, [snapshots]);

  const numbersByCat = useMemo(() => {
    const m: Record<"organic" | "paid", string[]> = { organic: [], paid: [] };
    for (const n of numbers || []) {
      const last9 = (n.number || "").replace(/\D/g, "").slice(-9);
      if (last9.length === 9 && (n.category === "organic" || n.category === "paid")) {
        m[n.category].push(last9);
      }
    }
    return m;
  }, [numbers]);

  // Sync mutation — pulls call_logs for the chosen window per category
  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!range.from || !range.to) throw new Error("בחר טווח תאריכים");
      const since = startOfDay(range.from).toISOString();
      const until = endOfDay(range.to).toISOString();

      const { data: rows, error } = await supabase
        .from("call_logs")
        .select("to_number, created_at")
        .eq("tenant_id", tenantId)
        .eq("provider", "maskyoo")
        .gte("created_at", since)
        .lte("created_at", until)
        .limit(10000);
      if (error) throw error;

      const all = (rows || []) as Array<{ to_number: string | null }>;
      const upserts: Array<{
        tenant_id: string; client_id: string; category: "organic" | "paid";
        period_start: string; period_end: string;
        incoming_count: number; is_manual: boolean; synced_at: string;
      }> = [];

      for (const cat of ["organic", "paid"] as const) {
        const last9s = numbersByCat[cat];
        if (last9s.length === 0) continue; // skip — preserve existing manual snapshot
        const count = all.filter((r) => {
          const d = (r.to_number || "").replace(/\D/g, "").slice(-9);
          return last9s.includes(d);
        }).length;
        upserts.push({
          tenant_id: tenantId,
          client_id: clientId,
          category: cat,
          period_start: periodStart,
          period_end: periodEnd,
          incoming_count: count,
          is_manual: false,
          synced_at: new Date().toISOString(),
        });
      }

      if (upserts.length === 0) {
        return { skipped: true };
      }

      const { error: upErr } = await supabase
        .from("seo_call_snapshots")
        .upsert(upserts, { onConflict: "tenant_id,client_id,category,period_start,period_end" });
      if (upErr) throw upErr;
      return { skipped: false, count: upserts.length };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["seo-call-snapshots", tenantId, clientId] });
      if (res.skipped) {
        toast({ title: "אין מספרי מסקיו מחוברים", description: "ערוך ידנית כדי להזין מספרים." });
      } else {
        toast({ title: "סונכרן בהצלחה" });
      }
    },
    onError: (e: any) => toast({ title: "שגיאה בסנכרון", description: e.message, variant: "destructive" }),
  });

  const formatRange = () => {
    if (!range.from) return "בחר טווח";
    const f = format(range.from, "d.M.yy", { locale: he });
    const t = range.to ? format(range.to, "d.M.yy", { locale: he }) : f;
    return `${f} – ${t}`;
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-blue-50/40 dark:from-emerald-950/20 dark:to-blue-950/20">
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-emerald-700" />
          שיחות מסקיו
        </CardTitle>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {formatRange()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={range}
                  onSelect={(r) => r && setRange(r)}
                  numberOfMonths={2}
                  className={cn("p-3 pointer-events-auto")}
                  locale={he}
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !range.from || !range.to}
            >
              {syncMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              סנכרון
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((cat) => (
            <Cube
              key={cat.key}
              tenantId={tenantId}
              clientId={clientId}
              category={cat.key}
              label={cat.label}
              periodStart={periodStart}
              periodEnd={periodEnd}
              snapshot={byCategory[cat.key]}
              hasNumbers={numbersByCat[cat.key].length > 0}
              isLoading={isLoading}
              readOnly={readOnly}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Cube({
  tenantId, clientId, category, label, periodStart, periodEnd,
  snapshot, hasNumbers, isLoading, readOnly,
}: {
  tenantId: string;
  clientId: string;
  category: "organic" | "paid";
  label: string;
  periodStart: string;
  periodEnd: string;
  snapshot?: Snapshot;
  hasNumbers: boolean;
  isLoading: boolean;
  readOnly: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const isOrganic = category === "organic";
  const accent = isOrganic
    ? "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900"
    : "bg-blue-50/80 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900";
  const titleColor = isOrganic ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200";

  const value = snapshot?.incoming_count ?? 0;
  const synced = snapshot?.synced_at ? format(new Date(snapshot.synced_at), "d.M.yy") : null;

  return (
    <>
      <div className={cn("rounded-lg border p-4 relative transition-shadow hover:shadow-sm", accent)}>
        <div className="flex items-start justify-between mb-2">
          <div className={cn("text-sm font-semibold flex items-center gap-1.5", titleColor)}>
            {label}
            {snapshot?.is_manual && (
              <Badge variant="outline" className="h-4 text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-300">
                ידני
              </Badge>
            )}
          </div>
          {!readOnly && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setEditOpen(true)}
              title="עריכה ידנית"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
        <div className="text-3xl font-bold tabular-nums">
          {isLoading ? "…" : value.toLocaleString("he-IL")}
        </div>
        <div className="text-xs text-muted-foreground mt-1">שיחות נכנסות</div>
        <div className="text-[11px] text-muted-foreground mt-2 min-h-[14px]">
          {synced ? `סונכרן ${synced}` : hasNumbers ? "טרם סונכרן" : "אין מספר מחובר · ערוך ידנית"}
        </div>
      </div>

      {!readOnly && (
        <ManualEditDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          tenantId={tenantId}
          clientId={clientId}
          category={category}
          label={label}
          periodStart={periodStart}
          periodEnd={periodEnd}
          current={snapshot}
        />
      )}
    </>
  );
}

function ManualEditDialog({
  open, onOpenChange, tenantId, clientId, category, label,
  periodStart, periodEnd, current,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  clientId: string;
  category: "organic" | "paid";
  label: string;
  periodStart: string;
  periodEnd: string;
  current?: Snapshot;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [count, setCount] = useState<string>(String(current?.incoming_count ?? 0));
  const [note, setNote] = useState<string>(current?.note ?? "");

  // Sync local state when dialog opens for a different snapshot
  useMemo(() => {
    if (open) {
      setCount(String(current?.incoming_count ?? 0));
      setNote(current?.note ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = parseInt(count, 10);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error("מספר לא תקין");
      const payload = {
        tenant_id: tenantId,
        client_id: clientId,
        category,
        period_start: periodStart,
        period_end: periodEnd,
        incoming_count: parsed,
        is_manual: true,
        note: note.trim() || null,
        synced_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("seo_call_snapshots")
        .upsert(payload, { onConflict: "tenant_id,client_id,category,period_start,period_end" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seo-call-snapshots", tenantId, clientId] });
      toast({ title: "נשמר" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "שגיאה בשמירה", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>עריכה ידנית · {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="count">שיחות נכנסות</Label>
            <Input
              id="count"
              type="number"
              min={0}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">הערה (אופציונלי)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            טווח: {periodStart} – {periodEnd}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 ml-2 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
