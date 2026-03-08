import { memo } from "react";
import { Zap, Play, GitBranch, Timer, Bot, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FlowNodeData {
  id: string;
  step_type: "trigger" | "action" | "condition" | "delay" | "agent";
  action_type?: string;
  label?: string;
  configuration: Record<string, any>;
  position_x: number;
  position_y: number;
  sort_order: number;
  parent_step_id?: string | null;
  condition_branch?: string | null;
}

const STEP_TYPE_CONFIG = {
  trigger: {
    icon: Zap,
    label: "טריגר",
    bgClass: "bg-amber-500/10 border-amber-500/40",
    iconClass: "text-amber-500",
    headerClass: "bg-amber-500/20",
  },
  action: {
    icon: Play,
    label: "פעולה",
    bgClass: "bg-blue-500/10 border-blue-500/40",
    iconClass: "text-blue-500",
    headerClass: "bg-blue-500/20",
  },
  condition: {
    icon: GitBranch,
    label: "תנאי",
    bgClass: "bg-purple-500/10 border-purple-500/40",
    iconClass: "text-purple-500",
    headerClass: "bg-purple-500/20",
  },
  delay: {
    icon: Timer,
    label: "השהייה",
    bgClass: "bg-emerald-500/10 border-emerald-500/40",
    iconClass: "text-emerald-500",
    headerClass: "bg-emerald-500/20",
  },
  agent: {
    icon: Bot,
    label: "סוכן AI",
    bgClass: "bg-orange-500/10 border-orange-500/40",
    iconClass: "text-orange-500",
    headerClass: "bg-orange-500/20",
  },
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  send_whatsapp: "שלח WhatsApp (ManyChat)",
  send_greenapi_message: "שלח WhatsApp (Green API)",
  create_task: "צור משימה",
  add_lead_update: "הוסף עדכון לליד",
  add_client_update: "הוסף עדכון ללקוח",
  create_manychat_subscriber: "צור subscriber",
  update_status: "שנה סטטוס",
  webhook: "Webhook",
  email: "אימייל",
  notification: "התראה",
  // Triggers
  lead_created: "ליד נוצר",
  lead_status_changed: "סטטוס ליד השתנה",
  client_created: "לקוח נוצר",
  client_status_changed: "סטטוס לקוח השתנה",
  task_status_changed: "סטטוס משימה השתנה",
  task_assigned: "משימה שוייכה",
  meeting_created: "נוצרה פגישה",
  task_overdue: "משימה באיחור",
  inbound_webhook_task: "Webhook נכנס",
  manual_command: "פקודה ידנית (צ'אט)",
  whatsapp_message_received: "הודעת WhatsApp נכנסת",
};

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
  const config = STEP_TYPE_CONFIG[node.step_type];
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
      {/* Header */}
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

      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium truncate">
          {node.label || ACTION_TYPE_LABELS[node.action_type || ""] || "הגדר צעד"}
        </p>
        {node.action_type && !node.label && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {ACTION_TYPE_LABELS[node.action_type]}
          </p>
        )}
      </div>

      {/* Connection points */}
      {node.step_type !== "trigger" && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-muted border-2 border-border" />
      )}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-muted border-2 border-border" />
    </div>
  );
});
