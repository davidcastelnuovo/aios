import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  Zap, Play, GitBranch, Timer, Bot, Trash2, MessageSquare,
  GitMerge, RotateCcw, Code2, AlertTriangle, SplitSquareHorizontal,
  GripVertical, Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getNodeIconConfig, NodeIconDisplay } from "./nodeIcons";

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

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 88;

// ─── Step type static config (for flow-logic types that don't have action_type) ─
const STEP_TYPE_STATIC: Record<
  string,
  { label: string; color: string; bgClass: string; headerClass: string; iconClass: string }
> = {
  trigger: {
    label: "טריגר",
    color: "#f59e0b",
    bgClass: "bg-amber-500/10 border-amber-500/40",
    headerClass: "bg-amber-500/20",
    iconClass: "text-amber-500",
  },
  action: {
    label: "פעולה",
    color: "#3b82f6",
    bgClass: "bg-blue-500/10 border-blue-500/40",
    headerClass: "bg-blue-500/20",
    iconClass: "text-blue-500",
  },
  condition: {
    label: "תנאי (IF)",
    color: "#a855f7",
    bgClass: "bg-purple-500/10 border-purple-500/40",
    headerClass: "bg-purple-500/20",
    iconClass: "text-purple-500",
  },
  switch: {
    label: "מיתוג (Switch)",
    color: "#6366f1",
    bgClass: "bg-indigo-500/10 border-indigo-500/40",
    headerClass: "bg-indigo-500/20",
    iconClass: "text-indigo-500",
  },
  delay: {
    label: "השהייה",
    color: "#10b981",
    bgClass: "bg-emerald-500/10 border-emerald-500/40",
    headerClass: "bg-emerald-500/20",
    iconClass: "text-emerald-500",
  },
  agent: {
    label: "סוכן AI",
    color: "#f97316",
    bgClass: "bg-orange-500/10 border-orange-500/40",
    headerClass: "bg-orange-500/20",
    iconClass: "text-orange-500",
  },
  whatsapp_session: {
    label: "סשן שיחה",
    color: "#16a34a",
    bgClass: "bg-green-600/10 border-green-600/40",
    headerClass: "bg-green-600/20",
    iconClass: "text-green-600",
  },
  merge: {
    label: "מיזוג (Merge)",
    color: "#14b8a6",
    bgClass: "bg-teal-500/10 border-teal-500/40",
    headerClass: "bg-teal-500/20",
    iconClass: "text-teal-500",
  },
  loop: {
    label: "לולאה (Loop)",
    color: "#06b6d4",
    bgClass: "bg-cyan-500/10 border-cyan-500/40",
    headerClass: "bg-cyan-500/20",
    iconClass: "text-cyan-500",
  },
  code: {
    label: "קוד (Code)",
    color: "#64748b",
    bgClass: "bg-slate-500/10 border-slate-500/40",
    headerClass: "bg-slate-500/20",
    iconClass: "text-slate-500",
  },
  error_branch: {
    label: "טיפול בשגיאה",
    color: "#ef4444",
    bgClass: "bg-red-500/10 border-red-500/40",
    headerClass: "bg-red-500/20",
    iconClass: "text-red-500",
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

  // Resolve icon config: prefer action_type-specific, fall back to step_type
  const iconConfig = getNodeIconConfig(nodeData.step_type, nodeData.action_type);
  const staticConfig = STEP_TYPE_STATIC[nodeData.step_type] || STEP_TYPE_STATIC.action;

  // For trigger/action nodes, use the action_type color; for flow-logic use static
  const isLogicNode = ["condition", "switch", "delay", "merge", "loop", "code", "error_branch"].includes(nodeData.step_type);
  const nodeColor = isLogicNode ? staticConfig.color : iconConfig.color;
  const nodeBgColor = isLogicNode ? staticConfig.bgClass : undefined;
  const nodeHeaderClass = isLogicNode ? staticConfig.headerClass : undefined;

  const switchBranches = nodeData.switch_branches?.length
    ? nodeData.switch_branches
    : ["ברירת מחדל"];

  const isMerge = nodeData.step_type === "merge";
  const mergeInputCount = nodeData.configuration?.input_count || 2;

  // Carmen image for agent nodes
  const carmenImageUrl =
    (nodeData.step_type === "agent" || nodeData.action_type === "agent")
      ? "https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-icon-CyF3DNNJ8Z9Uhfz7EpYJcQ.webp"
      : undefined;

  // Display label
  const displayLabel =
    nodeData.label ||
    ACTION_TYPE_LABELS[nodeData.action_type || ""] ||
    ACTION_TYPE_LABELS[nodeData.step_type] ||
    staticConfig.label ||
    "הגדר צעד";

  // Step type badge label
  const stepTypeBadge = staticConfig.label;

  return (
    <div
      className={cn(
        "w-[240px] rounded-xl border-2 shadow-lg cursor-pointer transition-all select-none relative overflow-hidden",
        isLogicNode ? nodeBgColor : "border-2",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      style={
        !isLogicNode
          ? {
              borderColor: iconConfig.borderColor,
              backgroundColor: iconConfig.bgColor,
            }
          : undefined
      }
      onClick={() => onSelect(nodeData.id)}
    >
      {/* ── Input handles ── */}
      {nodeData.step_type !== "trigger" && !isMerge && (
        <Handle
          type="target"
          position={Position.Top}
          id="input"
          style={{ background: nodeColor, width: 12, height: 12, border: "2px solid white" }}
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
                background: nodeColor,
                width: 12,
                height: 12,
                border: "2px solid white",
              }}
            />
          );
        })}

      {/* ── Header ── */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-t-[10px]",
          isLogicNode ? nodeHeaderClass : undefined
        )}
        style={
          !isLogicNode
            ? { backgroundColor: iconConfig.bgColor, borderBottom: `1px solid ${iconConfig.borderColor}` }
            : undefined
        }
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />

        {/* Icon: brand image or lucide */}
        <div className="shrink-0 flex items-center justify-center w-6 h-6">
          <NodeIconDisplay
            stepType={nodeData.step_type}
            actionType={nodeData.action_type}
            size={20}
            carmenImageUrl={carmenImageUrl}
          />
        </div>

        <span
          className="text-xs font-semibold flex-1 truncate"
          style={{ color: isLogicNode ? undefined : iconConfig.color }}
        >
          {stepTypeBadge}
        </span>

        {/* Disconnect button */}
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

        {/* Delete button */}
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
      </div>

      {/* ── Body ── */}
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-sm font-semibold truncate leading-tight">
          {displayLabel}
        </p>

        {/* Sub-info per step type */}
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

        {nodeData.step_type === "delay" && nodeData.configuration?.delay_value && (
          <p className="text-xs text-muted-foreground">
            {nodeData.configuration.delay_value} {nodeData.configuration.delay_unit || "דקות"}
          </p>
        )}

        {nodeData.step_type === "loop" && (
          <p className="text-xs text-muted-foreground">
            {nodeData.configuration?.loop_field
              ? `על: {{${nodeData.configuration.loop_field}}}`
              : "הגדר שדה לולאה"}
          </p>
        )}

        {nodeData.step_type === "code" && (
          <p className="text-xs text-muted-foreground font-mono truncate">
            {nodeData.configuration?.code
              ? nodeData.configuration.code.substring(0, 40) + "..."
              : "// כתוב קוד JavaScript"}
          </p>
        )}

        {isMerge && (
          <p className="text-xs text-muted-foreground">
            ממזג {mergeInputCount} נתיבים
          </p>
        )}

        {/* Agent skin badges */}
        {(nodeData.step_type === "agent" || nodeData.action_type === "agent") &&
          Array.isArray(nodeData.configuration?.skin_slugs) &&
          nodeData.configuration.skin_slugs.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {nodeData.configuration.skin_slugs.slice(0, 3).map((s: string) => (
                <span
                  key={s}
                  className="text-[9px] bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded px-1 font-medium"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

        {/* WhatsApp message preview */}
        {(nodeData.action_type === "send_whatsapp" ||
          nodeData.action_type === "send_greenapi_message" ||
          nodeData.action_type === "send_manus_message") &&
          nodeData.configuration?.message && (
            <p className="text-xs text-muted-foreground truncate">
              {String(nodeData.configuration.message).substring(0, 50)}
            </p>
          )}

        {/* Scheduled time preview */}
        {nodeData.action_type === "scheduled_daily" && nodeData.configuration?.hour !== undefined && (
          <p className="text-xs text-muted-foreground">
            {String(nodeData.configuration.hour).padStart(2, "0")}:{String(nodeData.configuration.minute ?? 0).padStart(2, "0")} בכל יום
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
                background: nodeColor,
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
          style={{ background: nodeColor, width: 12, height: 12, border: "2px solid white" }}
        />
      )}

      {/* default single output */}
      {!["condition", "switch", "loop", "error_branch", "merge"].includes(nodeData.step_type) && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="output"
          style={{ background: nodeColor, width: 12, height: 12, border: "2px solid white" }}
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
  const iconConfig = getNodeIconConfig(node.step_type, node.action_type);
  const staticConfig = STEP_TYPE_STATIC[node.step_type] || STEP_TYPE_STATIC.action;
  const isLogicNode = ["condition", "switch", "delay", "merge", "loop", "code", "error_branch"].includes(node.step_type);

  return (
    <div
      className={cn(
        "w-[240px] rounded-xl border-2 shadow-lg cursor-pointer transition-all select-none",
        isLogicNode ? staticConfig.bgClass : undefined,
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        isDragging && "opacity-70 scale-105 shadow-2xl"
      )}
      style={
        !isLogicNode
          ? { borderColor: iconConfig.borderColor, backgroundColor: iconConfig.bgColor }
          : undefined
      }
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div
        className={cn("flex items-center gap-2 px-3 py-2 rounded-t-[10px]", isLogicNode ? staticConfig.headerClass : undefined)}
        style={
          !isLogicNode
            ? { backgroundColor: iconConfig.bgColor, borderBottom: `1px solid ${iconConfig.borderColor}` }
            : undefined
        }
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          <NodeIconDisplay stepType={node.step_type} actionType={node.action_type} size={18} />
        </div>
        <span
          className="text-xs font-semibold flex-1 truncate"
          style={{ color: isLogicNode ? undefined : iconConfig.color }}
        >
          {staticConfig.label}
        </span>
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
        <p className="text-sm font-semibold truncate">
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
