import { useState } from "react";
import { useAgentGoals, useAgentGoalMutations, type AgentGoal } from "@/hooks/useAgentGoals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Plus, Target, Trash2, Pause, Play, Check } from "lucide-react";

const PRIORITY_LABELS: Record<string, string> = { high: "גבוהה", medium: "בינונית", low: "נמוכה" };
const PRIORITY_COLORS: Record<string, string> = { high: "destructive", medium: "default", low: "secondary" };
const STATUS_LABELS: Record<string, string> = { active: "פעילה", paused: "מושהית", done: "הושלמה" };

export function GoalsTab({ agentId }: { agentId: string }) {
  const { data: goals = [], isLoading } = useAgentGoals(agentId);
  const { create, update, remove } = useAgentGoalMutations(agentId);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const filtered = filter === "all" ? goals : goals.filter(g => g.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">מטרות הסוכן</h3>
        <div className="flex-1" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">הכל</SelectItem>
            <SelectItem value="active">פעילות</SelectItem>
            <SelectItem value="paused">מושהות</SelectItem>
            <SelectItem value="done">הושלמו</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 me-1" /> מטרה חדשה</Button>
          </DialogTrigger>
          <GoalDialog
            onSubmit={async (input) => { await create.mutateAsync(input); setOpen(false); }}
            submitting={create.isPending}
          />
        </Dialog>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">טוען...</p>}

      <div className="grid gap-2">
        {filtered.map(g => (
          <Card key={g.id} className="p-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">{g.title}</h4>
                  <Badge variant={PRIORITY_COLORS[g.priority] as any} className="text-[10px] h-4">
                    {PRIORITY_LABELS[g.priority]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4">{STATUS_LABELS[g.status]}</Badge>
                  {g.target_date && (
                    <span className="text-xs text-muted-foreground">יעד: {g.target_date}</span>
                  )}
                </div>
                {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
              </div>
              <div className="flex gap-1">
                {g.status !== "done" && (
                  <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: g.id, status: "done" })} title="סמן כהושלם">
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                {g.status === "active" ? (
                  <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: g.id, status: "paused" })} title="השהה">
                    <Pause className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: g.id, status: "active" })} title="הפעל">
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(g.id)} title="מחק">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">אין מטרות. צור את הראשונה</p>
        )}
      </div>
    </div>
  );
}

function GoalDialog({ onSubmit, submitting }: { onSubmit: (input: Partial<AgentGoal>) => Promise<void>; submitting: boolean }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [targetDate, setTargetDate] = useState("");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>מטרה חדשה</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>כותרת</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="מה הסוכן צריך להשיג?" />
        </div>
        <div>
          <Label>תיאור</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>עדיפות</Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">גבוהה</SelectItem>
                <SelectItem value="medium">בינונית</SelectItem>
                <SelectItem value="low">נמוכה</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>תאריך יעד</Label>
            <Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
          </div>
        </div>
        <Button
          onClick={() => onSubmit({ title, description, priority, target_date: targetDate || null })}
          disabled={!title || submitting}
          className="w-full"
        >
          {submitting ? "יוצר..." : "צור מטרה"}
        </Button>
      </div>
    </DialogContent>
  );
}
