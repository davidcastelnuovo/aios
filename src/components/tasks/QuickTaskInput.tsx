import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

interface QuickTaskInputProps {
  onAddTask: (title: string) => void;
  disabled?: boolean;
}

export function QuickTaskInput({ onAddTask, disabled }: QuickTaskInputProps) {
  const [title, setTitle] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && title.trim()) {
      onAddTask(title.trim());
      setTitle("");
    }
  };

  return (
    <div className="relative">
      <Plus className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="משימה חדשה + Enter"
        disabled={disabled}
        className="pr-9 text-sm h-9 bg-background/50 border-dashed"
      />
    </div>
  );
}
