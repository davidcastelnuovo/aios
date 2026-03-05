import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Play, GitBranch, Timer, Bot } from "lucide-react";

interface AddStepMenuProps {
  onAdd: (stepType: "action" | "condition" | "delay" | "agent") => void;
}

export function AddStepMenu({ onAdd }: AddStepMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        <DropdownMenuItem onClick={() => onAdd("action")}>
          <Play className="h-4 w-4 ml-2 text-blue-500" />
          פעולה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("condition")}>
          <GitBranch className="h-4 w-4 ml-2 text-purple-500" />
          תנאי
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("delay")}>
          <Timer className="h-4 w-4 ml-2 text-emerald-500" />
          השהייה
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd("agent")}>
          <Bot className="h-4 w-4 ml-2 text-orange-500" />
          סוכן AI
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
