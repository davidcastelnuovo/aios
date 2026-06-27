/**
 * MarketingPipelineBoard
 * ─────────────────────
 * Replaces the ReactFlow canvas with a rich, horizontal Kanban-style pipeline.
 * Each stage is a "department card" with:
 *   - Color-coded header with icon + department name
 *   - Agent avatar + name
 *   - Approval mode badge
 *   - List of work items in that stage (clickable cards)
 *   - Quick-run button per item
 *   - "New item" shortcut
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
  ChevronRight,
  Zap,
  Clock,
  Hand,
  ArrowLeft,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─── Stage identity config ────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  string,
  {
    icon: any;
    label: string;
    color: string;
    headerBg: string;
    dotColor: string;
    agentRole: string;
  }
> = {
  strategy: {
    icon: Lightbulb,
    label: "אסטרטגיה ובריף",
    color: "border-amber-400/60",
    headerBg: "bg-gradient-to-l from-amber-500/20 to-amber-500/5",
    dotColor: "bg-amber-400",
    agentRole: "אסטרטגיסטית",
  },
  copy: {
    icon: PenLine,
    label: "כתיבת תוכן",
    color: "border-sky-400/60",
    headerBg: "bg-gradient-to-l from-sky-500/20 to-sky-500/5",
    dotColor: "bg-sky-400",
    agentRole: "קופירייטרית",
  },
  creative: {
    icon: ImageIcon,
    label: "קריאייטיב",
    color: "border-fuchsia-400/60",
    headerBg: "bg-gradient-to-l from-fuchsia-500/20 to-fuchsia-500/5",
    dotColor: "bg-fuchsia-400",
    agentRole: "מעצבת",
  },
  target_paid: {
    icon: Megaphone,
    label: "קמפיין ממומן",
    color: "border-rose-400/60",
    headerBg: "bg-gradient-to-l from-rose-500/20 to-rose-500/5",
    dotColor: "bg-rose-400",
    agentRole: "קמפיינרית",
  },
  target_seo: {
    icon: Search,
    label: "SEO / GEO",
    color: "border-emerald-400/60",
    headerBg: "bg-gradient-to-l from-emerald-500/20 to-emerald-500/5",
    dotColor: "bg-emerald-400",
    agentRole: "מומחית SEO",
  },
  target_organic: {
    icon: Share2,
    label: "פרסום אורגני",
    color: "border-violet-400/60",
    headerBg: "bg-gradient-to-l from-violet-500/20 to-violet-500/5",
    dotColor: "bg-violet-400",
    agentRole: "מנהלת סושיאל",
  },
  measurement: {
    icon: BarChart3,
    label: "מדידה ודיווח",
    color: "border-blue-400/60",
    headerBg: "bg-gradient-to-l from-blue-500/20 to-blue-500/5",
    dotColor: "bg-blue-400",
    agentRole: "אנליסטית",
  },
};

const APPROVAL_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  auto: { icon: Zap, label: "אוטומטי", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  hybrid: { icon: Clock, label: "חצי אוטומטי", color: "text-amber-600 bg-amber-50 border-amber-200" },
  manual: { icon: Hand, label: "ידני", color: "text-gray-600 bg-gray-50 border-gray-200" },
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

// ─── WorkItem mini-card ───────────────────────────────────────────────────────
function WorkItemCard({
  item,
  stageId,
  onSelect,
  onRun,
  running,
}: {
  item: any;
  stageId: string;
  onSelect: () => void;
  onRun: (stageId: string) => void;
  running: string | null;
}) {
  const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.draft;
  const statusLabel = STATUS_LABELS[item.status] ?? item.status;
  const imageUrl = item.payload?.image_url;

  return (
    <div
      className="group relative cursor-pointer rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:shadow-md hover:border-border"
      onClick={onSelect}
      dir="rtl"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.title ?? ""}
          className="h-28 w-full rounded-t-xl object-cover"
        />
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-medium leading-snug line-clamp-2">
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
          <div className="mt-1.5 text-[11px] text-muted-foreground">
            📅 {new Date(item.scheduled_date).toLocaleDateString("he-IL")}
          </div>
        )}
        {item.payload?.copy_text && (
          <p className="mt-1.5 line-clamp-2 text-[11px] text-muted-foreground">
            {item.payload.copy_text}
          </p>
        )}
      </div>
      {/* Quick run button */}
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

// ─── Stage Department Column ──────────────────────────────────────────────────
function StageColumn({
  stage,
  items,
  tenantId,
  clientId,
  track,
  onSelectItem,
  onOpenConfig,
  onOpenWorkspace,
  onNewItem,
  running,
  onRun,
}: {
  stage: any;
  items: any[];
  tenantId: string;
  clientId: string;
  track: string;
  onSelectItem: (id: string) => void;
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
  const awaitingCount = items.filter((i) => i.status === "awaiting_approval").length;
  const runningCount = items.filter((i) => i.status === "in_progress").length;
  const completedCount = items.filter((i) => i.status === "completed").length;

  return (
    <div
      className={cn(
        "flex h-full w-72 shrink-0 flex-col rounded-2xl border-2 bg-card/60 shadow-sm backdrop-blur-sm",
        cfg.color
      )}
      dir="rtl"
    >
      {/* Column header */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-t-2xl px-3 py-3",
          cfg.headerBg
        )}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/70 shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold truncate">{stage.name}</span>
            {awaitingCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white" title="ממתין לאישור">
                {awaitingCount}
              </span>
            )}
            {runningCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white animate-pulse" title="רץ עכשיו">
                {runningCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Bot className="h-3 w-3" />
            <span>{stage.ai_agents?.name ?? "ללא סוכן"}</span>
            {stage.ai_agents?.name && (
              <span className="opacity-60">· {cfg.agentRole}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onOpenWorkspace(stage)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            title="פתח מחלקה"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onOpenConfig(stage)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
            title="הגדרות שלב"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Approval mode + item count bar */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-1.5">
        <span
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            approvalCfg.color
          )}
        >
          <ApprovalIcon className="h-2.5 w-2.5" />
          {approvalCfg.label}
        </span>
        <div className="ms-auto flex items-center gap-1.5">
          {runningCount > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              {runningCount}
            </span>
          )}
          {awaitingCount > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
              <Clock className="h-2.5 w-2.5" />
              {awaitingCount}
            </span>
          )}
          {completedCount > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {completedCount}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{items.length}</span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map((item) => (
          <WorkItemCard
            key={item.id}
            item={item}
            stageId={stage.id}
            onSelect={() => onSelectItem(item.id)}
            onRun={onRun}
            running={running}
          />
        ))}
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="mb-2 h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center">
              <Icon className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground">אין פריטים בשלב זה</p>
          </div>
        )}
      </div>

      {/* Add item footer */}
      <div className="border-t border-border/40 p-2">
        <button
          onClick={() => onNewItem(stage.id)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
  onSelectItem: (id: string) => void;
}

export function MarketingPipelineBoard({
  pipelineId,
  tenantId,
  clientId,
  track,
  onSelectItem,
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
        .select("id, name, stage_type, sort_order, approval_mode, agent_id, system_prompt")
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
    onSelectItem(data.id);
  };

  const handleRun = async (stageId: string) => {
    // Find first item in this stage
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

  return (
    <div className="flex h-full flex-col" dir="rtl">
      {/* Pipeline flow indicator */}
      <div className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground border-b bg-muted/20">
        <span className="font-medium text-foreground">פס ייצור:</span>
        {(stages ?? []).map((s: any, i: number) => {
          const cfg = STAGE_CONFIG[s.stage_type];
          const Icon = cfg?.icon ?? Lightbulb;
          return (
            <span key={s.id} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-40" />}
              <span className="flex items-center gap-0.5">
                <Icon className="h-3 w-3" />
                {s.name}
              </span>
            </span>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex flex-1 min-h-0 gap-3 overflow-x-auto p-4">
        {(stages ?? []).map((stage: any) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            items={itemsByStage[stage.id] ?? []}
            tenantId={tenantId}
            clientId={clientId}
            track={track}
            onSelectItem={onSelectItem}
            onOpenConfig={(s) => setOpenStageId(s.id)}
            onOpenWorkspace={(s) => setWorkspaceStage(s)}
            onNewItem={handleNewItem}
            running={running}
            onRun={handleRun}
          />
        ))}
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
          onSelectItem={onSelectItem}
          onNewItem={() => handleNewItem(workspaceStage.id)}
        />
      )}
    </div>
  );
}
