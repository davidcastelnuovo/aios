import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useClientConnections } from "./lib/useClientConnections";
import { Loader2, Plus } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  stage_type: string;
  agent_id: string | null;
  approval_mode: "manual" | "auto" | "hybrid";
  configuration: any;
}

interface Props {
  stage: Stage | null;
  tenantId: string;
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}

const TOOLS_BY_STAGE: Record<string, { id: string; label: string }[]> = {
  strategy: [
    { id: "knowledge_base", label: "מאגר ידע" },
    { id: "web_search", label: "חיפוש אינטרנט" },
    { id: "competitive_analysis", label: "ניתוח מתחרים" },
  ],
  copy: [
    { id: "ai_text", label: "ייצור טקסט AI" },
    { id: "knowledge_base", label: "מאגר ידע" },
    { id: "web_search", label: "חיפוש אינטרנט" },
    { id: "translation", label: "תרגום" },
  ],
  creative: [
    { id: "image_gen", label: "ייצור תמונה" },
    { id: "video_gen", label: "ייצור וידאו" },
    { id: "image_edit", label: "עריכת תמונה" },
    { id: "stock_library", label: "ספריית סטוק" },
  ],
  target_paid: [
    { id: "meta_ads", label: "Meta Ads" },
    { id: "google_ads", label: "Google Ads" },
    { id: "tiktok_ads", label: "TikTok Ads" },
    { id: "campaign_publish", label: "פרסום קמפיין" },
  ],
  target_seo: [
    { id: "wordpress_publish", label: "פרסום ל-WordPress" },
    { id: "schema_markup", label: "Schema Markup" },
    { id: "internal_links", label: "קישורים פנימיים" },
    { id: "gsc_submit", label: "שליחה ל-GSC" },
  ],
  target_organic: [
    { id: "social_publish", label: "פרסום סושיאל" },
    { id: "social_schedule", label: "תזמון" },
    { id: "hashtag_research", label: "מחקר האשטגים" },
  ],
  measurement: [
    { id: "ga", label: "Google Analytics" },
    { id: "gsc", label: "Google Search Console" },
    { id: "meta_insights", label: "Meta Insights" },
    { id: "google_ads_reports", label: "Google Ads Reports" },
  ],
};

export function StageConfigDialog({ stage, tenantId, clientId, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [approvalMode, setApprovalMode] = useState<"manual" | "auto" | "hybrid">("manual");
  const [instructions, setInstructions] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const [target, setTarget] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const connections = useClientConnections(clientId);

  const { data: agents = [] } = useQuery({
    queryKey: ["ai-agents", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents")
        .select("id, name, personality")
        .eq("tenant_id", tenantId)
        .order("name");
      return data ?? [];
    },
    enabled: !!tenantId,
  });

  useEffect(() => {
    if (!stage) return;
    setName(stage.name ?? "");
    setAgentId(stage.agent_id ?? null);
    setApprovalMode(stage.approval_mode ?? "manual");
    const cfg = stage.configuration ?? {};
    setInstructions(cfg.instructions ?? "");
    setTools(cfg.tools ?? []);
    setTarget(cfg.target ?? {});
  }, [stage?.id]);

  if (!stage) return null;

  const stageTools = TOOLS_BY_STAGE[stage.stage_type] ?? [];

  const toggleTool = (id: string) => {
    setTools((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("marketing_pipeline_stages")
        .update({
          name,
          agent_id: agentId,
          approval_mode: approvalMode,
          configuration: { instructions, tools, target },
        })
        .eq("id", stage.id);
      if (error) throw error;
      toast.success("השלב נשמר");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error("שגיאה: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!stage} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>הגדרת שלב — {stage.name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="general">כללי</TabsTrigger>
            <TabsTrigger value="agent">אייג'נט</TabsTrigger>
            <TabsTrigger value="tools">כלים</TabsTrigger>
            <TabsTrigger value="target">יעד</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="space-y-3 pt-4">
            <div>
              <Label>שם השלב</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>מצב אישור</Label>
              <Select value={approvalMode} onValueChange={(v: any) => setApprovalMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">ידני — דרוש אישור אנושי</SelectItem>
                  <SelectItem value="auto">אוטומטי — האייג'נט מתקדם לבד</SelectItem>
                  <SelectItem value="hybrid">היברידי — אישור רק על מקרי קצה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>הוראות פתיחה לאייג'נט (System Prompt)</Label>
              <Textarea
                rows={6}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="לדוגמה: כתוב פוסט בסגנון של המותג, באורך 80-120 מילים, בנימה ידידותית..."
              />
            </div>
          </TabsContent>

          {/* AGENT */}
          <TabsContent value="agent" className="space-y-3 pt-4">
            <div>
              <Label>אייג'נט אחראי</Label>
              <Select value={agentId ?? "none"} onValueChange={(v) => setAgentId(v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="בחר אייג'נט" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא אייג'נט</SelectItem>
                  {agents.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agentId && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {agents.find((a: any) => a.id === agentId)?.description ?? ""}
                </p>
              )}
            </div>
          </TabsContent>

          {/* TOOLS */}
          <TabsContent value="tools" className="space-y-2 pt-4">
            <Label>כלים זמינים בשלב זה</Label>
            <div className="grid grid-cols-2 gap-2">
              {stageTools.map((t) => (
                <label key={t.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={tools.includes(t.id)} onCheckedChange={() => toggleTool(t.id)} />
                  <span className="text-sm">{t.label}</span>
                </label>
              ))}
            </div>
          </TabsContent>

          {/* TARGET */}
          <TabsContent value="target" className="space-y-3 pt-4">
            {connections.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> טוען חיבורים...
              </div>
            ) : (
              <TargetSection
                stageType={stage.stage_type}
                target={target}
                setTarget={setTarget}
                connections={connections.data}
                clientId={clientId}
                tenantId={tenantId}
                onConnectionsChanged={connections.invalidate}
              />
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>ביטול</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            שמור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetSection({
  stageType,
  target,
  setTarget,
  connections,
  clientId,
  tenantId,
  onConnectionsChanged,
}: {
  stageType: string;
  target: any;
  setTarget: (t: any) => void;
  connections: any;
  clientId: string;
  tenantId: string;
  onConnectionsChanged: () => void;
}) {
  if (!connections) return null;

  if (stageType === "target_organic") {
    const pages = connections.socialPages || [];
    const selected: string[] = target.page_ids ?? [];
    const togglePage = (id: string) =>
      setTarget({
        ...target,
        page_ids: selected.includes(id) ? selected.filter((p: string) => p !== id) : [...selected, id],
      });

    return (
      <div className="space-y-3">
        <div>
          <Label>עמודי סושיאל מחוברים</Label>
          {pages.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">אין עמודים מחוברים ללקוח. הוסף עמוד למטה.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {pages.map((p: any) => (
                <label key={p.id} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => togglePage(p.id)} />
                  <span className="text-sm font-medium">{p.page_name || p.page_id}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{p.platform}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <AddSocialPageInline clientId={clientId} tenantId={tenantId} onAdded={onConnectionsChanged} />
      </div>
    );
  }

  if (stageType === "target_seo") {
    const website = connections.client?.website || "";
    return (
      <div className="space-y-3">
        <Label>אתר היעד לפרסום (SEO/GEO)</Label>
        <div className="flex gap-2">
          <Input
            value={target.website ?? website}
            onChange={(e) => setTarget({ ...target, website: e.target.value })}
            placeholder="https://example.com"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            const url = target.website || website;
            if (!url) return;
            await supabase.from("clients").update({ website: url }).eq("id", clientId);
            toast.success("האתר נשמר בכרטיס הלקוח");
            onConnectionsChanged();
          }}
        >
          שמור כאתר ראשי בלקוח
        </Button>
        {connections.wpSites?.length > 0 && (
          <div className="mt-2">
            <Label>אתרי WordPress מחוברים</Label>
            <ul className="mt-1 text-sm text-muted-foreground list-disc list-inside">
              {connections.wpSites.map((s: any) => (
                <li key={s.id}>{s.site_name || s.site_url}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (stageType === "target_paid") {
    const c = connections.client;
    return (
      <div className="space-y-3">
        <div>
          <Label>חשבון Meta Ads</Label>
          <Input
            value={target.meta_ad_account ?? c?.meta_ads_account_id ?? ""}
            onChange={(e) => setTarget({ ...target, meta_ad_account: e.target.value })}
            placeholder="act_123456789"
          />
        </div>
        <div>
          <Label>חשבון Google Ads</Label>
          <Input
            value={target.google_ad_account ?? c?.google_ads_account_id ?? ""}
            onChange={(e) => setTarget({ ...target, google_ad_account: e.target.value })}
            placeholder="123-456-7890"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await supabase
              .from("clients")
              .update({
                meta_ads_account_id: target.meta_ad_account ?? c?.meta_ads_account_id,
                google_ads_account_id: target.google_ad_account ?? c?.google_ads_account_id,
              })
              .eq("id", clientId);
            toast.success("נשמר בכרטיס הלקוח");
            onConnectionsChanged();
          }}
        >
          שמור בכרטיס לקוח
        </Button>
      </div>
    );
  }

  return (
    <p className="text-sm text-muted-foreground">
      לשלב זה אין הגדרת יעד נדרשת — קונפיגורציה כללית בלבד.
    </p>
  );
}

function AddSocialPageInline({
  clientId,
  tenantId,
  onAdded,
}: {
  clientId: string;
  tenantId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("facebook");
  const [pageId, setPageId] = useState("");
  const [pageName, setPageName] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="ml-1 h-4 w-4" /> הוסף עמוד ידנית
      </Button>
    );
  }

  const save = async () => {
    if (!pageId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("social_pages").insert({
        client_id: clientId,
        tenant_id: tenantId,
        platform,
        page_id: pageId,
        page_name: pageName || null,
        is_active: true,
      });
      if (error) throw error;
      toast.success("העמוד נוסף");
      setPageId("");
      setPageName("");
      setOpen(false);
      onAdded();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Page ID" value={pageId} onChange={(e) => setPageId(e.target.value)} />
        <Input placeholder="שם העמוד" value={pageName} onChange={(e) => setPageName(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>ביטול</Button>
        <Button size="sm" onClick={save} disabled={saving}>שמור</Button>
      </div>
    </div>
  );
}
