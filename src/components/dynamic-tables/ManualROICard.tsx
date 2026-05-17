import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ManualROICardProps {
  tableId: string;
  spend: number;
  leads: number;
  currency: string;
  initialClosures?: number | null;
  initialRevenue?: number | null;
  readOnly?: boolean;
  /**
   * Full integration_settings object (so we don't overwrite other keys on save).
   */
  integrationSettings?: Record<string, any> | null;
  /**
   * Optional custom save function. When provided (e.g. shared-link viewers
   * who don't have a Supabase session), it's called instead of the default
   * direct Supabase update.
   */
  saveFn?: (manual_roi: { closures: number | null; revenue: number | null }) => Promise<void>;
}

export function ManualROICard({
  tableId,
  spend,
  leads,
  currency,
  initialClosures,
  initialRevenue,
  readOnly = false,
  integrationSettings,
}: ManualROICardProps) {
  const [closures, setClosures] = useState<string>(
    initialClosures != null ? String(initialClosures) : ""
  );
  const [revenue, setRevenue] = useState<string>(
    initialRevenue != null ? String(initialRevenue) : ""
  );
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);

  // Sync if initial values change (e.g., table refetch)
  useEffect(() => {
    setClosures(initialClosures != null ? String(initialClosures) : "");
    setRevenue(initialRevenue != null ? String(initialRevenue) : "");
  }, [initialClosures, initialRevenue]);

  const closuresNum = parseFloat(closures) || 0;
  const revenueNum = parseFloat(revenue) || 0;
  const hasData = closures !== "" || revenue !== "";

  const closingRate = leads > 0 ? (closuresNum / leads) * 100 : 0;
  const costPerClosure = closuresNum > 0 ? spend / closuresNum : 0;
  const profit = revenueNum - spend;
  const roi = spend > 0 ? (profit / spend) * 100 : 0;

  const save = async (newClosures: string, newRevenue: string) => {
    if (readOnly || !tableId) return;
    setSaving(true);
    try {
      const baseSettings = integrationSettings || {};
      const newSettings = {
        ...baseSettings,
        manual_roi: {
          closures: newClosures === "" ? null : parseFloat(newClosures) || 0,
          revenue: newRevenue === "" ? null : parseFloat(newRevenue) || 0,
        },
      };
      const { error } = await supabase
        .from("crm_tables")
        .update({ integration_settings: newSettings })
        .eq("id", tableId);
      if (error) throw error;
    } catch (e: any) {
      toast.error("שגיאה בשמירת נתוני ROI: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (c: string, r: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => save(c, r), 600);
  };

  const formatCurrency = (n: number) =>
    `${currency}${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

  const profitColor = profit > 0 ? "text-green-600" : profit < 0 ? "text-red-600" : "text-muted-foreground";
  const roiColor = roi > 0 ? "text-green-600" : roi < 0 ? "text-red-600" : "text-muted-foreground";

  return (
    <Card className="mb-4 p-4" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-base">סיכום ROI ידני</h3>
        {saving && <span className="text-xs text-muted-foreground">שומר...</span>}
      </div>

      {/* Row 1: read-only context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">הוצאה</div>
          <div className="font-medium">{formatCurrency(spend)}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">לידים</div>
          <div className="font-medium">{leads.toLocaleString("he-IL")}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">סגירות</div>
          {readOnly ? (
            <div className="font-medium">{hasData ? closuresNum.toLocaleString("he-IL") : "—"}</div>
          ) : (
            <Input
              type="number"
              min="0"
              step="1"
              value={closures}
              placeholder="0"
              onChange={(e) => {
                setClosures(e.target.value);
                scheduleSave(e.target.value, revenue);
              }}
              className="h-8 text-sm"
            />
          )}
        </div>
        <div>
          <div className="text-muted-foreground text-xs">הכנסות</div>
          {readOnly ? (
            <div className="font-medium">{hasData ? formatCurrency(revenueNum) : "—"}</div>
          ) : (
            <Input
              type="number"
              min="0"
              step="1"
              value={revenue}
              placeholder="0"
              onChange={(e) => {
                setRevenue(e.target.value);
                scheduleSave(closures, e.target.value);
              }}
              className="h-8 text-sm"
            />
          )}
        </div>
      </div>

      {/* Row 2: calculations */}
      {hasData ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t text-sm">
          <div>
            <div className="text-muted-foreground text-xs">אחוז סגירה</div>
            <div className="font-medium">{closingRate.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">עלות לסגירה</div>
            <div className="font-medium">{closuresNum > 0 ? formatCurrency(costPerClosure) : "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">רווח</div>
            <div className={`font-semibold ${profitColor}`}>{formatCurrency(profit)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">ROI</div>
            <div className={`font-semibold ${roiColor}`}>
              {roi.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%
            </div>
          </div>
        </div>
      ) : (
        !readOnly && (
          <div className="pt-3 border-t text-xs text-muted-foreground">
            הזן סגירות והכנסות כדי לראות חישוב רווח ו-ROI.
          </div>
        )
      )}
    </Card>
  );
}
