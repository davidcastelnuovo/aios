import { useDraggable } from "@dnd-kit/core";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SitemapNode } from "../hooks/useSitemap";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  node: SitemapNode;
  cardId: string;
  onToggleVisibility?: () => void;
  onRename?: () => void;
};

export function ModuleCard({ node, cardId, onToggleVisibility, onRename }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardId,
    data: { type: "module", moduleKey: node.module.key },
  });
  const Icon = node.module.icon;
  const label = node.customLabel || node.module.label;

  return (
    <div
      ref={setNodeRef}
      data-module-key={node.module.key}
      className={cn(
        "group relative flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-xs shadow-sm transition-all",
        "hover:border-primary/60 hover:shadow-md",
        node.hidden && "opacity-50 border-dashed",
        isDragging && "opacity-30 ring-2 ring-primary",
      )}
      style={{ width: 148, minHeight: 36 }}
      dir="rtl"
    >
      <span
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onDoubleClick={onRename}
            className="flex-1 truncate text-right font-medium hover:underline"
          >
            {label}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="font-semibold">{label}</div>
          <div className="text-muted-foreground">{node.module.route}</div>
          {node.children.length > 0 && (
            <div className="mt-1 text-muted-foreground">
              {node.children.length} תתי-מודולים
            </div>
          )}
        </TooltipContent>
      </Tooltip>
      <button
        onClick={onToggleVisibility}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
        title={node.hidden ? "הצג בתפריט" : "הסתר מהתפריט"}
      >
        {node.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}
