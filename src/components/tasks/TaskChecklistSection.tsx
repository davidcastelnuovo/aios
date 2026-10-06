import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TaskChecklistSectionProps {
  taskId: string;
  tenantId: string;
  className?: string;
}

type ChecklistItem = {
  id: string;
  title: string;
  is_done: boolean;
  sort_order: number;
};

export function TaskChecklistSection({ taskId, tenantId, className }: TaskChecklistSectionProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklist_items")
        .select("id, title, is_done, sort_order")
        .eq("task_id", taskId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ChecklistItem[];
    },
    enabled: Boolean(taskId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["task-checklist", taskId] });
  };

  const addItem = useMutation({
    mutationFn: async (title: string) => {
      const { error } = await supabase.from("task_checklist_items").insert({
        task_id: taskId,
        tenant_id: tenantId,
        title,
        sort_order: items.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      invalidate();
    },
    onError: () => toast.error("שגיאה בהוספת תת-משימה"),
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, isDone }: { id: string; isDone: boolean }) => {
      const { error } = await supabase
        .from("task_checklist_items")
        .update({ is_done: isDone, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, isDone }) => {
      await queryClient.cancelQueries({ queryKey: ["task-checklist", taskId] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(["task-checklist", taskId]);
      queryClient.setQueryData<ChecklistItem[]>(["task-checklist", taskId], (old = []) =>
        old.map((item) => (item.id === id ? { ...item, is_done: isDone } : item)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["task-checklist", taskId], context.previous);
      }
      toast.error("שגיאה בעדכון תת-משימה");
    },
    onSettled: invalidate,
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("שגיאה במחיקת תת-משימה"),
  });

  const doneCount = items.filter((item) => item.is_done).length;

  return (
    <section className={cn("rounded-xl border border-border/60 bg-card shadow-sm p-3 space-y-2 text-right", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          תתי משימות
        </div>
        {items.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        )}
      </div>

      <div className="space-y-1">
        {isLoading && (
          <p className="text-xs text-muted-foreground py-1">טוען...</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
            <Checkbox
              checked={item.is_done}
              onCheckedChange={(checked) =>
                toggleItem.mutate({ id: item.id, isDone: Boolean(checked) })
              }
            />
            <span
              className={cn(
                "flex-1 text-sm",
                item.is_done && "line-through text-muted-foreground",
              )}
            >
              {item.title}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem.mutate(item.id)}
              aria-label="מחק תת-משימה"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {!isLoading && items.length === 0 && (
          <p className="text-xs text-muted-foreground py-1">
            הוסף צ׳קליסט כמו גוגל אנליטיקס / Search Console / Tag Manager
          </p>
        )}
      </div>

      <form
        className="flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const title = draft.trim();
          if (!title) return;
          addItem.mutate(title);
        }}
      >
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="תת-משימה חדשה..."
          className="h-8 text-xs"
        />
        <Button
          type="submit"
          size="icon"
          className="h-8 w-8 shrink-0"
          disabled={!draft.trim() || addItem.isPending}
          aria-label="הוסף תת-משימה"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
