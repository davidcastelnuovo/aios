import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Plus, Pencil, Copy, Loader2, Globe, Building2, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";

// One row of ai_skills as a "skin" (role-persona). Global skins are read-only
// for non-super-admins; a tenant can clone a global skin to an editable override
// on the same slug (the registry resolves tenant overrides over global).
interface Skin {
  id: string;
  slug: string;
  scope: string;
  name: string;
  description: string | null;
  goal: string | null;
  constraints: string | null;
  system_prompt: string | null;
  output_template: string | null;
  steps: string | null;
  allowed_tools: string[] | null;
  triggers: string[] | null;
  handoff_slugs: string[] | null;
  model: string | null;
  is_active: boolean;
  tenant_id: string | null;
  version: number | null;
}

const SKIN_FIELDS = "id,slug,scope,name,description,goal,constraints,system_prompt,output_template,steps,allowed_tools,triggers,handoff_slugs,model,is_active,tenant_id,version";

const toList = (v: string): string[] =>
  v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);

function SkinCard({ skin, onEdit, onClone }: { skin: Skin; onEdit: (s: Skin) => void; onClone: (s: Skin) => void }) {
  const isGlobal = skin.scope === "global";
  return (
    <Card className="p-4 space-y-2 text-right">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isGlobal ? (
            <Badge variant="secondary" className="gap-1 text-[10px]"><Globe className="h-3 w-3" />גלובלי</Badge>
          ) : (
            <Badge className="gap-1 text-[10px]"><Building2 className="h-3 w-3" />ארגון</Badge>
          )}
          {!skin.is_active && <Badge variant="outline" className="text-[10px] opacity-70">כבוי</Badge>}
          <code className="text-[10px] text-muted-foreground">{skin.slug}</code>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <span className="font-medium">{skin.name}</span>
        </div>
      </div>
      {skin.goal && <p className="text-xs text-muted-foreground">🎯 {skin.goal}</p>}
      {skin.description && <p className="text-xs text-muted-foreground">{skin.description}</p>}
      {skin.allowed_tools && skin.allowed_tools.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          <Wrench className="h-3 w-3 text-muted-foreground" />
          {skin.allowed_tools.slice(0, 8).map((t) => (
            <span key={t} className="text-[10px] bg-muted rounded px-1.5 py-0.5">{t}</span>
          ))}
        </div>
      )}
      {skin.triggers && skin.triggers.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          <Zap className="h-3 w-3 text-muted-foreground" />
          {skin.triggers.slice(0, 6).map((t) => (
            <span key={t} className="text-[10px] text-primary/80">#{t}</span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 justify-end pt-1">
        {isGlobal ? (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onClone(skin)}>
            <Copy className="h-3 w-3" />שכפל לעריכה
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onEdit(skin)}>
            <Pencil className="h-3 w-3" />ערוך
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function SkinsManager() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<Skin> | null>(null);

  const { data: skins, isLoading } = useQuery({
    queryKey: ["skins-manager", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_skills" as any)
        .select(SKIN_FIELDS)
        .or(tenantId ? `scope.eq.global,and(scope.eq.tenant,tenant_id.eq.${tenantId})` : "scope.eq.global")
        .order("scope", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data as any as Skin[]) || [];
    },
    enabled: !!tenantId,
  });

  const saveMutation = useMutation({
    mutationFn: async (s: Partial<Skin>) => {
      const payload: any = {
        name: s.name,
        description: s.description ?? null,
        goal: s.goal ?? null,
        constraints: s.constraints ?? null,
        system_prompt: s.system_prompt ?? null,
        output_template: s.output_template ?? null,
        steps: s.steps ?? null,
        allowed_tools: s.allowed_tools ?? [],
        triggers: s.triggers ?? [],
        handoff_slugs: s.handoff_slugs ?? [],
        model: s.model ?? null,
        is_active: s.is_active ?? true,
      };
      if (s.id) {
        const { error } = await supabase.from("ai_skills" as any).update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ai_skills" as any).insert({
          ...payload,
          slug: s.slug,
          scope: "tenant",
          tenant_id: tenantId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("הסקין נשמר");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["skins-manager", tenantId] });
    },
    onError: (e: any) => toast.error("שמירה נכשלה: " + (e?.message || e)),
  });

  const globals = (skins || []).filter((s) => s.scope === "global");
  const tenantSkins = (skins || []).filter((s) => s.scope === "tenant");

  // Clone a global skin into an editable tenant override (same slug).
  const cloneToTenant = (s: Skin) => {
    const exists = tenantSkins.some((t) => t.slug === s.slug);
    if (exists) {
      toast.info("כבר קיימת גרסת ארגון לסקין הזה — ערוך אותה למטה.");
      return;
    }
    setEditing({ ...s, id: undefined, scope: "tenant", tenant_id: tenantId });
  };

  const newSkin = () =>
    setEditing({ scope: "tenant", is_active: true, allowed_tools: [], triggers: [], handoff_slugs: [] });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between">
        <Button onClick={newSkin} className="gap-1.5"><Plus className="h-4 w-4" />סקין חדש</Button>
        <div className="text-right">
          <h1 className="text-2xl font-bold flex items-center gap-2 justify-end">
            <Sparkles className="h-6 w-6 text-orange-500" />סקינז
          </h1>
          <p className="text-sm text-muted-foreground">תפקידים שהסוכן לובש לפי המשימה — קופי, SEO, קמפיינר, כספים ועוד.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="space-y-6 pl-2">
            {tenantSkins.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-right flex items-center gap-1.5 justify-end">
                  <Building2 className="h-4 w-4" />סקינז של הארגון ({tenantSkins.length})
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {tenantSkins.map((s) => (
                    <SkinCard key={s.id} skin={s} onEdit={setEditing} onClone={cloneToTenant} />
                  ))}
                </div>
              </section>
            )}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-right flex items-center gap-1.5 justify-end">
                <Globe className="h-4 w-4" />קטלוג גלובלי ({globals.length})
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {globals.map((s) => (
                  <SkinCard key={s.id} skin={s} onEdit={setEditing} onClone={cloneToTenant} />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right">{editing?.id ? "עריכת סקין" : "סקין חדש"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 text-right">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>שם</Label>
                  <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="text-right" />
                </div>
                <div className="space-y-1">
                  <Label>slug (מזהה)</Label>
                  <Input value={editing.slug || ""} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="text-right font-mono text-sm" placeholder="campaigner" />
                </div>
              </div>
              <div className="space-y-1">
                <Label>תיאור (מתי להשתמש)</Label>
                <Input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="text-right" />
              </div>
              <div className="space-y-1">
                <Label>🎯 מטרה (goal)</Label>
                <Input value={editing.goal || ""} onChange={(e) => setEditing({ ...editing, goal: e.target.value })} className="text-right" />
              </div>
              <div className="space-y-1">
                <Label>זהות / system prompt</Label>
                <Textarea value={editing.system_prompt || ""} onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })} className="text-right min-h-[100px]" />
              </div>
              <div className="space-y-1">
                <Label>חוקים קשיחים (constraints)</Label>
                <Textarea value={editing.constraints || ""} onChange={(e) => setEditing({ ...editing, constraints: e.target.value })} className="text-right min-h-[60px]" placeholder="חוקים שטון/מצב רוח לעולם לא דורסים" />
              </div>
              <div className="space-y-1">
                <Label>פרוצדורה (steps)</Label>
                <Textarea value={editing.steps || ""} onChange={(e) => setEditing({ ...editing, steps: e.target.value })} className="text-right min-h-[80px]" />
              </div>
              <div className="space-y-1">
                <Label>פורמט פלט (output template)</Label>
                <Textarea value={editing.output_template || ""} onChange={(e) => setEditing({ ...editing, output_template: e.target.value })} className="text-right min-h-[60px]" />
              </div>
              <div className="space-y-1">
                <Label>כלים מותרים (מופרד בפסיק/שורה)</Label>
                <Textarea value={(editing.allowed_tools || []).join(", ")} onChange={(e) => setEditing({ ...editing, allowed_tools: toList(e.target.value) })} className="text-right min-h-[50px] font-mono text-sm" />
              </div>
              <div className="space-y-1">
                <Label>טריגרים (מילים שמפעילות את הסקין)</Label>
                <Textarea value={(editing.triggers || []).join(", ")} onChange={(e) => setEditing({ ...editing, triggers: toList(e.target.value) })} className="text-right min-h-[50px]" />
              </div>
              <div className="space-y-1">
                <Label>handoff — סקינז שאפשר להעביר אליהם (slugs)</Label>
                <Input value={(editing.handoff_slugs || []).join(", ")} onChange={(e) => setEditing({ ...editing, handoff_slugs: toList(e.target.value) })} className="text-right font-mono text-sm" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Label>פעיל</Label>
                <Switch checked={editing.is_active ?? true} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
            <Button
              onClick={() => editing && saveMutation.mutate(editing)}
              disabled={saveMutation.isPending || !editing?.name || !editing?.slug}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              שמור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
