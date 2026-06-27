import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Play,
  GitBranch,
  Timer,
  Bot,
  GitMerge,
  RotateCcw,
  Code2,
  AlertTriangle,
  SplitSquareHorizontal,
} from "lucide-react";
import { FlowNodeData } from "./FlowNode";
import { WhatsAppIcon } from "./nodeIcons";

interface AddStepMenuProps {
  onAdd: (stepType: FlowNodeData["step_type"]) => void;
  label?: string;
}

export function AddStepMenu({ onAdd, label }: AddStepMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          {label || "הוסף צעד"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" dir="rtl">

        {/* ── פעולות ── */}
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1">
          פעולות
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onAdd("action")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-blue-500/15 flex items-center justify-center shrink-0">
            <Play className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <span className="text-sm">פעולה</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("agent")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-orange-500/15 flex items-center justify-center shrink-0 overflow-hidden">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310419663030948028/XGJWpzb5zh76ZdoV37Q3K8/carmen-icon-CyF3DNNJ8Z9Uhfz7EpYJcQ.webp"
              alt="כרמן"
              className="w-full h-full object-cover rounded-md"
            />
          </div>
          <span className="text-sm">סוכן AI</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("whatsapp_session")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-green-500/15 flex items-center justify-center shrink-0">
            <WhatsAppIcon size={16} />
          </div>
          <span className="text-sm">שמור סשן שיחה</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── לוגיקה ── */}
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1">
          לוגיקה
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onAdd("condition")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-purple-500/15 flex items-center justify-center shrink-0">
            <GitBranch className="h-3.5 w-3.5 text-purple-500" />
          </div>
          <span className="text-sm">תנאי (IF)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("switch")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-indigo-500/15 flex items-center justify-center shrink-0">
            <SplitSquareHorizontal className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <span className="text-sm">מיתוג (Switch)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("merge")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-teal-500/15 flex items-center justify-center shrink-0">
            <GitMerge className="h-3.5 w-3.5 text-teal-500" />
          </div>
          <span className="text-sm">מיזוג (Merge)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("loop")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center shrink-0">
            <RotateCcw className="h-3.5 w-3.5 text-cyan-500" />
          </div>
          <span className="text-sm">לולאה (Loop)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("error_branch")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <span className="text-sm">טיפול בשגיאה</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── כלים ── */}
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-2 py-1">
          כלים
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => onAdd("delay")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
            <Timer className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <span className="text-sm">השהייה</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onAdd("code")}
          className="gap-2.5 cursor-pointer"
        >
          <div className="w-6 h-6 rounded-md bg-slate-500/15 flex items-center justify-center shrink-0">
            <Code2 className="h-3.5 w-3.5 text-slate-500" />
          </div>
          <span className="text-sm">קוד (Code)</span>
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
