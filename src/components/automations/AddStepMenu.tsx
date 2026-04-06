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
  MessageSquare,
  GitMerge,
  RotateCcw,
  Code2,
  AlertTriangle,
  SplitSquareHorizontal,
} from "lucide-react";
import { FlowNodeData } from "./FlowNode";

interface AddStepMenuProps {
  onAdd: (stepType: FlowNodeData["step_type"]) => void;
}

export function AddStepMenu({ onAdd }: AddStepMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          הוסף צעד
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">

        {/* ── פעולות ── */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">פעולות</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd("action")}>
          <Play className="h-4 w-4 ml-2 text-blue-500" />
          פעולה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("agent")}>
          <Bot className="h-4 w-4 ml-2 text-orange-500" />
          סוכן AI
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("whatsapp_session")}>
          <MessageSquare className="h-4 w-4 ml-2 text-green-600" />
          שמור סשן שיחה
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── לוגיקה ── */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">לוגיקה</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd("condition")}>
          <GitBranch className="h-4 w-4 ml-2 text-purple-500" />
          תנאי (IF)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("switch")}>
          <SplitSquareHorizontal className="h-4 w-4 ml-2 text-indigo-500" />
          מיתוג (Switch)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("merge")}>
          <GitMerge className="h-4 w-4 ml-2 text-teal-500" />
          מיזוג (Merge)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("loop")}>
          <RotateCcw className="h-4 w-4 ml-2 text-cyan-500" />
          לולאה (Loop)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("error_branch")}>
          <AlertTriangle className="h-4 w-4 ml-2 text-red-500" />
          טיפול בשגיאה
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── כלים ── */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">כלים</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd("delay")}>
          <Timer className="h-4 w-4 ml-2 text-emerald-500" />
          השהייה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("code")}>
          <Code2 className="h-4 w-4 ml-2 text-slate-500" />
          קוד (Code)
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
