import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface QuickTaskInputProps {
  onAddTask: (title: string) => void;
  disabled?: boolean;
}

export function QuickTaskInput({ onAddTask, disabled }: QuickTaskInputProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAddTask(title.trim());
      setTitle("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="משימה חדשה..."
        disabled={disabled}
        enterKeyHint="send"
        className="text-sm h-9 bg-background/50 border-dashed flex-1"
      />
      <Button 
        type="submit" 
        size="icon" 
        variant="outline"
        disabled={!title.trim() || disabled}
        className="h-9 w-9 shrink-0"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}
