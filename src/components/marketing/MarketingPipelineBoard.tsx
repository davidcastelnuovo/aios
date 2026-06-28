/**
 * MarketingPipelineBoard
 * ─────────────────────
 * Immersive "department" cards replacing the old narrow Kanban columns.
 * Each stage is a large visual entity with gradient banner, icon, agent info,
 * status bar, scrollable work items, and a "כנס למחלקה" CTA.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StageConfigDialog } from "./StageConfigDialog";
import { StageWorkspace } from "./StageWorkspace";
import {
  Lightbulb,
  PenLine,
  Image as ImageIcon,
  Megaphone,
  Search,
  Share2,
  BarChart3,
  Bot,
  CheckCircle2,
  Settings2,
  Plus,
  Play,
  Loader2,
  Zap,
  Clock,
  Hand,
  DoorOpen,
  ChevronLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Stage identity config ────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  string,
  {
    icon: any;
    label: string;
    gradient: string;
    dotColor: string;
    agentRole: string;
    emptyHint: string;
  }
> = {
  strategy: {
    icon: Lightbulb,
    label: "אסטרטגיה ובריף",
    gradient: "from-amber-600 to-amber-500",
    dotColor: "bg-amber-400",
    agentRole: "אסטרטגיסטית",
    emptyHint: "הוסף בריף ראשון",
  },
  copy: {
    icon: PenLine,
    label: "כתיבת תוכן",
    gradient: "from-sky-600 to-sky-500",
    dotColor: "bg-sky-400",
    agentRole: "קופירייטרית",
    emptyHint: "הוסף פריט תוכן",
  },
  creative: {
    icon: ImageIcon,
    label: "קריאייטיב",
    gradient: "from-fuchsia-600 to-fuchsia-500",
    dotColor: "bg-fuchsia-400",
    agentRole: "מעצבת",
    emptyHint: "הוסף נכס ויזואלי",
  },
  target_paid: {
    icon: Megaphone,
    label: "קמפיין ממומן",
    gradient: "from-rose-600 to-rose-500",
    dotColor: "bg-rose-400",
    agentRole: "קמפיינרית",
    emptyHint: "הוסף קמפיין",
  },
  target_seo: {
    icon: Search,
    label: "SEO / GEO",
    gradient: "from-emerald-600 to-emerald-500",
    dotColor: "bg-emerald-400",
    agentRole: "מומחית SEO",
    emptyHint: "הוסף מילות מפתח",
  },
  target_organic: {
    icon: Share2,
    label: "פרסום אורגני",
    gradient: "from-violet-600 to-violet-500",
    dotColor: "bg-violet-400",
    agentRole: "מנהלת סושיאל",
    emptyHint: "הוסף פוסט",
  },
  measurement: {
    icon: BarChart3,
    label: "מדידה ודיווח",
    gradient: "from-blue-600 to-blue-500",
    dotColor: "bg-blue-400",
    agentRole: "אנליסטית",
    emptyHint: "הוסף דוח",
  },
};

const APPROVAL_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  auto: { icon: Zap, label: "אוטומטי", color: "text-emerald-100 bg-emerald-700/40 border-emerald-300/30" },
  hybrid: { icon: Clock, label: "חצי אוטומטי", color: "text-amber-100 bg-amber-700/40 border-amber-300/30" },
  manual: { icon: Hand, label: "ידני", color: "text-gray-100 bg-gray-700/40 border-gray-300/30" },
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  awaiting_approval: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  in_progress: "בעבודה",
  awaiting_approval: "ממתין לאישור",
  completed: "הושלם",
  failed: "נכשל",
};

// ─── WorkItem card (compact, inside department) ───────────────────────────────
function WorkItemCard({
  item,
  stageId,
  onSelect,
  onRun,
  running,
}: {
  item: any;
  stageId: string;
  onSelect?: () => void;
  onRun: (stageId: string) => void;
  running: string | null;
}) {
  const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const imageUrl = item.payload?.image_url;

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:scale-[1.01]"
      onClick={onSelect}
      dir="rtl"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.title ?? ""}
          className="h-20 w-full rounded-t-xl object-cover"
        />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-medium leading-snug line-clamp-1">
            {item.title ?? "ללא כותרת"}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
              statusColor
            )}
          >
            {statusLabel}
          </span>
        </div>
        {item.scheduled_date && (
          <div className="mt-1 text-[11px] text-muted-foreground">
            📅 {new Date(item.scheduled_date).toLocaleDateString("he-IL")}
          </div>
        )}
        {item.payload?.copy_text && (
          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
            {item.payload.copy_text}
          </p>
        )}
      </div>
      {/* Hover run button */}
      <button
        className="absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/20"
        onClick={(e) => {
          e.stopPropagation();
          onRun(stageId);
        }}
        title="הרץ שלב זה"
      >
        {running === stageId ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ─── Status bar ───────────────────────────────────────────────────────────────
function StatusBar({ items }: { items: any[] }) {
  const running = items.filter((i) => i.status === "in_progress").length;
  const waiting = items.filter((i) => i.status === "awaiting_approval").length;
  const done = items.filter((i) => i.status === "completed").length;
  const draft = items.filter((i) => i.status === "draft").length;

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 border-b border-border/40 px-4 py-2 text-[11px]">
      {running > 0 && (
        <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          {running} רץ
        </span>
      )}
      {waiting > 0 && (
        <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">
          <Clock className="h-2.5 w-2.5" />
          {waiting} ממתין
        </span>
      )}
      {done > 0 && (
        <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {done} הושלם
        </span>
      )}
      {draft > 0 && (
        <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
          {draft} טיוטה
        </span>
      )}
      <span className="mr-auto text-muted-foreground">{items.length} פריטים</span>
    </div>
  );
}

// ─── Flow connector between cards ────────────────────────────────────────────
function FlowConnector({ hasRunning }: { hasRunning: boolean }) {
  return (
    <div className="flex items-center self-center shrink-0">
      <div className="h-px w-6 bg-border/60" />
      <div className="relative flex items-center">
        <ChevronLeft className="h-4 w-4 text-muted-foreground/40" />
        {hasRunning && (
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-blue-400 animate-ping opacity-75" />
        )}
      </div>
      <div className="h-px w-6 bg-border/60" />
    </div>
  );
}

// ─── Department Card ──────────────────────────────────────────────────────────
function DepartmentCard({
  stage,
  items,
  onOpenConfig,
  onOpenWorkspace,
  onNewItem,
  running,
  onRun,
}: {
  stage: any;
  items: any[];
  onOpenConfig: (stage: any) => void;
  onOpenWorkspace: (stage: any) => void;
  onNewItem: (stageId: string) => void;
  running: string | null;
  onRun: (stageId: string) => void;
}) {
  const cfg = STAGE_CONFIG[stage.stage_type] ?? STAGE_CONFIG.strategy;
  const Icon = cfg.icon;
  const approvalCfg = APPROVAL_CONFIG[stage.approval_mode] ?? APPROVAL_CONFIG.manual;
  const ApprovalIcon = approvalCfg.icon;

  return (
    <div
      className="flex h-full min-w-[320px] max-w-[360px] shrink-0 flex-col rounded-2xl border-2 border-border/50 bg-card/60 shadow backdrop-blur-sm transition-all hover:shadow-lg hover:border-primary/30"
      dir="rtl"
    >
      {/* Gradient banner */}
      <div className={cn("relative bg-gradient-to-br p-6 text-white rounded-t-2xl", cfg.gradient)} style={{ minHeight: 140 }}>
        <div className="absolute inset-0 bg-black/10 rounded-t-2xl" />
        {/* Settings button */}
        <button
          onClick={() => onOpenConfig(stage)}
          className="absolute top-3 left-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white z-10"
          title="הגדרות שלב"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>

        <div className="relative">
          <Icon className="h-16 w-16 opacity-90 mb-3" />
          <h2 className="text-xl font-bold leading-tight">{stage.name}</h2>
          <p className="text-sm opacity-80 mt-0.5 flex items-center gap-1">
            <Bot className="h-3.5 w-3.5 flex-shrink-0" />
            {stage.ai_agents?.name ?? "ללא סוכן"}
            {stage.ai_agents?.name && <span className="opacity-70">· {cfg.agentRole}</span>}
          </p>
          {/* Approval mode badge */}
          <span
            className={cn(
              "mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
              approvalCfg.color
            )}
          >
            <ApprovalIcon className="h-2.5 w-2.5" />
            {approvalCfg.label}
          </span>
        </div>
      </div>

      {/* Status summary bar */}
      <StatusBar items={items} />

      {/* Items list - scrollable */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            stageId={stage.id}
            onSelect={() => onOpenWorkspace(stage)}
            onRun={onRun}
            running={running}
          />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Icon className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-xs text-muted-foreground">אין פריטים בשלב זה</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">{cfg.emptyHint}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/40 space-y-2">
        <Button
          onClick={() => onOpenWorkspace(stage)}
          className="w-full gap-2"
          size="sm"
        >
          <DoorOpen className="h-4 w-4" />
          כנס למחלקה
        </Button>
        <button
          onClick={() => onNewItem(stage.id)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          הוסף פריט
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  pipelineId: string;
  tenantId: string;
  clientId: string;
  track: string;
}

export function MarketingPipelineBoard({
  pipelineId,
  tenantId,
  clientId,
  track,
}: Props) {
  const queryClient = useQueryClient();
  const [openStageId, setOpenStageId] = useState<string | null>(null);
  const [workspaceStage, setWorkspaceStage] = useState<any | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const { data: stages, refetch: refetchStages } = useQuery({
    queryKey: ["marketing-stages", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_pipeline_stages")
        .select("id, name, stage_type, sort_order, approval_mode, agent_id, configuration, ai_agents(id, name)")
        .eq("pipeline_id", pipelineId)
        .order("sort_order");
      if (error) {
        console.error("[MarketingPipelineBoard] stages query error:", error);
        throw error;
      }
      return data ?? [];
    },
  });

  const { data: items, refetch: refetchItems } = useQuery({
    queryKey: ["marketing-items", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id, title, status, current_stage_id, scheduled_date, payload")
        .eq("pipeline_id", pipelineId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("[MarketingPipelineBoard] items query error:", error);
      }
      return data ?? [];
    },
  });

  // Group items by current_stage_id
  const itemsByStage: Record<string, any[]> = {};
  (items ?? []).forEach((item: any) => {
    const sid = item.current_stage_id ?? "__unassigned__";
    (itemsByStage[sid] ??= []).push(item);
  });

  const openStage = (stages ?? []).find((s: any) => s.id === openStageId) ?? null;

  const handleNewItem = async (stageId: string) => {
    const { data, error } = await supabase
      .from("marketing_work_items")
      .insert({
        pipeline_id: pipelineId,
        tenant_id: tenantId,
        client_id: clientId,
        current_stage_id: stageId,
        title: "פריט תוכן חדש",
        status: "draft",
      })
      .select("id")
      .single();
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
      return;
    }
    refetchItems();
  };

  const handleRun = async (stageId: string) => {
    const stageItems = itemsByStage[stageId] ?? [];
    if (stageItems.length === 0) {
      toast({ title: "אין פריטים בשלב זה", description: "הוסף פריט תחילה", variant: "destructive" });
      return;
    }
    const item = stageItems[0];
    setRunning(stageId);
    try {
      const { error } = await supabase.functions.invoke("marketing-run-stage", {
        body: { item_id: item.id, stage_id: stageId },
      });
      if (error) throw error;
      toast({ title: "השלב הורץ בהצלחה" });
      refetchItems();
      queryClient.invalidateQueries({ queryKey: ["marketing-assets", item.id] });
    } catch (e: any) {
      toast({ title: "שגיאה בהרצה", description: e.message, variant: "destructive" });
    } finally {
      setRunning(null);
    }
  };

  const stageList = stages ?? [];

  return (
    <div className="flex h-full flex-col" dir="rtl">
      {/* Department cards with flow connectors */}
      <div className="flex flex-1 min-h-0 items-stretch gap-0 overflow-x-auto p-4">
        {stageList.map((stage: any, i: number) => {
          const stageItems = itemsByStage[stage.id] ?? [];
          const hasRunning = stageItems.some((item) => item.status === "in_progress");
          return (
            <div key={stage.id} className="flex items-stretch">
              {i > 0 && <FlowConnector hasRunning={hasRunning} />}
              <DepartmentCard
                stage={stage}
                items={stageItems}
                onOpenConfig={(s) => setOpenStageId(s.id)}
                onOpenWorkspace={(s) => setWorkspaceStage(s)}
                onNewItem={handleNewItem}
                running={running}
                onRun={handleRun}
              />
            </div>
          );
        })}
      </div>

      {/* Stage config dialog */}
      <StageConfigDialog
        stage={openStage as any}
        tenantId={tenantId}
        clientId={clientId}
        track={track}
        onClose={() => setOpenStageId(null)}
        onSaved={() => {
          refetchStages();
          queryClient.invalidateQueries({ queryKey: ["marketing-stages", pipelineId] });
        }}
      />

      {/* Stage workspace overlay */}
      {workspaceStage && (
        <StageWorkspace
          stage={workspaceStage}
          pipelineId={pipelineId}
          tenantId={tenantId}
          clientId={clientId}
          items={itemsByStage[workspaceStage.id] ?? []}
          onClose={() => setWorkspaceStage(null)}
          onSelectItem={() => {}}
          onNewItem={() => handleNewItem(workspaceStage.id)}
        />
      )}
    </div>
  );
}
