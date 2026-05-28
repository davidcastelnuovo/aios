import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useUserTenants } from "@/hooks/useUserTenants";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Loader2, Search } from "lucide-react";

interface ShareAutomationDialogProps {
  automation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareAutomationDialog({ automation, open, onOpenChange }: ShareAutomationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { tenantId: sourceTenantId } = useCurrentTenant();
  const { userTenants, isLoading: tenantsLoading } = useUserTenants(user?.id);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Existing clones of this automation, to mark "already shared"
  const { data: existingClones } = useQuery({
    queryKey: ["automation-clones", automation?.id],
    queryFn: async () => {
      if (!automation?.id) return [] as any[];
      const { data, error } = await supabase
        .from("automations")
        .select("id, tenant_id")
        .eq("source_automation_id", automation.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!automation?.id && open,
  });

  const clonedTenantIds = useMemo(
    () => new Set((existingClones || []).map((c: any) => c.tenant_id)),
    [existingClones]
  );

  const availableTenants = useMemo(() => {
    const list = (userTenants || []).filter((t: any) => t.id !== sourceTenantId);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((t: any) =>
      (t.name || "").toLowerCase().includes(q) || (t.slug || "").toLowerCase().includes(q)
    );
  }, [userTenants, sourceTenantId, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClone = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("clone-automation-to-tenant", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          automation_id: automation.id,
          target_tenant_ids: Array.from(selected),
        },
      });
      if (error) throw error;
      const results = (data as any)?.results || [];
      const ok = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success);
      toast({
        title: ok > 0 ? `שותף ל-${ok} ארגונים` : "השכפול נכשל",
        description: failed.length > 0
          ? `נכשל ב-${failed.length}: ${failed.map((f: any) => f.error).join(", ")}`
          : "האוטומציה נוצרה כמושבתת בארגונים היעד - יש להפעיל ולהשלים חיבורי אינטגרציה שם",
        variant: ok === 0 ? "destructive" : "default",
      });
      if (ok > 0) {
        setSelected(new Set());
        onOpenChange(false);
      }
    } catch (e: any) {
      toast({ title: "שגיאה בשכפול", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>שתף אוטומציה עם ארגון אחר</DialogTitle>
          <DialogDescription>
            שכפול של "{automation?.name}" לארגונים נבחרים. האוטומציה החדשה תפעל אך ורק על הנתונים של הארגון היעד
            (קמפיינרים, לקוחות, אינטגרציות). היא תיווצר במצב מושבת עד שתשלימו את חיבורי האינטגרציה שם.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש ארגון..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>

          <ScrollArea className="h-72 rounded-md border">
            <div className="p-2 space-y-1">
              {tenantsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : availableTenants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  אין ארגונים זמינים לשיתוף
                </p>
              ) : (
                availableTenants.map((t: any) => {
                  const alreadyCloned = clonedTenantIds.has(t.id);
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selected.has(t.id)}
                        onCheckedChange={() => toggle(t.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.slug && (
                          <p className="text-xs text-muted-foreground truncate">{t.slug}</p>
                        )}
                      </div>
                      {alreadyCloned && (
                        <Badge variant="secondary" className="text-[10px]">
                          כבר שותף
                        </Badge>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ביטול
          </Button>
          <Button onClick={handleClone} disabled={selected.size === 0 || submitting}>
            {submitting && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            שכפל ל-{selected.size} ארגונים
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
