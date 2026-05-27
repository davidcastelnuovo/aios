import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Zap, Play, GitBranch, Timer, Bot, Trash2, MessageSquare,
  GitMerge, RotateCcw, Code2, AlertTriangle, SplitSquareHorizontal,
  GripVertical,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FlowNodeData {
  id: string;
  step_type:
    | "trigger"
    | "action"
    | "condition"
    | "switch"
    | "delay"
    | "agent"
    | "whatsapp_session"
    | "merge"
    | "loop"
    | "code"
    | "error_branch";
  action_type?: string;
  label?: string;
  configuration: Record<string, any>;
  position_x: number;
  position_y: number;
  sort_order: number;
  parent_step_id?: string | null;
  condition_branch?: string | null;
  switch_branches?: string[];
}

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 80;

const STEP_TYPE_CONFIG: Record<
  string,
  { icon: any; label: string; bgClass: string; iconClass: string; headerClass: string; color: string }
> = {
  trigger: {
    icon: Zap,
    label: "טריגר",
    bgClass: "bg-amber-500/10 border-amber-500/40",
    iconClass: "text-amber-500",
    headerClass: "bg-amber-500/20",
    color: "#f59e0b",
  },
  action: {
    icon: Play,
    label: "פעולה",
    bgClass: "bg-blue-500/10 border-blue-500/40",
    iconClass: "text-blue-500",
    headerClass: "bg-blue-500/20",
    color: "#3b82f6",
  },
  condition: {
    icon: GitBranch,
    label: "תנאי (IF)",
    bgClass: "bg-purple-500/10 border-purple-500/40",
    iconClass: "text-purple-500",
    headerClass: "bg-purple-500/20",
    color: "#a855f7",
  },
  switch: {
    icon: SplitSquareHorizontal,
    label: "מיתוג (Switch)",
    bgClass: "bg-indigo-500/10 border-indigo-500/40",
    iconClass: "text-indigo-500",
    headerClass: "bg-indigo-500/20",
    color: "#6366f1",
  },
  delay: {
    icon: Timer,
    label: "השהייה",
    bgClass: "bg-emerald-500/10 border-emerald-500/40",
    iconClass: "text-emerald-500",
    headerClass: "bg-emerald-500/20",
    color: "#10b981",
  },
  agent: {
    icon: Bot,
    label: "סוכן AI",
    bgClass: "bg-orange-500/10 border-orange-500/40",
    iconClass: "text-orange-500",
    headerClass: "bg-orange-500/20",
    color: "#f97316",
  },
  whatsapp_session: {
    icon: MessageSquare,
    label: "סשן שיחה",
    bgClass: "bg-green-600/10 border-green-600/40",
    iconClass: "text-green-600",
    headerClass: "bg-green-600/20",
    color: "#16a34a",
  },
  merge: {
    icon: GitMerge,
    label: "מיזוג (Merge)",
    bgClass: "bg-teal-500/10 border-teal-500/40",
    iconClass: "text-teal-500",
    headerClass: "bg-teal-500/20",
    color: "#14b8a6",
  },
  loop: {
    icon: RotateCcw,
    label: "לולאה (Loop)",
    bgClass: "bg-cyan-500/10 border-cyan-500/40",
    iconClass: "text-cyan-500",
    headerClass: "bg-cyan-500/20",
    color: "#06b6d4",
  },
  code: {
    icon: Code2,
    label: "קוד (Code)",
    bgClass: "bg-slate-500/10 border-slate-500/40",
    iconClass: "text-slate-500",
    headerClass: "bg-slate-500/20",
    color: "#64748b",
  },
  error_branch: {
    icon: AlertTriangle,
    label: "טיפול בשגיאה",
    bgClass: "bg-red-500/10 border-red-500/40",
    iconClass: "text-red-500",
    headerClass: "bg-red-500/20",
    color: "#ef4444",
  },
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  // פעולות
  whatsapp_session: "שמור סשן שיחה",
  send_whatsapp: "שלח WhatsApp (ManyChat)",
  send_greenapi_message: "שלח WhatsApp (Green API)",
  send_manus_message: "שלח WhatsApp (Manus)",
  send_greenapi_to_campaigner: "שלח WhatsApp ל-Campaigner",
  send_telegram: "שלח הודעת Telegram",
  create_task: "צור משימה",
  add_lead_update: "הוסף עדכון לליד",
  add_client_update: "הוסף עדכון ללקוח",
  create_manychat_subscriber: "צור subscriber",
  update_status: "שנה סטאטוס",
  webhook: "Webhook",
  email: "אימייל",
  notification: "התראה",
  create_lead: "צור ליד",
  agent: "סוכן AI",
  // טריגרים – לידים
  lead_created: "ליד נוצר",
  lead_updated: "ליד עודכן",
  lead_status_changed: "סטאטוס ליד השתנה",
  lead_note_added: "הערה נוספה לליד",
  lead_inactive_days: "ליד לא פעיל X ימים",
  // טריגרים – לקוחות
  client_created: "לקוח נוצר",
  client_status_changed: "סטאטוס לקוח השתנה",
  client_note_added: "הערה נוספה ללקוח",
  // טריגרים – משימות
  task_created: "משימה נוצרה",
  task_status_changed: "סטאטוס משימה השתנה",
  task_completed: "משימה הושלמה",
  task_assigned: "משימה שוייכה",
  task_overdue: "משימה באיחור",
  // טריגרים – פגישות
  meeting_created: "פגישה נוצרה",
  meeting_updated: "פגישה עודכנה",
  meeting_cancelled: "פגישה בוטלה",
  // טריגרים – הודעות
  whatsapp_message_received: "הודעת WhatsApp נכנסת",
  carmen_whatsapp_session: "שיחת כרמן ב-WhatsApp",
  telegram_message_received: "הודעת טלגרם נכנסת",
  email_received: "אימייל נכנס (Gmail)",
  // טריגרים – Google Workspace
  google_sheet_new_row: "שורה חדשה ב-Google Sheets",
  google_sheet_row_updated: "שורה עודכנה ב-Google Sheets",
  google_calendar_event_created: "אירוע חדש ב-Google Calendar",
  google_form_submitted: "טופס Google Forms נשלח",
  // טריגרים – לוח זמנים
  scheduled_daily: "טריגר יומי",
  scheduled_weekly: "טריגר שבועי",
  scheduled_monthly: "טריגר חודשי",
  // טריגרים – אינטגרציות
  inbound_webhook_task: "Webhook נכנס",
  facebook_lead_form: "טופס ליד פייסבוק",
  instagram_message: "הודעת אינסטגרם",
  typeform_submitted: "Typeform נשלח",
  stripe_payment: "תשלום Stripe",
  // טריגרים – צ'אט
  manual_command: "פקודה ידנית (צ'אט)",
};

// ─── React Flow custom node component ─────────────────────────────────────────

interface RFNodeData {
  nodeData: FlowNodeData;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onDisconnect?: (id: string) => void;
}

export const FlowNodeRF = memo(function FlowNodeRF({
  data,
  selected,
}: {
  data: RFNodeData;
  selected?: boolean;
}) {
  const { nodeData, onDelete, onSelect, onDisconnect } = data;
  const config = STEP_TYPE_CONFIG[nodeData.step_type] || STEP_TYPE_CONFIG.action;
  const Icon = config.icon;

  const switchBranches = nodeData.switch_branches?.length
    ? nodeData.switch_branches
    : ["ברירת מחדל"];

  const isMerge = nodeData.step_type === "merge";
  const mergeInputCount = nodeData.configuration?.input_count || 2;

  return (
    <div
      className={cn(
        "w-[220px] rounded-xl border-2 shadow-lg cursor-pointer transition-all select-none relative",
        config.bgClass,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      onClick={() => onSelect(nodeData.id)}
    >
      {/* ── Input handles ── */}
      {nodeData.step_type !== "trigger" && !isMerge && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          style={{ background: config.color, width: 12, height: 12, border: "2px solid white" }}
        />
      )}
      {isMerge &&
        Array.from({ length: mergeInputCount }).map((_, i) => {
          const leftPct = ((i + 1) / (mergeInputCount + 1)) * 100;
          return (
            <Handle
              key={i}
              type="target"
              position={Position.Top}
              id={`merge_in_${i}`}
              style={{
                left: `${leftPct}%`,
                background: config.color,
                width: 12,
                height: 12,
                border: "2px solid white",
              }}
            />
          );
        })}

      {/* ── Header ── */}
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-[10px]", config.headerClass)}>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
        <Icon className={cn("h-4 w-4", config.iconClass)} />
        <span className="text-xs font-semibold flex-1 truncate">{config.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-destructive/20"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(nodeData.id);
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
        {nodeData.step_type !== "trigger" && nodeData.parent_step_id && onDisconnect && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 hover:bg-orange-500/20"
            title="נתק שלב"
            onClick={(e) => {
              e.stopPropagation();
              onDisconnect(nodeData.id);
            }}
          >
            <Unlink className="h-3 w-3 text-orange-500" />
          </Button>
        )}
      </div>

      {/* ── Body ── */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium truncate">
          {nodeData.label ||
            ACTION_TYPE_LABELS[nodeData.action_type || ""] ||
            ACTION_TYPE_LABELS[nodeData.step_type] ||
            "הגדר צעד"}
        </p>

        {nodeData.step_type === "switch" && (
          <div className="flex flex-wrap gap-1 mt-1">
            {switchBranches.map((b, i) => (
              <span
                key={i}
                className="text-[10px] bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 rounded px-1"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {nodeData.step_type === "loop" && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {nodeData.configuration?.loop_field
              ? `על: {{${nodeData.configuration.loop_field}}}`
              : "הגדר שדה לולאה"}
          </p>
        )}

        {nodeData.step_type === "code" && (
          <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
            {nodeData.configuration?.code
              ? nodeData.configuration.code.substring(0, 40) + "..."
              : "// כתוב קוד JavaScript"}
          </p>
        )}

        {isMerge && (
          <p className="text-xs text-muted-foreground mt-0.5">
            ממזג {mergeInputCount} נתיבים
          </p>
        )}
      </div>

      {/* ── Output handles ── */}

      {/* condition: כן / לא */}
      {nodeData.step_type === "condition" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="true"
            style={{ left: "30%", background: "#22c55e", width: 12, height: 12, border: "2px solid white" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="false"
            style={{ left: "70%", background: "#ef4444", width: 12, height: 12, border: "2px solid white" }}
          />
          <div className="absolute -bottom-5 left-[18%] text-[10px] text-green-600 font-bold pointer-events-none">כן</div>
          <div className="absolute -bottom-5 left-[62%] text-[10px] text-red-500 font-bold pointer-events-none">לא</div>
        </>
      )}

      {/* switch: dynamic branches */}
      {nodeData.step_type === "switch" &&
        switchBranches.map((branch, i) => {
          const total = switchBranches.length;
          const leftPct = ((i + 1) / (total + 1)) * 100;
          return (
            <Handle
              key={branch}
              type="source"
              position={Position.Bottom}
              id={`branch_${branch}`}
              style={{
                left: `${leftPct}%`,
                background: config.color,
                width: 12,
                height: 12,
                border: "2px solid white",
              }}
            />
          );
        })}

      {/* loop: איטרציה / סיום */}
      {nodeData.step_type === "loop" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="loop_body"
            style={{ left: "30%", background: "#06b6d4", width: 12, height: 12, border: "2px solid white" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="loop_done"
            style={{ left: "70%", background: "#10b981", width: 12, height: 12, border: "2px solid white" }}
          />
          <div className="absolute -bottom-5 left-[14%] text-[10px] text-cyan-600 font-bold pointer-events-none">איטרציה</div>
          <div className="absolute -bottom-5 left-[60%] text-[10px] text-emerald-600 font-bold pointer-events-none">סיום</div>
        </>
      )}

      {/* error_branch: הצלחה / שגיאה */}
      {nodeData.step_type === "error_branch" && (
        <>
          <Handle
            type="source"
            position={Position.Bottom}
            id="success"
            style={{ left: "30%", background: "#22c55e", width: 12, height: 12, border: "2px solid white" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="error"
            style={{ left: "70%", background: "#ef4444", width: 12, height: 12, border: "2px solid white" }}
          />
          <div className="absolute -bottom-5 left-[14%] text-[10px] text-green-600 font-bold pointer-events-none">הצלחה</div>
          <div className="absolute -bottom-5 left-[60%] text-[10px] text-red-500 font-bold pointer-events-none">שגיאה</div>
        </>
      )}

      {/* merge: single output */}
      {isMerge && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          style={{ background: config.color, width: 12, height: 12, border: "2px solid white" }}
        />
      )}

      {/* default single output */}
      {!["condition", "switch", "loop", "error_branch", "merge"].includes(nodeData.step_type) && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          style={{ background: config.color, width: 12, height: 12, border: "2px solid white" }}
        />
      )}
    </div>
  );
});

// ─── Legacy non-RF node (kept for backward compat) ────────────────────────────
interface FlowNodeProps {
  node: FlowNodeData;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export const FlowNode = memo(function FlowNode({
  node,
  isSelected,
  onClick,
  onDelete,
  isDragging,
}: FlowNodeProps) {
  const config = STEP_TYPE_CONFIG[node.step_type] || STEP_TYPE_CONFIG.action;
  const Icon = config.icon;
  return (
    <div
      className={cn(
        "w-[220px] rounded-xl border-2 shadow-lg cursor-pointer transition-all select-none",
        config.bgClass,
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isDragging && "opacity-70 scale-105 shadow-2xl"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className={cn("flex items-center gap-2 px-3 py-2 rounded-t-[10px]", config.headerClass)}>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
        <Icon className={cn("h-4 w-4", config.iconClass)} />
        <span className="text-xs font-semibold flex-1 truncate">{config.label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 hover:bg-destructive/20"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium truncate">
          {node.label ||
            ACTION_TYPE_LABELS[node.action_type || ""] ||
            ACTION_TYPE_LABELS[node.step_type] ||
            "הגדר צעד"}
        </p>
      </div>
      {node.step_type !== "trigger" && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-muted border-2 border-border" />
      )}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-muted border-2 border-border" />
    </div>
  );
});
