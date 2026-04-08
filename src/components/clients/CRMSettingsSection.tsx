import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Settings2, TrendingUp, Search, Share2, BarChart3, Loader2, Check, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";

// ── Constants ──────────────────────────────────────────────────────────────────
const TIER_OPTIONS = [
  { value: "A", label: "A — עדיפות גבוהה", color: "bg-red-100 text-red-700 border-red-300" },
  { value: "B", label: "B — עדיפות בינונית", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "C", label: "C — עדיפות רגילה",  color: "bg-green-100 text-green-700 border-green-300" },
];

const SERVICE_OPTIONS = [
  { value: "ppc_google",  label: "PPC Google",  icon: BarChart3 },
  { value: "ppc_meta",    label: "PPC Meta",    icon: BarChart3 },
  { value: "seo",         label: "SEO",         icon: Search },
  { value: "social",      label: "Social",      icon: Share2 },
  { value: "full_social", label: "Full Social", icon: Share2 },
  { value: "social_meta", label: "Social Meta", icon: Share2 },
  { value: "automation",  label: "Automation",  icon: Settings2 },
];

const SEO_STATUS_OPTIONS = [
  { value: "up",     label: "עלייה",   color: "text-green-700" },
  { value: "stable", label: "יציב",   color: "text-blue-700" },
  { value: "down",   label: "ירידה",  color: "text-red-700" },
];

// ── Helper: get current month string yyyy-MM ───────────────────────────────────
function currentMonth() {
  return format(new Date(), "yyyy-MM");
}

// ── Main component ─────────────────────────────────────────────────────────────
interface CRMSettingsSectionProps {
  client: any;
  onUpdate?: () => void;
}

export function CRMSettingsSection({ client, onUpdate }: CRMSettingsSectionProps) {
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Local state for SEO modal
  const [seoOpen, setSeoOpen] = useState(false);
  const [seoStatus, setSeoStatus] = useState("stable");
  const [seoNotes, setSeoNotes] = useState("");
  const [seoMonth, setSeoMonth] = useState(currentMonth());

  // Current values (graceful fallback if columns don't exist yet)
  const currentTier: string = (client as any).tier ?? "";
  const currentServices: string[] = (() => {
    const raw = (client as any).services;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
  })();
  const hasSeo = currentServices.includes("seo");

  // Fetch last 3 SEO updates
  const { data: seoHistory = [] } = useQuery({
    queryKey: ["seo-history", client.id],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("seo_monthly_updates")
          .select("month, status, notes, updated_at")
          .eq("client_id", client.id)
          .order("month", { ascending: false })
          .limit(3);
        if (error) return [];
        return data ?? [];
      } catch { return []; }
    },
    enabled: !!client.id && hasSeo,
  });

  // ── Mutation: update tier ───────────────────────────────────────────────────
  const updateTierMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ tier } as any)
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onUpdate?.();
      toast.success("Tier עודכן");
    },
    onError: () => toast.error("שגיאה בעדכון Tier"),
  });

  // ── Mutation: toggle service ────────────────────────────────────────────────
  const updateServicesMutation = useMutation({
    mutationFn: async (services: string[]) => {
      const { error } = await supabase
        .from("clients")
        .update({ services } as any)
        .eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onUpdate?.();
    },
    onError: () => toast.error("שגיאה בעדכון שירותים"),
  });

  function toggleService(val: string) {
    const next = currentServices.includes(val)
      ? currentServices.filter(s => s !== val)
      : [...currentServices, val];
    updateServicesMutation.mutate(next);
  }

  // ── Mutation: save SEO update ───────────────────────────────────────────────
  const saveSeoMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("Missing tenant or user");
      const { error } = await (supabase as any)
        .from("seo_monthly_updates")
        .upsert({
          client_id: client.id,
          tenant_id: tenantId,
          month: seoMonth,
          status: seoStatus,
          notes: seoNotes.trim() || null,
          updated_by: user.id,
        }, { onConflict: "client_id,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo-history", client.id] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-updates"] });
      setSeoOpen(false);
      setSeoNotes("");
      toast.success("עדכון SEO נשמר");
    },
    onError: () => toast.error("שגיאה בשמירת עדכון SEO"),
  });

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-card border border-border/60 rounded-xl p-4 space-y-4 text-right shadow-sm" dir="rtl">
        <h3 className="font-semibold text-sm flex items-center gap-2 justify-end">
          הגדרות CRM
          <Settings2 className="h-4 w-4 text-primary" />
        </h3>

        {/* Tier */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">דרגת חשיבות (Tier)</Label>
          <div className="flex gap-2 flex-wrap justify-end">
            {TIER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateTierMutation.mutate(opt.value)}
                className={`px-3 py-1 rounded-full border text-xs font-semibold transition-all ${
                  currentTier === opt.value
                    ? opt.color + " ring-2 ring-offset-1 ring-current"
                    : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.value}
              </button>
            ))}
            {currentTier && (
              <span className="text-xs text-muted-foreground self-center">
                {TIER_OPTIONS.find(o => o.value === currentTier)?.label}
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Services */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">שירותים פעילים</Label>
          <div className="flex gap-2 flex-wrap justify-end">
            {SERVICE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = currentServices.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleService(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                  {active && <Check className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* SEO update button — only if SEO service is active */}
        {hasSeo && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => setSeoOpen(true)}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  עדכון SEO חודשי
                </Button>
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  היסטוריית SEO
                </Label>
              </div>

              {seoHistory.length > 0 ? (
                <div className="flex gap-2 flex-wrap justify-end">
                  {seoHistory.map((entry: any) => {
                    const opt = SEO_STATUS_OPTIONS.find(o => o.value === entry.status);
                    return (
                      <div key={entry.month} className="flex items-center gap-1 text-xs border rounded-md px-2 py-1 bg-muted/30">
                        <CalendarDays className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">{entry.month}</span>
                        <span className={opt?.color ?? ""}>{opt?.label ?? entry.status}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">אין עדכוני SEO עדיין</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* SEO Update Dialog */}
      <Dialog open={seoOpen} onOpenChange={setSeoOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <TrendingUp className="h-4 w-4 text-primary" />
              עדכון SEO חודשי — {client.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Month */}
            <div className="space-y-1">
              <Label className="text-sm">חודש</Label>
              <input
                type="month"
                value={seoMonth}
                onChange={e => setSeoMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-sm">סטטוס</Label>
              <Select value={seoStatus} onValueChange={setSeoStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEO_STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-sm">הערות</Label>
              <Textarea
                placeholder="מה השתנה החודש..."
                value={seoNotes}
                onChange={e => setSeoNotes(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setSeoOpen(false)}>ביטול</Button>
            <Button
              size="sm"
              onClick={() => saveSeoMutation.mutate()}
              disabled={saveSeoMutation.isPending}
            >
              {saveSeoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "שמור"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
