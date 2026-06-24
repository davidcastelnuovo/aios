import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Bot, Sparkles, ShieldCheck, Smile, Building2 } from "lucide-react";
import { toast } from "sonner";
import SkinsManager from "./SkinsManager";
import CarmenAccess from "./CarmenAccess";
import { CloneToOrgDialog } from "@/components/sharing/CloneToOrgDialog";

// Unified Carmen Studio — the separate "agent-building" module. One screen for
// who Carmen is (Core + mood), what she can use (Access), and the roles she
// wears (Skins). Deep-link routes /skins and /carmen-access still work.

const MOODS: { value: string; label: string }[] = [
  { value: "none", label: "רגיל (ללא)" },
  { value: "fun", label: "כיפי" },
  { value: "focused", label: "ממוקד" },
  { value: "tired", label: "עייף" },
  { value: "angry", label: "כועס" },
  { value: "random", label: "אקראי" },
];

function CoreTab() {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const [cloneOpen, setCloneOpen] = useState(false);

  const { data: agent, isLoading } = useQuery({
    queryKey: ["carmen-studio-core", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents" as any)
        .select("id,name,engine,personality,soul,talent,writing_style,response_length,language,mood,active")
        .eq("tenant_id", tenantId)
        .eq("active", true);
      const list = (data as any[]) || [];
      return list.find((a) => /כרמן|carmen/i.test(a.name || "")) || list[0] || null;
    },
    enabled: !!tenantId,
  });

  useEffect(() => { if (agent) setForm({ ...agent, mood: agent.mood ?? "none" }); }, [agent]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form?.id) throw new Error("לא נמצא סוכן");
      const { error } = await supabase
        .from("ai_agents" as any)
        .update({
          name: form.name,
          engine: form.engine,
          personality: form.personality,
          soul: form.soul,
          talent: form.talent,
          writing_style: form.writing_style,
          language: form.language,
          mood: form.mood === "none" ? null : form.mood,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("נשמר");
      queryClient.invalidateQueries({ queryKey: ["carmen-studio-core", tenantId] });
    },
    onError: (e: any) => toast.error("שמירה נכשלה: " + (e?.message || e)),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!form) return <div className="p-6 text-center text-muted-foreground">לא נמצא סוכן פעיל (כרמן).</div>;

  return (
    <div className="space-y-4 max-w-3xl mx-auto" dir="rtl">
      <Card className="p-4 space-y-3 text-right">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>שם</Label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-right" />
          </div>
          <div className="space-y-1">
            <Label>מנוע</Label>
            <Input value={form.engine || ""} onChange={(e) => setForm({ ...form, engine: e.target.value })} className="text-right font-mono text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>נשמה (soul)</Label>
          <Input value={form.soul || ""} onChange={(e) => setForm({ ...form, soul: e.target.value })} className="text-right" />
        </div>
        <div className="space-y-1">
          <Label>כישרון (talent)</Label>
          <Input value={form.talent || ""} onChange={(e) => setForm({ ...form, talent: e.target.value })} className="text-right" />
        </div>
        <div className="space-y-1">
          <Label>אישיות / הנחיות כלליות</Label>
          <Textarea value={form.personality || ""} onChange={(e) => setForm({ ...form, personality: e.target.value })} className="text-right min-h-[100px]" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="flex items-center gap-1 justify-end"><Smile className="h-3.5 w-3.5" />מצב רוח</Label>
            <Select value={form.mood || "none"} onValueChange={(v) => setForm({ ...form, mood: v })}>
              <SelectTrigger className="text-right"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">משפיע על הטון בלבד — לעולם לא דורס חוקים קשיחים.</p>
          </div>
          <div className="space-y-1">
            <Label>שפה</Label>
            <Input value={form.language || ""} onChange={(e) => setForm({ ...form, language: e.target.value })} className="text-right" placeholder="he" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>סגנון כתיבה</Label>
          <Input value={form.writing_style || ""} onChange={(e) => setForm({ ...form, writing_style: e.target.value })} className="text-right" />
        </div>
        <div className="flex justify-start gap-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            שמור
          </Button>
          <Button variant="outline" onClick={() => setCloneOpen(true)} className="gap-1.5">
            <Building2 className="h-4 w-4" />
            שכפל לארגון אחר
          </Button>
        </div>
      </Card>

      {form?.id && (
        <CloneToOrgDialog
          entityType="agent"
          entityId={form.id}
          entityName={form.name || "כרמן"}
          open={cloneOpen}
          onOpenChange={setCloneOpen}
        />
      )}
    </div>
  );
}

export default function CarmenStudio() {
  const [tab, setTab] = useState("core");
  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div className="text-right mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2 justify-end">
          <Bot className="h-6 w-6 text-purple-500" />Carmen Studio
        </h1>
        <p className="text-sm text-muted-foreground">בניית כרמן — מי היא, מה מותר לה, ואיזה תפקידים היא לובשת.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="core" className="gap-1.5"><Bot className="h-4 w-4" />כרמן</TabsTrigger>
          <TabsTrigger value="skins" className="gap-1.5"><Sparkles className="h-4 w-4" />סקינז</TabsTrigger>
          <TabsTrigger value="access" className="gap-1.5"><ShieldCheck className="h-4 w-4" />גישות</TabsTrigger>
        </TabsList>
        <TabsContent value="core"><CoreTab /></TabsContent>
        <TabsContent value="skins"><SkinsManager /></TabsContent>
        <TabsContent value="access"><CarmenAccess /></TabsContent>
      </Tabs>
    </div>
  );
}
