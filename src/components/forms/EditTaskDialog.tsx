import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Send, FileText, MessageSquare, Settings, Pencil, Trash2, Upload, X, File, Image as ImageIcon, Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useTerminology } from "@/hooks/useTerminology";

const formSchema = z.object({
  title: z.string().min(1, "שם המשימה הוא שדה חובה"),
  notes: z.string().optional(),
  campaigner_id: z.string().optional(),
  sales_person_id: z.string().optional(),
  client_id: z.string().optional(),
  due_date: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]),
  priority: z.number().min(1).max(10),
}).refine((data) => {
  // Require either campaigner OR sales person
  return !!(data.campaigner_id || data.sales_person_id);
}, {
  message: "יש לבחור איש צוות אחראי",
  path: ["campaigner_id"],
});

// Component to handle async signed URL loading
function AttachmentPreview({ file, onImageClick }: { file: any; onImageClick?: (url: string, name: string) => void }) {
  const [signedUrl, setSignedUrl] = useState<string>('');

  useEffect(() => {
    const fetchSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(file.path, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error);
        return;
      }
      setSignedUrl(data.signedUrl);
    };

    fetchSignedUrl();
  }, [file.path]);

  if (!signedUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm animate-pulse">
        <File className="h-4 w-4" />
        <span>טוען...</span>
      </div>
    );
  }

  if (file.type?.startsWith('image/')) {
    return (
      <button
        type="button"
        onClick={() => onImageClick?.(signedUrl, file.name)}
        className="block rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity cursor-pointer"
      >
        <img 
          src={signedUrl} 
          alt={file.name}
          className="h-24 w-auto object-cover"
        />
      </button>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors text-sm"
    >
      <File className="h-4 w-4" />
      <span className="truncate max-w-[150px]">{file.name}</span>
    </a>
  );
}

interface EditTaskDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateContent, setEditingUpdateContent] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);
  
  // Calendar meeting state
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const { t } = useTerminology();

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_people")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskUpdates, refetch: refetchUpdates } = useQuery({
    queryKey: ["task-updates", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_updates")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!task.id && open,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title || "",
      notes: task.notes || "",
      campaigner_id: task.campaigner_id || "",
      sales_person_id: task.sales_person_id || "",
      client_id: task.client_id || "",
      due_date: task.due_date || "",
      status: task.status || "open",
      priority: task.priority || 5,
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      console.log('EditTask: Starting update mutation', { taskId: task.id, values });
      
      // Get agency_id from the selected client if client is specified
      const selectedClient = clients?.find(c => c.id === values.client_id);
      console.log('EditTask: Selected client', { selectedClient, allClients: clients?.length });
      
      // Only require agency_id if a client is selected
      let agencyId = task.agency_id; // Keep existing agency_id as default
      if (values.client_id && selectedClient?.agency_id) {
        agencyId = selectedClient.agency_id;
      }

      const updateData = {
        title: values.title,
        notes: values.notes || null,
        campaigner_id: values.campaigner_id || null,
        sales_person_id: values.sales_person_id || null,
        client_id: values.client_id || null,
        agency_id: agencyId,
        due_date: values.due_date || null,
        status: values.status,
        priority: values.priority,
        task_type: "other" as const,
      };
      
      console.log('EditTask: Update data', updateData);

      const { data, error } = await supabase
        .from("tasks")
        .update(updateData)
        .eq("id", task.id)
        .select();
        
      console.log('EditTask: Update result', { data, error });
      if (error) throw error;
    },
    onSuccess: () => {
      console.log('EditTask: Update successful');
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("המשימה עודכנה בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('EditTask: Update failed', error);
      toast.error(`שגיאה בעדכון משימה: ${error.message}`);
    },
  });

  const uploadFiles = async (files: File[]): Promise<{ name: string; path: string; type: string; size: number }[]> => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${task.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      return {
        name: file.name,
        path: fileName,
        type: file.type,
        size: file.size,
      };
    });

    return Promise.all(uploadPromises);
  };

  const addUpdateMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments: any[] }) => {
      const { error } = await supabase
        .from("task_updates")
        .insert({
          task_id: task.id,
          user_id: userId,
          content,
          attachments,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setNewUpdate("");
      setUploadedFiles([]);
      toast.success("העדכון נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהוספת עדכון: ${error.message}`);
    },
  });

  const updateUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("task_updates")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setEditingUpdateId(null);
      setEditingUpdateContent("");
      toast.success("העדכון עודכן בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      toast.success("העדכון נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה במחיקת עדכון: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  const handleAddUpdate = async () => {
    if (!newUpdate.trim() && uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      const attachments = uploadedFiles.length > 0 
        ? await uploadFiles(uploadedFiles)
        : [];
      
      addUpdateMutation.mutate({
        content: newUpdate,
        attachments,
      });
    } catch (error: any) {
      toast.error(`שגיאה בהעלאת קבצים: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      
      if (!isValidType) {
        toast.error(`${file.name}: רק תמונות ו-PDF מותרים`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: הקובץ גדול מדי (מקסימום 10MB)`);
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        toast.error(`${file.name}: רק תמונות ו-PDF מותרים`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: הקובץ גדול מדי (מקסימום 10MB)`);
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
          if (!isValidSize) {
            toast.error(`הקובץ גדול מדי (מקסימום 10MB)`);
            continue;
          }
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
      toast.success(`${files.length} תמונות נוספו`);
    }
  };

  const getFileUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return '';
    }
    return data.signedUrl;
  };

  const handleEditUpdate = (updateId: string, currentContent: string) => {
    setEditingUpdateId(updateId);
    setEditingUpdateContent(currentContent);
  };

  const handleSaveEdit = () => {
    if (!editingUpdateContent.trim() || !editingUpdateId) return;
    updateUpdateMutation.mutate({
      id: editingUpdateId,
      content: editingUpdateContent.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setEditingUpdateContent("");
  };

  const handleDeleteUpdate = (updateId: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק עדכון זה?")) {
      deleteUpdateMutation.mutate(updateId);
    }
  };

  // Calendar functions
  const fetchCalendarEvents = async (selectedDate: Date) => {
    setIsLoadingCalendar(true);
    setCalendarError(null);
    setCalendarEvents([]);
    
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const { data, error } = await supabase.functions.invoke('get-calendar-events', {
        body: {
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
        },
      });
      
      if (error) throw error;
      
      if (data?.needsReconnect) {
        setCalendarError('היומן לא מחובר. יש לחבר את יומן Google.');
        return;
      }
      
      if (data?.events) {
        setCalendarEvents(data.events);
      }
    } catch (err: any) {
      console.error('Error fetching calendar events:', err);
      setCalendarError(err.message || 'שגיאה בטעינת היומן');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleMeetingDateSelect = (date: Date | undefined) => {
    setMeetingDate(date);
    if (date) {
      fetchCalendarEvents(date);
    } else {
      setCalendarEvents([]);
    }
  };

  const allTimeOptions: string[] = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      allTimeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  const getAvailableTimeSlots = () => {
    if (!meetingDate || calendarEvents.length === 0) {
      return allTimeOptions.map(time => ({ time, available: true }));
    }

    return allTimeOptions.map(time => {
      const [hours, minutes] = time.split(':').map(Number);
      const slotStart = new Date(meetingDate);
      slotStart.setHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      const isOccupied = calendarEvents.some(event => {
        const eventStart = new Date(event.start?.dateTime || event.start?.date);
        const eventEnd = new Date(event.end?.dateTime || event.end?.date);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      return { time, available: !isOccupied };
    });
  };

  const timeSlots = getAvailableTimeSlots();

  const handleScheduleTaskMeeting = async () => {
    if (!meetingDate || !meetingTime) {
      toast.error("נא לבחור תאריך ושעה");
      return;
    }

    setIsSchedulingMeeting(true);

    try {
      const [hours, minutes] = meetingTime.split(':').map(Number);
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + 1);

      const clientName = clients?.find(c => c.id === task.client_id)?.name || '';
      const subject = meetingSubject || `משימה: ${task.title}${clientName ? ` - ${clientName}` : ''}`;

      // Get the campaigner's user email if different from logged-in user
      let attendeeEmail: string | undefined;
      const campaignerId = form.getValues('campaigner_id') || task.campaigner_id;
      
      if (campaignerId) {
        // Find user associated with this campaigner
        const { data: campaignerProfile } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('campaigner_id', campaignerId)
          .maybeSingle();
        
        // If the campaigner is linked to a different user, add them as attendee
        if (campaignerProfile && campaignerProfile.id !== userId) {
          attendeeEmail = campaignerProfile.email;
        }
      }

      const { data: calendarData, error: calendarError } = await supabase.functions.invoke('add-calendar-event', {
        body: {
          summary: subject,
          description: `משימה: ${task.title}\n\n${task.notes || ''}`,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          location: meetingLocation || undefined,
          attendees: attendeeEmail ? [attendeeEmail] : undefined,
        }
      });

      if (calendarError) {
        console.error('Calendar error:', calendarError);
        toast.error("שגיאה ביצירת הפגישה ביומן");
      } else {
        const successMessage = attendeeEmail 
          ? "המשימה נוספה ליומן ונשלח זימון לקמפיינר!" 
          : "המשימה נוספה ליומן!";
        toast.success(successMessage);
        
        // Trigger automation for task_calendar_created
        try {
          const { data: taskData } = await supabase
            .from('tasks')
            .select('tenant_id')
            .eq('id', task.id)
            .single();
          
          if (taskData?.tenant_id) {
            await supabase.functions.invoke('trigger-automation', {
              body: {
                trigger_type: 'task_calendar_created',
                data: {
                  id: task.id,
                  title: task.title,
                  client_id: task.client_id,
                  client_name: clientName,
                  meeting_date: format(meetingDate, 'yyyy-MM-dd'),
                  meeting_time: meetingTime,
                  meeting_subject: subject,
                  meeting_location: meetingLocation,
                },
                tenant_id: taskData.tenant_id
              }
            });
          }
        } catch (automationError) {
          console.error('Automation trigger error:', automationError);
        }
      }

      // Reset form
      setMeetingDate(undefined);
      setMeetingTime("10:00");
      setMeetingSubject("");
      setMeetingLocation("");

    } catch (error: any) {
      console.error('Meeting scheduling error:', error);
      toast.error(`שגיאה בקביעת פגישה: ${error.message}`);
    } finally {
      setIsSchedulingMeeting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>עריכת משימה</DialogTitle>
          </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 bg-muted/50 p-1 rounded-lg shadow-sm">
            <TabsTrigger value="details" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-xs sm:text-sm py-2">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              פרטי משימה
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-xs sm:text-sm py-2">
              <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              הוסף ליומן
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-xs sm:text-sm py-2">
              <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4" />
              עדכונים
              {taskUpdates && taskUpdates.length > 0 && (
                <span className="mr-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-xs">
                  {taskUpdates.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-xs sm:text-sm py-2">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
              סטטוס
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6">
              
              {/* Tab 1: Details */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">כותרת משימה</FormLabel>
                      <FormControl>
                        <Input {...field} className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">תיאור משימה</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} placeholder="הוסף תיאור למשימה..." className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Combined Team Member selector with search */}
                <FormField
                  control={form.control}
                  name="campaigner_id"
                  render={({ field }) => {
                    const [teamMemberPopoverOpen, setTeamMemberPopoverOpen] = useState(false);
                    
                    // Combine campaigners and sales people into one list
                    const allTeamMembers = [
                      ...(campaigners?.map(c => ({ id: c.id, name: c.full_name, type: 'campaigner' as const })) || []),
                      ...(salesPeople?.map(s => ({ id: s.id, name: s.full_name, type: 'sales' as const })) || []),
                    ];
                    
                    // Find selected member
                    const selectedMember = allTeamMembers.find(m => 
                      (m.type === 'campaigner' && m.id === field.value) ||
                      (m.type === 'sales' && m.id === form.getValues('sales_person_id'))
                    );
                    
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-right block">איש צוות אחראי</FormLabel>
                        <Popover open={teamMemberPopoverOpen} onOpenChange={setTeamMemberPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "justify-between text-right",
                                  !selectedMember && "text-muted-foreground"
                                )}
                              >
                                {selectedMember ? selectedMember.name : "בחר איש צוות"}
                                <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-background" align="start">
                            <Command>
                              <CommandInput placeholder="חפש איש צוות..." />
                              <CommandList>
                                <CommandEmpty>לא נמצאו אנשי צוות</CommandEmpty>
                                {campaigners && campaigners.length > 0 && (
                                  <CommandGroup heading={t('campaigner', true)}>
                                    {campaigners.map((campaigner) => (
                                      <CommandItem
                                        key={`campaigner:${campaigner.id}`}
                                        value={campaigner.full_name}
                                        onSelect={() => {
                                          field.onChange(campaigner.id);
                                          form.setValue('sales_person_id', '');
                                          setTeamMemberPopoverOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            field.value === campaigner.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {campaigner.full_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                                {salesPeople && salesPeople.length > 0 && (
                                  <CommandGroup heading={t('sales_person', true)}>
                                    {salesPeople.map((salesPerson) => (
                                      <CommandItem
                                        key={`sales:${salesPerson.id}`}
                                        value={salesPerson.full_name}
                                        onSelect={() => {
                                          field.onChange('');
                                          form.setValue('sales_person_id', salesPerson.id);
                                          setTeamMemberPopoverOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            form.getValues('sales_person_id') === salesPerson.id ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {salesPerson.full_name}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-right block">לקוח</FormLabel>
                      <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "justify-between text-right",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                               {field.value
                                 ? clients?.find((client) => client.id === field.value)?.name
                                 : "בחר לקוח"}
                               <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 bg-background" align="start">
                          <Command>
                            <CommandInput placeholder="חפש לקוח..." />
                            <CommandList>
                              <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                              <CommandGroup>
                                {clients?.map((client) => (
                                  <CommandItem
                                    key={client.id}
                                    value={client.name}
                                    onSelect={() => {
                                      form.setValue("client_id", client.id);
                                      setClientPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === client.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    {client.name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Tab 2: Calendar */}
              <TabsContent value="calendar" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    הוסף משימה ליומן
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Calendar Side */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">בחר תאריך</label>
                      <Card className="p-2">
                        <Calendar
                          mode="single"
                          selected={meetingDate}
                          onSelect={handleMeetingDateSelect}
                          disabled={(date) => date < new Date()}
                          className="pointer-events-auto"
                          locale={he}
                        />
                      </Card>
                    </div>

                    {/* Details Side */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          שעה
                        </label>
                        <Select value={meetingTime} onValueChange={setMeetingTime}>
                          <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                            <SelectValue placeholder="בחר שעה" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-[200px]">
                            {isLoadingCalendar ? (
                              <div className="p-2 text-center text-sm text-muted-foreground">טוען יומן...</div>
                            ) : calendarError ? (
                              <div className="p-2 text-center text-sm text-destructive">{calendarError}</div>
                            ) : (
                              timeSlots.map(({ time, available }) => (
                                <SelectItem 
                                  key={time} 
                                  value={time}
                                  disabled={!available}
                                  className={cn(!available && "text-muted-foreground line-through")}
                                >
                                  {time} {!available && "(תפוס)"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">נושא (אופציונלי)</label>
                        <Input
                          value={meetingSubject}
                          onChange={(e) => setMeetingSubject(e.target.value)}
                          placeholder={`משימה: ${task.title}`}
                          className="text-right rounded-lg border-2 h-11 px-4"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">מיקום (אופציונלי)</label>
                        <Input
                          value={meetingLocation}
                          onChange={(e) => setMeetingLocation(e.target.value)}
                          placeholder="למשל: זום, משרד, כתובת..."
                          className="text-right rounded-lg border-2 h-11 px-4"
                          dir="rtl"
                        />
                      </div>

                      {meetingDate && (
                        <Card className="p-3 bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {format(meetingDate, "EEEE, d בMMMM yyyy", { locale: he })} בשעה {meetingTime}
                            </span>
                          </div>
                        </Card>
                      )}

                      <Button
                        type="button"
                        onClick={handleScheduleTaskMeeting}
                        disabled={!meetingDate || isSchedulingMeeting}
                        className="w-full h-11"
                      >
                        {isSchedulingMeeting ? (
                          "מוסיף ליומן..."
                        ) : (
                          <>
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            הוסף ליומן
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Updates */}
              <TabsContent value="updates" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">היסטוריית עדכונים</h4>
                    <span className="text-xs text-muted-foreground">
                      {taskUpdates?.length || 0} עדכונים
                    </span>
                  </div>

                  {/* Updates List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {taskUpdates?.map((update: any) => (
                      <Card key={update.id} className="p-3">
                        {editingUpdateId === update.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingUpdateContent}
                              onChange={(e) => setEditingUpdateContent(e.target.value)}
                              rows={3}
                              className="w-full"
                            />
                             <div className="flex gap-2 justify-start">
                               <Button
                                 type="button"
                                 size="sm"
                                 onClick={handleSaveEdit}
                                 disabled={!editingUpdateContent.trim() || updateUpdateMutation.isPending}
                               >
                                 שמור
                               </Button>
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 onClick={handleCancelEdit}
                               >
                                 ביטול
                               </Button>
                             </div>
                          </div>
                        ) : (
                           <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(update.created_at), "d בMMMM, HH:mm", { locale: he })}
                                </span>
                              </div>
                              {update.content && (
                                <p className="text-sm whitespace-pre-wrap">
                                  {update.content}
                                </p>
                              )}
                               {update.attachments && Array.isArray(update.attachments) && update.attachments.length > 0 && (
                                 <div className="flex flex-wrap gap-2 mt-2">
                                   {update.attachments.map((file: any, idx: number) => (
                                     <AttachmentPreview 
                                       key={idx} 
                                       file={file}
                                       onImageClick={(url, name) => setLightboxImage({ url, name })}
                                     />
                                   ))}
                                 </div>
                               )}
                            </div>
                            {update.user_id === userId && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditUpdate(update.id, update.content)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteUpdate(update.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                    {(!taskUpdates || taskUpdates.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        אין עדכונים עדיין
                      </p>
                    )}
                  </div>

                   {/* Add New Update */}
                   <div className="space-y-3 pt-4 border-t">
                     {/* File Upload Area */}
                     <div
                       className={cn(
                         "border-2 border-dashed rounded-lg p-4 transition-colors",
                         isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                         "hover:border-primary/50"
                       )}
                       onDragOver={handleDragOver}
                       onDragLeave={handleDragLeave}
                       onDrop={handleDrop}
                     >
                       <div className="flex flex-col items-center gap-2 text-center">
                         <Upload className="h-8 w-8 text-muted-foreground" />
                         <p className="text-sm text-muted-foreground">
                           גרור קבצים לכאן או
                           <label className="text-primary cursor-pointer hover:underline mr-1">
                             בחר קבצים
                             <input
                               type="file"
                               className="hidden"
                               multiple
                               accept="image/*,.pdf"
                               onChange={handleFileSelect}
                             />
                           </label>
                         </p>
                         <p className="text-xs text-muted-foreground">
                           תמונות או PDF עד 10MB
                         </p>
                       </div>
                     </div>

                     {/* Uploaded Files Preview */}
                     {uploadedFiles.length > 0 && (
                       <div className="flex flex-wrap gap-2">
                         {uploadedFiles.map((file, index) => (
                           <div
                             key={index}
                             className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                           >
                             {file.type.startsWith('image/') ? (
                               <ImageIcon className="h-4 w-4" />
                             ) : (
                               <File className="h-4 w-4" />
                             )}
                             <span className="truncate max-w-[150px]">{file.name}</span>
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className="h-5 w-5"
                               onClick={() => removeFile(index)}
                             >
                               <X className="h-3 w-3" />
                             </Button>
                           </div>
                         ))}
                       </div>
                     )}

                     <div className="flex gap-2" dir="rtl">
                       <Button
                         type="button"
                         size="icon"
                         onClick={handleAddUpdate}
                         disabled={(!newUpdate.trim() && uploadedFiles.length === 0) || addUpdateMutation.isPending || isUploading}
                         className="self-end"
                       >
                         <Send className="h-4 w-4" />
                       </Button>
                        <Textarea
                          value={newUpdate}
                          onChange={(e) => setNewUpdate(e.target.value)}
                          onPaste={handlePaste}
                          placeholder="הוסף עדכון חדש..."
                          rows={3}
                          className="flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey) {
                              handleAddUpdate();
                            }
                          }}
                        />
                     </div>
                     <p className="text-xs text-muted-foreground text-right">
                       לחץ Ctrl+Enter לשליחה מהירה
                     </p>
                   </div>
                </div>
              </TabsContent>

              {/* Tab 3: Status */}
              <TabsContent value="status" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">סטטוס משימה</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(
                          "border-0 text-white font-medium",
                          field.value === "open" && "bg-blue-400 hover:bg-blue-500",
                          field.value === "in_progress" && "bg-yellow-400 hover:bg-yellow-500",
                          field.value === "done" && "bg-green-400 hover:bg-green-500"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="open" className="text-blue-600 focus:text-blue-600 focus:bg-blue-50">פתוח</SelectItem>
                        <SelectItem value="in_progress" className="text-yellow-600 focus:text-yellow-600 focus:bg-yellow-50">בעבודה</SelectItem>
                        <SelectItem value="done" className="text-green-600 focus:text-green-600 focus:bg-green-50">הושלם</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => {
                  const getPriorityColor = (priority: number) => {
                    const hue = 240 - ((priority - 1) / 9) * 240;
                    return `hsl(${hue}, 70%, 50%)`;
                  };
                  
                  const getPriorityText = (priority: number) => {
                    if (priority >= 8) return "דחיפות גבוהה";
                    if (priority >= 5) return "דחיפות בינונית";
                    return "דחיפות נמוכה";
                  };

                  return (
                    <FormItem>
                      <FormLabel className="text-right block">דחיפות</FormLabel>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{getPriorityText(field.value)}</span>
                          <span className="text-sm font-medium" style={{ color: getPriorityColor(field.value) }}>
                            {field.value}/10
                          </span>
                        </div>
                        <div style={{ ['--slider-color' as any]: getPriorityColor(field.value) }}>
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={1}
                            max={10}
                            step={1}
                            className="cursor-pointer [&_[role=slider]]:border-[var(--slider-color)] [&_.bg-primary]:bg-[var(--slider-color)]"
                            style={{ ['--slider-color' as any]: getPriorityColor(field.value) }}
                          />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">תאריך יעד</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </TabsContent>
            </form>
          </Form>

          {/* Buttons outside tabs but visible always */}
          <div className="flex justify-start gap-2 mt-6 pt-4 border-t">
            <Button 
              type="button"
              onClick={() => form.handleSubmit(onSubmit)()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "מעדכן..." : "עדכן משימה"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Lightbox for images */}
    <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
        <div className="relative w-full h-full flex items-center justify-center bg-black/90">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
            onClick={() => setLightboxImage(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          {lightboxImage && (
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-w-full max-h-[90vh] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
