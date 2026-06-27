/**
 * GlobalStageSettings
 * ───────────────────
 * Tenant-level settings for each stage type across all tracks.
 * Manages marketing_stage_templates — the defaults applied when a new
 * pipeline is created for a client.
 *
 * Accessible from the MarketingDepartment header (gear icon).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  PenLine,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  BarChart3,
  Zap,
  Clock,
  Hand,
  Save,
  Bot,
  Settings2,
} from "lucide-react";

const STAGE_TYPES = [
  { type: "strategy", label: "בריף ואסטרטגיה", icon: Lightbulb, color: "text-amber-500" },
  { type: "copy", label: "כתיבת תוכן", icon: PenLine, color: "text-sky-500" },
  { type: "creative", label: "קריאייטיב", icon: ImageIcon, color: "text-fuchsia-500" },
  { type: "target_paid", label: "קמפיין ממומן", icon: Megaphone, color: "text-rose-500" },
  { type: "target_seo", label: "SEO / GEO", icon: Search, color: "text-emerald-500" },
  { type: "target_organic", label: "פרסום אורגני", icon: Share2, color: "text-violet-500" },
  { type: "measurement", label: "מדידה ודיווח", icon: BarChart3, color: "text-blue-500" },
];

const TRACKS = [
  { value: "campaigns", label: "קמפיינים" },
  { value: "seo_geo", label: "SEO / GEO" },
  { value: "social_organic", label: "סושיאל אורגני" },
];

const APPROVAL_OPTIONS = [
  { value: "auto", label: "אוטומטי לחלוטין", icon: Zap, desc: "פס הייצור רץ ללא עצירות" },
  { value: "hybrid", label: "חצי אוטומטי", icon: Clock, desc: "מחכה לאישור בין שלבים" },
  { value: "manual", label: "ידני", desc: "כל שלב מופעל ידנית", icon: Hand },
];

// ─── Stage Template Form ──────────────────────────────────────────────────────
function StageTemplateForm({
  stageType,
  track,
  tenantId,
  agents,
}: {
  stageType: string;
  track: string;
  tenantId: string;
  agents: any[];
}) {
  const queryClient = useQueryClient();
  const stageCfg = STAGE_TYPES.find((s) => s.type === stageType)!;
  const Icon = stageCfg.icon;

  const { data: template, refetch } = useQuery({
    queryKey: ["stage-template", tenantId, track, stageType],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_stage_templates")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("track", track)
        .eq("stage_type", stageType)
        .maybeSingle();
      return data;
    },
  });

  const [name, setName] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [approvalMode, setApprovalMode] = useState<string>("manual");
  const [instructions, setInstructions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Sync form when template loads
  useState(() => {
    if (template) {
      setName(template.name ?? stageCfg.label);
      setAgentId(template.default_agent_id ?? "");
      setApprovalMode(template.default_approval_mode ?? "manual");
      setInstructions(template.default_instructions ?? "");
    }
  });

  // Use template values as defaults when they exist
  const currentName = name || template?.name || stageCfg.label;
  const currentAgent = agentId || template?.default_agent_id || "";
  const currentApproval = approvalMode || template?.default_approval_mode || "manual";
  const currentInstructions = instructions || template?.default_instructions || "";

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        track,
        stage_type: stageType,
        name: currentName,
        default_agent_id: currentAgent || null,
        default_approval_mode: currentApproval,
        default_instructions: currentInstructions,
        updated_at: new Date().toISOString(),
      };

      if (template?.id) {
        const { error } = await supabase
          .from("marketing_stage_templates")
          .update(payload)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("marketing_stage_templates")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "ההגדרות נשמרו" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["stage-template", tenantId] });
    } catch (e: any) {
      toast({ title: "שגיאה", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 py-2" dir="rtl">
      {/* Stage identity header */}
      <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-background", stageCfg.color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{stageCfg.label}</div>
          <div className="text-[11px] text-muted-foreground">הגדרות ברירת מחדל לכל לקוח חדש</div>
        </div>
        {template && (
          <Badge variant="secondary" className="ms-auto text-[10px]">
            מוגדר
          </Badge>
        )}
      </div>

      {/* Name */}
      <div>
        <Label className="text-xs">שם השלב</Label>
        <Input
          value={currentName}
          onChange={(e) => setName(e.target.value)}
          placeholder={stageCfg.label}
          className="mt-1"
        />
      </div>

      {/* Agent */}
      <div>
        <Label className="text-xs flex items-center gap-1">
          <Bot className="h-3 w-3" />
          סוכן ברירת מחדל
        </Label>
        <Select value={currentAgent} onValueChange={setAgentId}>
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="בחר סוכן..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">ללא סוכן</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Approval mode */}
      <div>
        <Label className="text-xs">מצב אישור</Label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {APPROVAL_OPTIONS.map((opt) => {
            const OptIcon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setApprovalMode(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center transition-all",
                  currentApproval === opt.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border/60 hover:border-border hover:bg-muted/40"
                )}
              >
                <OptIcon className="h-4 w-4" />
                <span className="text-[11px] font-medium">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <Label className="text-xs">הוראות לסוכן (System Prompt)</Label>
        <Textarea
          value={currentInstructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="הוראות ספציפיות לסוכן עבור שלב זה..."
          rows={4}
          className="mt-1 text-sm"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          הוראות אלו יתווספו ל-System Prompt של הסוכן בכל הרצה של שלב זה.
        </p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? <><span className="animate-spin">⏳</span> שומר...</> : <><Save className="h-4 w-4" /> שמור הגדרות</>}
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
}

export function GlobalStageSettings({ open, onClose, tenantId }: Props) {
  const [activeTrack, setActiveTrack] = useState("campaigns");
  const [activeStage, setActiveStage] = useState("strategy");

  const { data: agents } = useQuery({
    queryKey: ["agents", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_agents")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            הגדרות גלובליות לפס הייצור
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            הגדרות אלו יחולו על כל לקוח חדש שנוצר. ניתן לדייק ברמת הלקוח בהגדרות השלב.
          </p>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 gap-4 mt-2">
          {/* Track + Stage sidebar */}
          <div className="w-52 shrink-0 space-y-3">
            {/* Track selector */}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                מסלול
              </div>
              <div className="space-y-1">
                {TRACKS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setActiveTrack(t.value)}
                    className={cn(
                      "w-full rounded-lg px-3 py-1.5 text-right text-sm transition-colors",
                      activeTrack === t.value
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted/60"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stage selector */}
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                שלב
              </div>
              <div className="space-y-1">
                {STAGE_TYPES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.type}
                      onClick={() => setActiveStage(s.type)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-sm transition-colors",
                        activeStage === s.type
                          ? "bg-muted font-medium"
                          : "hover:bg-muted/40"
                      )}
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", s.color)} />
                      <span className="truncate">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form panel */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            <StageTemplateForm
              key={`${activeTrack}-${activeStage}`}
              stageType={activeStage}
              track={activeTrack}
              tenantId={tenantId}
              agents={agents ?? []}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
