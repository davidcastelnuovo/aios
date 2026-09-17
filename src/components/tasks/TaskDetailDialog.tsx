import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { CalendarIcon, Save, Trash2, UserPlus, UserRound, X, Send, Search, ListTodo, ExternalLink, Check, Bot, GitCommit, ArrowRightLeft, MessageCircle, Link2, Users, Building2, Megaphone, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import { useCrossTenantAgencyIds } from "@/hooks/useCrossTenantAgencyIds";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";
import { NotesWithAttachments, type TaskAttachment } from "./NotesWithAttachments";
import { fetchActiveCampaigners } from "@/lib/taskCampaigners";
import { syncTaskCalendarEvent } from "@/lib/calendarApi";
import { coerceHumanTaskStatus } from "@/lib/taskStatus";

const DURATION_OPTIONS = [30, 60, 90, 120, 150, 180] as const;
const FRAME = "rounded-xl border border-border/60 bg-card shadow-sm text-right";

function isUsableDate(value: Date | undefined): value is Date {
  return Boolean(value) && !Number.isNaN(value.getTime());
}

function parseOptionalDate(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function personInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("") || "?";
}

interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  target_date?: string | null;
  client_id: string | null;
  lead_id: string | null;
  agency_id: string | null;
  campaigner_id: string | null;
  tenant_id: string | null;
  created_by?: string | null;
  created_at?: string;
  creator_name?: string | null;
  self_reminder_at?: string | null;
  google_calendar_event_id?: string | null;
  duration_minutes?: number | null;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete?: (taskId: string) => void;
  onMoveToBacklog?: (taskId: string) => void;
  /** Inline pane (tasks chat view) instead of a modal dialog. */
  variant?: "dialog" | "panel";
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onDelete,
  onMoveToBacklog,
  variant = "dialog",
}: TaskDetailDialogProps) {
  const isPanel = variant === "panel";
  const isActive = isPanel ? !!task?.id : open;
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const { campaignerId: userCampaignerId } = useUserRole();
  
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState(5);
  const [status, setStatus] = useState<"open" | "in_progress" | "done">("open");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [clientId, setClientId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [newUpdate, setNewUpdate] = useState("");
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  
  // Search states for comboboxes
  const [clientSearch, setClientSearch] = useState("");
  const [campaignerSearch, setCampaignerSearch] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [campaignerDropdownOpen, setCampaignerDropdownOpen] = useState(false);
  const [leadDropdownOpen, setLeadDropdownOpen] = useState(false);
  const [assignedCampaignerId, setAssignedCampaignerId] = useState("");
  const [selfReminderEnabled, setSelfReminderEnabled] = useState(false);
  const [selfReminderAt, setSelfReminderAt] = useState("");
  const [viewLeadOpen, setViewLeadOpen] = useState(false);
  const [googleCalendarEventId, setGoogleCalendarEventId] = useState<string | null>(null);
  const [creatorName, setCreatorName] = useState("");

  // Fetch full lead data for viewing
  const { data: fullLeadData } = useQuery({
    queryKey: ["lead-detail-for-task", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!leadId && isActive,
  });

  // Reset form when task changes or dialog opens
  useEffect(() => {
    if (task && isActive) {
      // Refetch fresh task data from DB to ensure we have latest
      const loadFreshTask = async () => {
        const { data: freshTask } = await supabase
          .from("tasks")
          .select("*")
          .eq("id", task.id)
          .single();
        const t = freshTask || task;
        setTitle(t.title);
        setNotes(t.notes || "");
        setPriority(t.priority);
        setStatus(coerceHumanTaskStatus(t.status));
        setDueDate(parseOptionalDate(t.due_date));
        setTargetDate(parseOptionalDate(t.target_date));
        setClientId(t.client_id || "");
        setLeadId(t.lead_id || "");
        setDueTime(t.due_time ? (t.due_time as string).substring(0, 5) : null);
        const rawDuration = Number((t as { duration_minutes?: number }).duration_minutes) || 30;
        setDurationMinutes((DURATION_OPTIONS as readonly number[]).includes(rawDuration) ? rawDuration : 30);
        setAssignedCampaignerId(t.campaigner_id || "");
        setSelfReminderEnabled(Boolean(t.self_reminder_at));
        const reminderAt = parseOptionalDate(t.self_reminder_at);
        setSelfReminderAt(reminderAt ? format(reminderAt, "yyyy-MM-dd'T'HH:mm") : "");
        setAttachments(Array.isArray((t as any).attachments) ? (t as any).attachments : []);
        setGoogleCalendarEventId((t as any).google_calendar_event_id || null);
        const knownCreatorName = (t as any).creator_name || "";
        if (knownCreatorName) {
          setCreatorName(knownCreatorName);
        } else if ((t as any).created_by) {
          const { data: creator } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", (t as any).created_by)
            .maybeSingle();
          setCreatorName(creator?.full_name || "");
        } else {
          setCreatorName("");
        }
        setClientSearch("");
        setCampaignerSearch("");
        setLeadSearch("");
      };
      loadFreshTask();
    }
  }, [task, isActive]);

  const { crossTenantAgencyIds } = useCrossTenantAgencyIds();

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-tasks", tenantId, crossTenantAgencyIds],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name");
      if (crossTenantAgencyIds.length > 0) {
        query = query.or(`tenant_id.eq.${tenantId},agency_id.in.(${crossTenantAgencyIds.join(",")})`);
      } else {
        query = query.eq("tenant_id", tenantId);
      }
      const { data } = await query.order("name");
      return data || [];
    },
    enabled: !!tenantId && isActive,
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
    enabled: !!tenantId && isActive,
  });

  // Fetch campaigners for collaboration
  const { data: campaigners } = useQuery({
    queryKey: ["campaigners-for-tasks", tenantId, crossTenantAgencyIds.join(",")],
    queryFn: () => fetchActiveCampaigners(tenantId!, crossTenantAgencyIds),
    enabled: !!tenantId && isActive,
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
    enabled: !!task?.id && isActive,
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
    enabled: !!task?.id && isActive,
  });

  // Filter clients based on search
  const filteredClients = useMemo(() => {
    if (!clients) return [];
    if (!clientSearch.trim()) return clients;
    return clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase())
    );
  }, [clients, clientSearch]);

  // Filter campaigners based on search
  const filteredCampaigners = useMemo(() => {
    if (!campaigners) return [];
    if (!campaignerSearch.trim()) return campaigners;
    return campaigners.filter(c => 
      c.full_name.toLowerCase().includes(campaignerSearch.toLowerCase())
    );
  }, [campaigners, campaignerSearch]);

  // Filter leads based on search
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    if (!leadSearch.trim()) return leads;
    return leads.filter(l => 
      l.company_name?.toLowerCase().includes(leadSearch.toLowerCase())
    );
  }, [leads, leadSearch]);

  // Get selected client name
  const selectedClientName = useMemo(() => {
    if (!clientId) return "";
    return clients?.find(c => c.id === clientId)?.name || "";
  }, [clients, clientId]);

  // Get assigned campaigner name
  const assignedCampaignerName = useMemo(() => {
    if (!assignedCampaignerId) return "";
    return campaigners?.find(c => c.id === assignedCampaignerId)?.full_name || "";
  }, [campaigners, assignedCampaignerId]);

  // Get selected lead name
  const selectedLeadName = useMemo(() => {
    if (!leadId) return "";
    return leads?.find(l => l.id === leadId)?.company_name || "";
  }, [leads, leadId]);

  // Update task mutation
  const updateTask = useMutation({
    mutationFn: async () => {
      if (selfReminderEnabled && assignedCampaignerId === userCampaignerId && !selfReminderAt) {
        throw new Error("יש לבחור תאריך ושעה לתזכורת");
      }
      const nextDueDate = isUsableDate(dueDate) ? format(dueDate, "yyyy-MM-dd") : null;
      const nextTargetDate = isUsableDate(targetDate) ? format(targetDate, "yyyy-MM-dd") : null;
      const nextDueTime = dueTime ? dueTime + ":00" : null;
      const { error } = await supabase
        .from("tasks")
        .update({
          title,
          notes,
          priority,
          status,
          due_date: nextDueDate,
          due_time: nextDueTime,
          target_date: nextTargetDate,
          duration_minutes: durationMinutes,
          client_id: clientId || null,
          lead_id: leadId || null,
          campaigner_id: assignedCampaignerId || null,
          self_reminder_at:
            assignedCampaignerId === userCampaignerId && selfReminderEnabled && selfReminderAt
              ? new Date(selfReminderAt).toISOString()
              : null,
          attachments: attachments as any,
        })
        .eq("id", task!.id);
      if (error) throw error;

      if (tenantId) {
        try {
          const eventId = await syncTaskCalendarEvent({
            tenantId,
            title,
            dueDate: nextDueDate,
            dueTime: nextDueTime,
            durationMinutes,
            existingEventId: googleCalendarEventId,
          });
          if ((eventId ?? null) !== (googleCalendarEventId ?? null)) {
            await supabase
              .from("tasks")
              .update({ google_calendar_event_id: eventId })
              .eq("id", task!.id);
          }
        } catch (calendarError) {
          console.warn("לא הצלחנו לעדכן ביומן גוגל:", calendarError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["client-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["campaigner-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["lead-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-events-weekly"] });
      toast.success("המשימה עודכנה");
      if (!isPanel) onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון המשימה: ${error.message}`);
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
      queryClient.invalidateQueries({ queryKey: ["tasks", tenantId] });
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
      queryClient.invalidateQueries({ queryKey: ["tasks", tenantId] });
      toast.success("איש צוות הוסר מהמשימה");
    },
    onError: () => {
      toast.error("שגיאה בהסרת איש צוות");
    },
  });

  // Add update mutation
  const addUpdate = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not authenticated");
      const { error } = await supabase.from("task_updates").insert({
        task_id: task!.id,
        content: newUpdate,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-updates", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["tasks", tenantId] });
      setNewUpdate("");
      toast.success("עדכון נוסף");
    },
    onError: (error: any) => {
      console.error("Error adding task update:", error);
      toast.error("שגיאה בהוספת עדכון: " + (error?.message || ""));
    },
  });

  if (!task) {
    if (isPanel) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground text-sm bg-muted/20">
          בחר משימה מהרשימה כדי לראות פרטים, דחיפות ועדכונים
        </div>
      );
    }
    return null;
  }

  const availableCollaborators = campaigners?.filter(
    (c) =>
      c.id !== task.campaigner_id &&
      !collaborators?.some((col) => col.campaigner_id === c.id)
  );

  const assignmentSearch = (
    open: boolean,
    setOpen: (v: boolean) => void,
    search: string,
    setSearch: (v: string) => void,
    placeholder: string,
    options: { id: string; name: string }[],
    onPick: (id: string) => void,
  ) => (
    <div className="relative flex-1 min-w-0">
      <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="h-7 pr-7 bg-card text-xs"
      />
      {open && options.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
          {options.slice(0, 10).map((option) => (
            <button
              key={option.id}
              type="button"
              className="w-full px-3 py-2 text-right text-sm hover:bg-accent transition-colors"
              onMouseDown={() => {
                onPick(option.id);
                setSearch("");
                setOpen(false);
              }}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const body = (
    <div className={cn("flex flex-col h-full min-h-0", isPanel && "overflow-hidden bg-muted/20")} dir="rtl">
      <div className="shrink-0 border-b bg-card px-4 pt-3">
        {!isPanel && (
          <DialogHeader className="mb-2">
            <DialogTitle className="sr-only">פרטי משימה</DialogTitle>
          </DialogHeader>
        )}
        <div className="flex items-center gap-2 pb-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת המשימה"
            className="h-10 flex-1 border-0 bg-transparent px-0 text-base font-bold shadow-none focus-visible:ring-0"
          />
          {creatorName && (
            <span
              className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground shrink-0 max-w-[14rem]"
              title={`המשימה ניתנה על ידי ${creatorName}`}
            >
              <UserRound className="h-3 w-3" />
              <span className="truncate">ניתנה על ידי {creatorName}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:thin] bg-muted/20 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[minmax(220px,0.38fr)_minmax(0,1fr)] gap-3 items-start">
            <section className={cn(FRAME, "space-y-0 p-2.5")}>
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1 pb-1.5">
                <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                שיוך
              </div>
              {creatorName && (
              <div className="flex items-center gap-2 py-1.5 border-t">
                <div className="w-[4.25rem] shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <UserRound className="h-3 w-3" />
                  נתן
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-0.5 text-xs max-w-full">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold">
                    {personInitials(creatorName)}
                  </span>
                  <span className="truncate">{creatorName}</span>
                </span>
              </div>
              )}
              <div className="flex items-center gap-2 py-1.5 border-t">
                <div className="w-[4.25rem] shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Megaphone className="h-3 w-3" />
                  שויכה ל
                </div>
                {assignedCampaignerName && !campaignerDropdownOpen ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-0.5 text-xs max-w-full"
                    onClick={() => setCampaignerDropdownOpen(true)}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold">
                      {personInitials(assignedCampaignerName)}
                    </span>
                    <span className="truncate">{assignedCampaignerName}</span>
                    <X
                      className="h-3 w-3 text-muted-foreground shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignedCampaignerId("");
                        setCampaignerSearch("");
                      }}
                    />
                  </button>
                ) : (
                  assignmentSearch(
                    campaignerDropdownOpen,
                    setCampaignerDropdownOpen,
                    campaignerSearch,
                    setCampaignerSearch,
                    "חפש...",
                    filteredCampaigners.map((c) => ({ id: c.id, name: c.full_name })),
                    setAssignedCampaignerId,
                  )
                )}
              </div>
              <div className="flex items-center gap-2 py-1.5 border-t">
                <div className="w-[4.25rem] shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  לקוח
                </div>
                {selectedClientName && !clientDropdownOpen ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-0.5 text-xs max-w-full"
                    onClick={() => setClientDropdownOpen(true)}
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold">
                      {personInitials(selectedClientName)}
                    </span>
                    <span className="truncate">{selectedClientName}</span>
                    <X
                      className="h-3 w-3 text-muted-foreground shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientId("");
                        setClientSearch("");
                      }}
                    />
                  </button>
                ) : (
                  assignmentSearch(
                    clientDropdownOpen,
                    setClientDropdownOpen,
                    clientSearch,
                    setClientSearch,
                    "חפש...",
                    filteredClients.map((c) => ({ id: c.id, name: c.name })),
                    setClientId,
                  )
                )}
              </div>
              <div className="flex items-center gap-2 py-1.5 border-t">
                <div className="w-[4.25rem] shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <UserRound className="h-3 w-3" />
                  ליד
                </div>
                {selectedLeadName && !leadDropdownOpen ? (
                  <div className="flex items-center gap-1 min-w-0">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-1.5 py-0.5 text-xs max-w-full"
                      onClick={() => setLeadDropdownOpen(true)}
                    >
                      <span className="truncate">{selectedLeadName}</span>
                      <X
                        className="h-3 w-3 text-muted-foreground shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadId("");
                          setLeadSearch("");
                        }}
                      />
                    </button>
                    {fullLeadData && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-[10px] gap-1"
                        onClick={() => setViewLeadOpen(true)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        צפה
                      </Button>
                    )}
                  </div>
                ) : (
                  assignmentSearch(
                    leadDropdownOpen,
                    setLeadDropdownOpen,
                    leadSearch,
                    setLeadSearch,
                    "חפש...",
                    filteredLeads.map((l) => ({ id: l.id, name: l.company_name || "ליד" })),
                    setLeadId,
                  )
                )}
              </div>
              <div className="flex items-start gap-2 py-1.5 border-t">
                <div className="w-14 shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground pt-1">
                  <Users className="h-3 w-3" />
                  צוות
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  {collaborators?.map((col) => {
                    const name = (col.campaigners as { full_name?: string } | null)?.full_name || "איש צוות";
                    return (
                      <Badge key={col.id} variant="secondary" className="gap-1 pr-1 h-6 text-[10px]">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[8px] font-bold">
                          {personInitials(name)}
                        </span>
                        {name}
                        <button
                          type="button"
                          className="hover:text-destructive"
                          onClick={() => removeCollaborator.mutate(col.id)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    );
                  })}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-6 gap-1 rounded-full text-[10px] bg-card px-2">
                        <UserPlus className="h-3 w-3" />
                        הוסף
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[250px] p-0 z-50" align="start">
                      <Command>
                        <CommandInput placeholder="חיפוש איש צוות..." />
                        <CommandList>
                          <CommandEmpty>לא נמצא</CommandEmpty>
                          <CommandGroup>
                            {availableCollaborators?.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.full_name}
                                onSelect={() => {
                                  addCollaborator.mutate(c.id);
                                }}
                              >
                                <Check className={cn("h-4 w-4 ms-2", selectedCollaborator === c.id ? "opacity-100" : "opacity-0")} />
                                {c.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {Boolean(userCampaignerId && assignedCampaignerId === userCampaignerId) && (
                <div className="flex items-center gap-2 py-1.5 border-t">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium shrink-0">
                    <input
                      type="checkbox"
                      checked={selfReminderEnabled}
                      onChange={(event) => setSelfReminderEnabled(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <Bell className="h-3 w-3 text-muted-foreground" />
                    הזכר לי
                  </label>
                  {selfReminderEnabled && (
                    <Input
                      type="datetime-local"
                      value={selfReminderAt}
                      onChange={(event) => setSelfReminderAt(event.target.value)}
                      className="h-7 bg-card text-xs flex-1 min-w-0"
                      title="כרמן תזכיר רק במועד שתבחר"
                    />
                  )}
                </div>
              )}
            </section>

            <NotesWithAttachments
              value={notes}
              onChange={setNotes}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              taskId={task?.id}
              variant="notes"
              rows={3}
              notesTitle="הערות ועדכונים"
              placeholder="הערות קבועות למשימה..."
              notesFooter={
                <>
                  <div className="flex gap-2">
                    <Textarea
                      value={newUpdate}
                      onChange={(e) => setNewUpdate(e.target.value)}
                      placeholder="הוסף עדכון..."
                      rows={2}
                      className="flex-1 bg-transparent border-input min-h-[52px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && newUpdate.trim()) {
                          e.preventDefault();
                          addUpdate.mutate();
                        }
                      }}
                    />
                    <Button
                      onClick={() => addUpdate.mutate()}
                      disabled={!newUpdate.trim() || addUpdate.isPending}
                      size="icon"
                      className="self-end h-8 w-8"
                      aria-label="שלח עדכון"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {updates?.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-1">אין עדכונים עדיין</p>
                  )}
                  {updates?.map((update) => {
                    const updateType = (update as { update_type?: string }).update_type || "comment";
                    const createdAt = parseOptionalDate(update.created_at);
                    const typeIcon =
                      updateType === "agent_action" ? <Bot className="h-3.5 w-3.5 text-purple-500" /> :
                      updateType === "status_change" ? <GitCommit className="h-3.5 w-3.5 text-blue-500" /> :
                      updateType === "assignment" ? <ArrowRightLeft className="h-3.5 w-3.5 text-orange-500" /> :
                      <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />;
                    const typeLabel =
                      updateType === "agent_action" ? "פעולת סוכן" :
                      updateType === "status_change" ? "שינוי סטטוס" :
                      updateType === "assignment" ? "שיוך" :
                      "תגובה";
                    return (
                      <div
                        key={update.id}
                        className={cn(
                          "p-2 rounded-lg border bg-card text-right",
                          updateType === "agent_action" && "bg-purple-50/50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800",
                        )}
                      >
                        <div className="flex items-center justify-between mb-0.5 gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {typeIcon}
                            <span className="text-xs font-medium truncate">
                              {(update.profiles as { full_name?: string } | null)?.full_name || "משתמש"}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {typeLabel}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {createdAt ? format(createdAt, "dd/MM HH:mm", { locale: he }) : ""}
                          </span>
                        </div>
                        <p className="text-xs whitespace-pre-wrap">{update.content}</p>
                      </div>
                    );
                  })}
                </>
              }
            />
            </div>

            <NotesWithAttachments
              value={notes}
              onChange={setNotes}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              taskId={task?.id}
              variant="files"
              thumbSize="lg"
            />

            <section className={cn(FRAME, "space-y-3 p-3")}>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                תאריכים ודחיפות
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">תאריך ביצוע</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-right h-9 bg-card", !isUsableDate(dueDate) && "text-muted-foreground")}
                      >
                        <CalendarIcon className="ms-2 h-4 w-4" />
                        {isUsableDate(dueDate) ? format(dueDate, "dd/MM/yyyy", { locale: he }) : "בחר"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent portalled={false} className="w-auto p-0 z-[9999]" align="start">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">שעה</Label>
                  <TimeSlotPicker value={dueTime} onChange={setDueTime} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">תאריך יעד</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-right h-9 bg-card", !isUsableDate(targetDate) && "text-muted-foreground")}
                      >
                        <CalendarIcon className="ms-2 h-4 w-4" />
                        {isUsableDate(targetDate) ? format(targetDate, "dd/MM/yyyy", { locale: he }) : "בחר"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent portalled={false} className="w-auto p-0 z-[9999]" align="start">
                      <Calendar mode="single" selected={targetDate} onSelect={setTargetDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">משך</Label>
                  <Select
                    value={String((DURATION_OPTIONS as readonly number[]).includes(durationMinutes) ? durationMinutes : 30)}
                    onValueChange={(val) => setDurationMinutes(parseInt(val))}
                  >
                    <SelectTrigger className="h-9 bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 דקות</SelectItem>
                      <SelectItem value="60">שעה</SelectItem>
                      <SelectItem value="90">שעה וחצי</SelectItem>
                      <SelectItem value="120">שעתיים</SelectItem>
                      <SelectItem value="150">שעתיים וחצי</SelectItem>
                      <SelectItem value="180">3 שעות</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>דחיפות</span>
                  <span className="font-medium text-foreground">{priority}</span>
                </div>
                <Slider
                  value={[priority]}
                  onValueChange={([val]) => setPriority(val)}
                  min={1}
                  max={10}
                  step={1}
                  className="py-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>נמוכה</span>
                  <span>בינונית</span>
                  <span>גבוהה</span>
                  <span>דחופה</span>
                </div>
              </div>
            </section>
      </div>

      <div className="flex justify-between border-t bg-card px-4 py-3 shrink-0">
        <div className="flex gap-2">
          {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              onDelete(task.id);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4" />
            מחק
          </Button>
          )}
          {(task.due_date || task.due_time) && onMoveToBacklog && (
            <Button
              variant="outline"
              size="sm"
              className="bg-card"
              onClick={() => {
                onMoveToBacklog(task.id);
                if (!isPanel) onOpenChange(false);
              }}
            >
              <ListTodo className="h-4 w-4" />
              העבר לרשימה
            </Button>
          )}
        </div>
        <Button onClick={() => updateTask.mutate()} disabled={updateTask.isPending}>
          <Save className="h-4 w-4" />
          שמור שינויים
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {isPanel ? (
        body
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent dir="rtl" className="max-w-4xl h-[90vh] flex flex-col gap-0 !block p-0 overflow-hidden">
            {body}
          </DialogContent>
        </Dialog>
      )}
    {fullLeadData && (
      <EditLeadDialog
        lead={fullLeadData}
        open={viewLeadOpen}
        onOpenChange={setViewLeadOpen}
      />
    )}
    </>
  );
}
