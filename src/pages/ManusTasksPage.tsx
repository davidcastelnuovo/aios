import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brain, Plus, ExternalLink, RefreshCw, Loader2, Clock, CheckCircle, XCircle, Play } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'ממתין', color: 'bg-yellow-500', icon: Clock },
  running: { label: 'פועל', color: 'bg-blue-500', icon: Play },
  completed: { label: 'הושלם', color: 'bg-green-500', icon: CheckCircle },
  failed: { label: 'נכשל', color: 'bg-red-500', icon: XCircle },
};

export default function ManusTasksPage() {
  const { currentTenantId } = useTenant();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [agentProfile, setAgentProfile] = useState("manus-1.6");
  const [taskMode, setTaskMode] = useState("agent");
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['manus-tasks', currentTenantId],
    queryFn: async () => {
      if (!currentTenantId) return [];
      const { data, error } = await supabase
        .from('manus_tasks')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTenantId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenantId || !prompt.trim()) throw new Error("Missing data");
      const { data, error } = await supabase.functions.invoke('manus-api', {
        body: {
          action: 'create_task',
          tenantId: currentTenantId,
          prompt: prompt.trim(),
          agentProfile,
          taskMode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manus-tasks'] });
      toast.success("משימה נוצרה בהצלחה ב-Manus!");
      setPrompt("");
      setCreateOpen(false);
    },
    onError: (err: Error) => {
      toast.error(`שגיאה ביצירת משימה: ${err.message}`);
    },
  });

  const refreshTask = async (taskId: string) => {
    if (!currentTenantId) return;
    try {
      const { data, error } = await supabase.functions.invoke('manus-api', {
        body: { action: 'get_task', tenantId: currentTenantId, taskId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ['manus-tasks'] });
      toast.success("הסטטוס עודכן");
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`);
    }
  };

  const getOutputText = (output: any) => {
    if (!output || !Array.isArray(output)) return null;
    const texts: string[] = [];
    for (const item of output) {
      if (item.content && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === 'output_text' && c.text) texts.push(c.text);
        }
      }
    }
    return texts.length > 0 ? texts.join('\n\n') : null;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            משימות Manus
          </h1>
          <p className="text-muted-foreground mt-1">צור ונהל משימות AI מורכבות</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              משימה חדשה
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>יצירת משימה חדשה ב-Manus</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">תיאור המשימה</label>
                <Textarea
                  placeholder="תאר מה אתה רוצה ש-Manus יעשה..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">מודל</label>
                  <Select value={agentProfile} onValueChange={setAgentProfile}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manus-1.6">Manus 1.6</SelectItem>
                      <SelectItem value="manus-1.6-lite">Manus 1.6 Lite</SelectItem>
                      <SelectItem value="manus-1.6-max">Manus 1.6 Max</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">מצב</label>
                  <Select value={taskMode} onValueChange={setTaskMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="chat">Chat</SelectItem>
                      <SelectItem value="adaptive">Adaptive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate()}
                disabled={!prompt.trim() || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                צור משימה
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !tasks?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Brain className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">אין משימות עדיין</h3>
            <p className="text-muted-foreground mb-4">צור משימה חדשה כדי להתחיל להשתמש ב-Manus AI</p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 ml-2" />
              משימה חדשה
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map((task: any) => {
            const status = statusConfig[task.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            const outputText = getOutputText(task.output);

            return (
              <Card key={task.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <StatusIcon className={`h-4 w-4 ${task.status === 'completed' ? 'text-green-500' : task.status === 'failed' ? 'text-red-500' : task.status === 'running' ? 'text-blue-500' : 'text-yellow-500'}`} />
                        <h3 className="font-medium truncate">{task.title || task.prompt.substring(0, 80)}</h3>
                        <Badge variant="outline" className="text-xs">{status.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{task.prompt}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{format(new Date(task.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}</span>
                        {task.credit_usage && <span>קרדיטים: {task.credit_usage}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.status !== 'completed' && task.status !== 'failed' && (
                        <Button variant="ghost" size="icon" onClick={() => refreshTask(task.task_id)} title="רענן סטטוס">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {task.task_url && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={task.task_url} target="_blank" rel="noopener noreferrer" title="פתח ב-Manus">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {outputText && (
                        <Button variant="outline" size="sm" onClick={() => setSelectedTask(task)}>
                          צפה בתוצאות
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Results Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTask?.title || 'תוצאות משימה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-1">הנחיה:</p>
              <p className="text-sm text-muted-foreground">{selectedTask?.prompt}</p>
            </div>
            {selectedTask?.output && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                  {getOutputText(selectedTask.output) || JSON.stringify(selectedTask.output, null, 2)}
                </pre>
              </div>
            )}
            {selectedTask?.task_url && (
              <Button variant="outline" className="w-full" asChild>
                <a href={selectedTask.task_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 ml-2" />
                  פתח ב-Manus
                </a>
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
