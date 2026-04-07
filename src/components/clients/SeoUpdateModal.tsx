/**
 * SeoUpdateModal
 *
 * Popup for logging a monthly SEO status update for a client.
 * Writes to seo_monthly_updates table.
 *
 * Usage:
 *   <SeoUpdateModal
 *     clientId={client.id}
 *     clientName={client.name}
 *     open={open}
 *     onOpenChange={setOpen}
 *   />
 */

import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Minus, History } from "lucide-react";
import { format, startOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { SEO_STATUS_COLORS, SEO_STATUS_LABELS } from "@/lib/healthScore";

interface SeoUpdateModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SeoUpdateModal({
  clientId,
  clientName,
  open,
  onOpenChange,
}: SeoUpdateModalProps) {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Default to current month
  const currentMonthStr = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [status, setStatus] = useState<"up" | "stable" | "down">("stable");
  const [notes, setNotes] = useState("");

  // Generate last 6 months for selection
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = startOfMonth(subMonths(new Date(), i));
    return {
      value: format(d, "yyyy-MM-dd"),
      label: format(d, "MMMM yyyy", { locale: he }),
    };
  });

  // Fetch existing SEO history for this client
  const { data: seoHistory = [] } = useQuery({
    queryKey: ["seo-monthly-history", clientId, tenantId],
    queryFn: async () => {
      if (!clientId || !tenantId) return [];
      const { data, error } = await supabase
        .from("seo_monthly_updates")
        .select("id, month, status, notes, created_at")
        .eq("client_id", clientId)
        .eq("tenant_id", tenantId)
        .order("month", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId && !!tenantId && open,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Missing tenant or user");

      const { error } = await supabase
        .from("seo_monthly_updates")
        .upsert(
          {
            client_id: clientId,
            tenant_id: tenantId,
            month: selectedMonth,
            status,
            notes: notes.trim() || null,
            updated_by: user.id,
          },
          { onConflict: "client_id,month" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("עדכון SEO נשמר בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-history", clientId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-latest"] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-single", clientId] });
      queryClient.invalidateQueries({ queryKey: ["dmm-clients"] });
      setNotes("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err?.message || "שגיאה בשמירת עדכון SEO");
    },
  });

  const statusIcon = {
    up: <TrendingUp className="h-4 w-4 text-green-600" />,
    stable: <Minus className="h-4 w-4 text-blue-600" />,
    down: <TrendingDown className="h-4 w-4 text-red-600" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🔍 עדכון SEO חודשי — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Month Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">חודש</Label>
            <div className="flex flex-wrap gap-2">
              {monthOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedMonth(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedMonth === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* SEO Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">סטטוס SEO</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as any)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="up" />
                <span className="flex items-center gap-1 text-sm text-green-700 font-medium">
                  {statusIcon.up} עלייה ↑
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="stable" />
                <span className="flex items-center gap-1 text-sm text-blue-700 font-medium">
                  {statusIcon.stable} יציב →
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="down" />
                <span className="flex items-center gap-1 text-sm text-red-700 font-medium">
                  {statusIcon.down} ירידה ↓
                </span>
              </label>
            </RadioGroup>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">הערות (אופציונלי)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="פרט שינויים, מילות מפתח שעלו/ירדו, פעולות שבוצעו..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* History */}
          {seoHistory.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <Label className="text-sm font-medium flex items-center gap-1">
                <History className="h-4 w-4" />
                היסטוריה
              </Label>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {seoHistory.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/40"
                  >
                    <span className="text-muted-foreground w-24 shrink-0">
                      {format(new Date(entry.month), "MMM yyyy", { locale: he })}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-xs ${SEO_STATUS_COLORS[entry.status as string] || ""}`}
                    >
                      {SEO_STATUS_LABELS[entry.status as string] || entry.status}
                    </Badge>
                    {entry.notes && (
                      <span className="text-muted-foreground truncate">{entry.notes}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמור עדכון SEO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
