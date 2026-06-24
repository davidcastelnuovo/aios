import { useState, useMemo } from "react";
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
import { Loader2, Search, Copy, AlertTriangle, CheckCircle2 } from "lucide-react";

export type CloneEntityType = "agent" | "automation" | "pipeline";

interface CloneToOrgDialogProps {
  entityType: CloneEntityType;
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CloneResult {
  tenant_id: string;
  success: boolean;
  error?: string;
  new_id?: string;
  already_exists?: boolean;
  missing_integrations?: string[];
}

const TITLES: Record<CloneEntityType, string> = {
  agent: "שכפל את כרמן לארגון אחר",
  automation: "שכפל אוטומציה לארגון אחר",
  pipeline: "שכפל תהליך עבודה לארגון אחר",
};

const DESCRIPTIONS: Record<CloneEntityType, string> = {
  agent: "יצירת עותק עצמאי של הסוכן (נשמה, אישיות, מצב רוח, גישות) בארגונים שתבחר. בארגון שכבר יש בו סוכן — הקיים יישאר.",
  automation: "יצירת עותק עצמאי ומלא של האוטומציה וכל צמתיה בארגונים שתבחר. העותק נוצר כבוי — תפעיל אותו ידנית לאחר בדיקה.",
  pipeline: "יצירת עותק עצמאי של תהליך העבודה וכל השלבים בארגונים שתבחר. העותק נוצר כבוי.",
};

export function CloneToOrgDialog({ entityType, entityId, entityName, open, onOpenChange }: CloneToOrgDialogProps) {
  const { toast } = useToast();
  const { userId } = useCurrentUser();
  const { tenantId: sourceTenantId } = useCurrentTenant();
  const { userTenants, isLoading: tenantsLoading } = useUserTenants(userId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<CloneResult[] | null>(null);

  const tenantName = (id: string) =>
    (userTenants || []).find((t: any) => t.id === id)?.name || id;

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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleClone = async () => {
    if (selected.size === 0) return;
    setSubmitting(true);
    setResults(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("clone-entity-to-tenant", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: {
          entity_type: entityType,
          entity_id: entityId,
          target_tenant_ids: Array.from(selected),
        },
      });
      if (error) throw error;
      const res: CloneResult[] = (data as any)?.results || [];
      setResults(res);
      const ok = res.filter((r) => r.success).length;
      const failed = res.filter((r) => !r.success);
      toast({
        title: ok > 0 ? `שוכפל ל-${ok} ארגונים` : "השכפול נכשל",
        description: failed.length > 0 ? `נכשל ב-${failed.length}` : undefined,
        variant: ok === 0 ? "destructive" : "default",
      });
      if (ok > 0) setSelected(new Set());
    } catch (e: any) {
      toast({ title: "שגיאה בשכפול", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    setResults(null);
    setSelected(new Set());
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(o) : close())}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4" /> {TITLES[entityType]}
          </DialogTitle>
          <DialogDescription>
            שכפול "{entityName}". {DESCRIPTIONS[entityType]}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <ScrollArea className="max-h-80 rounded-md border">
            <div className="p-3 space-y-2">
              {results.map((r) => (
                <div key={r.tenant_id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    {r.success
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      : <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                    <span className="font-medium">{tenantName(r.tenant_id)}</span>
                    {r.already_exists && <Badge variant="secondary" className="text-[10px]">היה קיים</Badge>}
                  </div>
                  {!r.success && <p className="text-xs text-destructive mt-1">{r.error}</p>}
                  {r.success && r.missing_integrations && r.missing_integrations.length > 0 && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>חבר בארגון היעד לפני הפעלה: {r.missing_integrations.join(", ")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
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
                  <p className="text-sm text-muted-foreground text-center py-8">אין ארגונים זמינים</p>
                ) : (
                  availableTenants.map((t: any) => (
                    <label key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                      <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.slug && <p className="text-xs text-muted-foreground truncate">{t.slug}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            {results ? "סגור" : "ביטול"}
          </Button>
          {!results && (
            <Button onClick={handleClone} disabled={selected.size === 0 || submitting}>
              {submitting && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              שכפל ל-{selected.size} ארגונים
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
