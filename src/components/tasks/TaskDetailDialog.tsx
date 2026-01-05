import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarIcon, Save, Trash2, UserPlus, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TimeSlotPicker } from "./TimeSlotPicker";

interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (taskId: string) => void;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onDelete,
}: TaskDetailDialogProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [priority, setPriority] = useState(task?.priority || 5);
  const [status, setStatus] = useState<"open" | "in_progress" | "done">(
    (task?.status as "open" | "in_progress" | "done") || "open"
  );
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task?.due_date ? new Date(task.due_date) : undefined
  );
  const [clientId, setClientId] = useState(task?.client_id || "");
  const [leadId, setLeadId] = useState(task?.lead_id || "");
  const [dueTime, setDueTime] = useState<string | null>(task?.due_time ? task.due_time.substring(0, 5) : null);
  const [newUpdate, setNewUpdate] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState("");

  // Reset form when task changes
  useState(() => {
    if (task) {
      setTitle(task.title);
      setNotes(task.notes || "");
      setPriority(task.priority);
      setStatus((task.status as "open" | "in_progress" | "done") || "open");
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setClientId(task.client_id || "");
      setLeadId(task.lead_id || "");
      setDueTime(task.due_time ? task.due_time.substring(0, 5) : null);
    }
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-tasks", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch leads
  const { data: leads } = useQuery({
    queryKey: ["leads-for-tasks", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, company_name")
        .eq("tenant_id", tenantId)
        .order("company_name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch campaigners for collaboration
  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-for-tasks", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .eq("active", true)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch collaborators
  const { data: collaborators } = useQuery({
    queryKey: ["task-collaborators", task?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_collaborators")
        .select("id, campaigner_id, campaigners(full_name)")
        .eq("task_id", task!.id);
      return data || [];
    },
    enabled: !!task?.id && open,
  });

  // Fetch updates
  const { data: updates } = useQuery({
    queryKey: ["task-updates", task?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("task_updates")
        .select("*, profiles(full_name)")
        .eq("task_id", task!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!task?.id && open,
  });

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          notes,
          priority,
          status,
          due_date: dueDate?.toISOString().split("T")[0] || null,
          due_time: dueTime ? dueTime + ":00" : null,
          client_id: clientId || null,
          lead_id: leadId || null,
        })
        .eq("id", task!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("המשימה עודכנה");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("שגיאה בעדכון המשימה");
    },
  });

  // Add collaborator mutation
  const addCollaborator = useMutation({
    mutationFn: async (campaignerId: string) => {
      const { error } = await supabase.from("task_collaborators").insert({
        task_id: task!.id,
        campaigner_id: campaignerId,
        tenant_id: tenantId,
        added_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-collaborators", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setSelectedCollaborator("");
      toast.success("איש צוות נוסף למשימה");
    },
    onError: () => {
      toast.error("שגיאה בהוספת איש צוות");
    },
  });

  // Remove collaborator mutation
  const removeCollaborator = useMutation({
    mutationFn: async (collaboratorId: string) => {
      const { error } = await supabase
        .from("task_collaborators")
        .delete()
        .eq("id", collaboratorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-collaborators", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("איש צוות הוסר מהמשימה");
    },
    onError: () => {
      toast.error("שגיאה בהסרת איש צוות");
    },
  });

  // Add update mutation
  const addUpdate = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_updates").insert({
        task_id: task!.id,
        content: newUpdate,
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-updates", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewUpdate("");
      toast.success("עדכון נוסף");
    },
    onError: () => {
      toast.error("שגיאה בהוספת עדכון");
    },
  });

  if (!task) return null;

  const availableCollaborators = campaigners?.filter(
    (c) =>
      c.id !== task.campaigner_id &&
      !collaborators?.some((col) => col.campaigner_id === c.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>פרטי משימה</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="details">פרטים</TabsTrigger>
            <TabsTrigger value="association">שיוך</TabsTrigger>
            <TabsTrigger value="team">צוות</TabsTrigger>
            <TabsTrigger value="updates">עדכונים</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-4 px-1">
              <div className="space-y-2">
                <Label>כותרת</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="כותרת המשימה"
                />
              </div>

              <div className="space-y-2">
                <Label>הערות</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הערות נוספות..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>תאריך יעד</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-right",
                          !dueDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {dueDate
                          ? format(dueDate, "dd/MM/yyyy", { locale: he })
                          : "בחר תאריך"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>שעת יעד</Label>
                  <TimeSlotPicker
                    value={dueTime}
                    onChange={setDueTime}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>סטטוס</Label>
                  <Select value={status} onValueChange={(val) => setStatus(val as "open" | "in_progress" | "done")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">פתוח</SelectItem>
                      <SelectItem value="in_progress">בתהליך</SelectItem>
                      <SelectItem value="done">הושלם</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>דחיפות: {priority}</Label>
                <Slider
                  value={[priority]}
                  onValueChange={([val]) => setPriority(val)}
                  min={1}
                  max={10}
                  step={1}
                  className="py-2"
                />
              </div>
            </TabsContent>

            {/* Association Tab */}
            <TabsContent value="association" className="space-y-4 px-1">
              <div className="space-y-2">
                <Label>לקוח (אופציונלי)</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="משימה כללית - ללא לקוח" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא - משימה כללית</SelectItem>
                    {clients?.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ליד (אופציונלי)</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger>
                    <SelectValue placeholder="ללא ליד" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא ליד</SelectItem>
                    {leads?.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* Team Tab */}
            <TabsContent value="team" className="space-y-4 px-1">
              <div className="space-y-2">
                <Label>הוסף איש צוות למשימה</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedCollaborator}
                    onValueChange={setSelectedCollaborator}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="בחר איש צוות" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCollaborators?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => addCollaborator.mutate(selectedCollaborator)}
                    disabled={!selectedCollaborator || addCollaborator.isPending}
                    size="icon"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>משתתפים במשימה</Label>
                <div className="flex flex-wrap gap-2">
                  {collaborators?.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      אין משתתפים נוספים
                    </p>
                  )}
                  {collaborators?.map((col) => (
                    <Badge
                      key={col.id}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {(col.campaigners as any)?.full_name}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:bg-destructive/20"
                        onClick={() => removeCollaborator.mutate(col.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Updates Tab */}
            <TabsContent value="updates" className="space-y-4 px-1">
              <div className="space-y-2">
                <Label>הוסף עדכון</Label>
                <div className="flex gap-2">
                  <Textarea
                    value={newUpdate}
                    onChange={(e) => setNewUpdate(e.target.value)}
                    placeholder="כתוב עדכון..."
                    rows={2}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => addUpdate.mutate()}
                    disabled={!newUpdate.trim() || addUpdate.isPending}
                    size="icon"
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {updates?.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    אין עדכונים עדיין
                  </p>
                )}
                {updates?.map((update) => (
                  <div
                    key={update.id}
                    className="p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {(update.profiles as any)?.full_name || "משתמש"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(update.created_at), "dd/MM HH:mm", {
                          locale: he,
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{update.content}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between pt-4 border-t mt-4">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete?.(task.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4 ml-2" />
            מחק
          </Button>
          <Button onClick={() => updateTask.mutate()} disabled={updateTask.isPending}>
            <Save className="h-4 w-4 ml-2" />
            שמור שינויים
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
