import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Pencil, CalendarIcon, FileText, DollarSign, MessageSquare, Send, Trash2, Settings2, Clock, Users, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ManageLeadStatusesDialog } from "./ManageLeadStatusesDialog";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useLeadPipelineStages } from "@/hooks/useLeadPipelineStages";
import { ManagePipelineStagesDialog } from "./ManagePipelineStagesDialog";

const formSchema = z.object({
  company_name: z.string().min(1, "שם העסק הוא שדה חובה"),
  contact_name: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().optional(),
  source: z.string().optional(),
  status: z.string().optional(),
  response_status: z.string().optional(),
  estimated_deal_value: z.string().optional(),
  monthly_budget: z.string().optional(),
  proposal_date: z.date().optional(),
  itai_meeting_date: z.date().optional(),
  sale_date: z.date().optional(),
  industry: z.string().optional(),
  products: z.array(z.string()).optional(),
  notes: z.string().optional(),
  sales_person_id: z.string().optional(),
  agency_id: z.string().optional(),
  folder_link: z.string().optional(),
  lost_reason: z.string().optional(),
  created_at: z.date().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditLeadDialogProps {
  lead: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function EditLeadDialog({ lead, open: controlledOpen, onOpenChange }: EditLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [activeTab, setActiveTab] = useState("details");
  const [newUpdate, setNewUpdate] = useState("");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateContent, setEditingUpdateContent] = useState("");
  
  // Meeting scheduling state
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingSubject, setMeetingSubject] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSchedulingMeeting, setIsSchedulingMeeting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();
  const { getFieldLabel, isFieldVisible } = useCustomFieldLabels('lead');
  const { activeStatuses: leadStatuses } = useLeadStatuses();
  const { activeStages: pipelineStages } = useLeadPipelineStages();
  const { tenantId } = useCurrentTenant();

const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company_name: lead.company_name || "",
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      source: lead.source || "other",
      status: lead.status || "new",
      response_status: lead.response_status || "",
      estimated_deal_value: lead.estimated_deal_value?.toString() || "",
      monthly_budget: lead.monthly_budget?.toString() || "",
      proposal_date: lead.proposal_date ? new Date(lead.proposal_date) : undefined,
      itai_meeting_date: lead.itai_meeting_date ? new Date(lead.itai_meeting_date) : undefined,
      sale_date: lead.sale_date ? new Date(lead.sale_date) : undefined,
      industry: lead.industry || "",
      products: (() => {
        if (!lead.products) return [];
        try {
          const parsed = JSON.parse(lead.products);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          // Old data format - single product ID as string
          return lead.products ? [lead.products] : [];
        }
      })(),
      notes: lead.notes || "",
      sales_person_id: lead.sales_person_id || "",
      agency_id: lead.agency_id || "",
      folder_link: lead.folder_link || "",
      lost_reason: lead.lost_reason || "",
      created_at: lead.created_at ? new Date(lead.created_at) : new Date(),
    },
  });

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: salesPeople } = useQuery({
    queryKey: ["sales-people-all"],
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

  const { data: products } = useQuery({
    queryKey: ["products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("active", true)
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const { data: leadUpdates, refetch: refetchUpdates } = useQuery({
    queryKey: ["lead-updates", lead.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_updates")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!lead.id && open,
  });

const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const submitData: any = {
        company_name: values.company_name,
        contact_name: values.contact_name || null,
        email: values.email || null,
        phone: values.phone || null,
        source: (values.source as any) || null,
        status: (values.status as any) || 'new',
        response_status: values.response_status && values.response_status !== 'none' ? (values.response_status as any) : null,
        estimated_deal_value: values.estimated_deal_value 
          ? parseFloat(values.estimated_deal_value) 
          : null,
        monthly_budget: values.monthly_budget 
          ? parseFloat(values.monthly_budget) 
          : null,
        proposal_date: values.proposal_date || null,
        sale_date: values.sale_date || null,
        industry: values.industry || null,
        products: values.products && values.products.length > 0 ? JSON.stringify(values.products) : null,
        notes: values.notes || null,
        sales_person_id: values.sales_person_id || null,
        agency_id: values.agency_id || null,
        folder_link: values.folder_link || null,
        lost_reason: values.lost_reason || null,
        created_at: values.created_at || new Date(),
      };

      const { data, error } = await supabase
        .from("leads")
        .update(submitData)
        .eq("id", lead.id)
        .select()
        .single();

      if (error) throw error;
      
      // Trigger automations if status actually changed
      if (data && lead.status !== data.status) {
        try {
          await supabase.functions.invoke('trigger-automation', {
            body: {
              trigger_type: 'lead_status_changed',
              data: {
                id: data.id,
                status: data.status,
                new_status: data.status,
                old_status: lead.status,
                contact_name: data.contact_name,
                company_name: data.company_name,
                phone: data.phone,
                email: data.email,
                agency_id: data.agency_id,
                sales_person_id: data.sales_person_id,
                tenant_id: data.tenant_id
              },
              tenant_id: data.tenant_id
            }
          });
        } catch (automationError) {
          console.error('Failed to trigger automation:', automationError);
          // Don't fail the mutation if automation fails
        }
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "ליד עודכן בהצלחה",
      });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בעדכון ליד",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("lead_updates")
        .insert({
          lead_id: lead.id,
          user_id: userId,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setNewUpdate("");
      sonnerToast.success("העדכון נוסף בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה בהוספת עדכון: ${error.message}`);
    },
  });

  const updateUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("lead_updates")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setEditingUpdateId(null);
      setEditingUpdateContent("");
      sonnerToast.success("העדכון עודכן בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lead_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      sonnerToast.success("העדכון נמחק בהצלחה");
    },
    onError: (error: Error) => {
      sonnerToast.error(`שגיאה במחיקת עדכון: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateMutation.mutate(values);
  };

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;
    addUpdateMutation.mutate(newUpdate);
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

  const handleScheduleMeeting = async () => {
    if (!meetingDate || !meetingTime) {
      sonnerToast.error("נא לבחור תאריך ושעה");
      return;
    }

    setIsSchedulingMeeting(true);

    try {
      // Combine date and time
      const [hours, minutes] = meetingTime.split(':').map(Number);
      const startDateTime = new Date(meetingDate);
      startDateTime.setHours(hours, minutes, 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setHours(startDateTime.getHours() + 1); // 1 hour meeting

      const subject = meetingSubject || `פגישה עם ${lead.contact_name || lead.company_name}`;

      // Create calendar event with attendee - Google will send the invitation automatically
      const attendees = lead.email ? [lead.email] : [];
      
      const { data: calendarData, error: calendarError } = await supabase.functions.invoke('add-calendar-event', {
        body: {
          summary: subject,
          description: personalMessage || `פגישה עם ליד: ${lead.company_name}`,
          start: startDateTime.toISOString(),
          end: endDateTime.toISOString(),
          attendees,
        }
      });

      if (calendarError) {
        console.error('Calendar error:', calendarError);
        sonnerToast.error("שגיאה ביצירת הפגישה ביומן");
      } else {
        if (lead.email) {
          sonnerToast.success("הפגישה נוצרה וזימון נשלח למייל של הליד!");
        } else {
          sonnerToast.success("הפגישה נוספה ליומן!");
        }
      }

      // Reset form
      setMeetingDate(undefined);
      setMeetingTime("10:00");
      setMeetingSubject("");
      setPersonalMessage("");

    } catch (error: any) {
      console.error('Meeting scheduling error:', error);
      sonnerToast.error(`שגיאה בקביעת פגישה: ${error.message}`);
    } finally {
      setIsSchedulingMeeting(false);
    }
  };

  const showLostReason = form.watch("status") === "closed";

  // Generate time options
  const timeOptions = [];
  for (let h = 7; h <= 21; h++) {
    for (let m = 0; m < 60; m += 30) {
      timeOptions.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>ערוך ליד</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-lg shadow-sm">
            <TabsTrigger 
              value="details" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-sm"
            >
              <FileText className="h-4 w-4" />
              פרטי ליד
            </TabsTrigger>
            <TabsTrigger 
              value="proposals" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-sm"
            >
              <DollarSign className="h-4 w-4" />
              הצעות מחיר
            </TabsTrigger>
            <TabsTrigger 
              value="meeting" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-sm"
            >
              <Users className="h-4 w-4" />
              קביעת פגישה
            </TabsTrigger>
            <TabsTrigger 
              value="updates" 
              className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-md rounded-md transition-all text-sm"
            >
              <MessageSquare className="h-4 w-4" />
              עדכונים
              {leadUpdates && leadUpdates.length > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
                  {leadUpdates.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6">
              
              {/* Tab 1: Lead Details */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4" dir="rtl">
                  <FormField
                    control={form.control}
                    name="contact_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{getFieldLabel('contact_name', 'שם איש קשר')} *</FormLabel>
                        <FormControl>
                          <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isFieldVisible('company_name') && (
                    <FormField
                      control={form.control}
                      name="company_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">{getFieldLabel('company_name', 'שם העסק')} *</FormLabel>
                          <FormControl>
                            <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="agency_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">{getFieldLabel('agency_id', 'סוכנות')} *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-right rounded-lg border-2 h-11">
                            <SelectValue placeholder="בחר סוכנות" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-50 text-right" align="end">
                          {agencies?.map((agency) => (
                            <SelectItem key={agency.id} value={agency.id}>
                              {agency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sales_person_id"
                  render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">איש מכירות *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue placeholder="בחר איש מכירות" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
                            {salesPeople?.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">טלפון</FormLabel>
                        <FormControl>
                          <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">אימייל</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="response_status"
                    render={({ field }) => {
                      const selectedStatus = leadStatuses.find(s => s.status_key === field.value);
                      return (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">סטטוס תגובה</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger 
                                className="text-right rounded-lg border-2 h-11"
                                style={{ 
                                  backgroundColor: selectedStatus?.color || undefined,
                                  color: field.value ? '#fff' : undefined 
                                }}
                              >
                                <SelectValue placeholder="בחר סטטוס" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background z-50 text-right" align="end">
                              <SelectItem value="none">ללא סטטוס</SelectItem>
                              {leadStatuses.map((status) => (
                                <SelectItem 
                                  key={status.status_key} 
                                  value={status.status_key}
                                  style={{ backgroundColor: status.color, color: '#fff' }}
                                >
                                  {status.label}
                                </SelectItem>
                              ))}
                              <div className="border-t mt-1 pt-1">
                                <ManageLeadStatusesDialog 
                                  trigger={
                                    <button 
                                      type="button"
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                                    >
                                      <Settings2 className="h-4 w-4" />
                                      ניהול סטטוסים
                                    </button>
                                  }
                                />
                              </div>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => {
                      const selectedStage = pipelineStages.find(s => s.stage_key === field.value);
                      return (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">שלב במשפך *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger 
                                className="text-right rounded-lg border-2 h-11"
                                style={{ 
                                  backgroundColor: selectedStage?.color || undefined,
                                  color: field.value ? '#fff' : undefined 
                                }}
                              >
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-background z-50 text-right" align="end">
                              {pipelineStages.map((stage) => (
                                <SelectItem 
                                  key={stage.stage_key} 
                                  value={stage.stage_key}
                                  style={{ backgroundColor: stage.color, color: '#fff' }}
                                >
                                  {stage.label}
                                </SelectItem>
                              ))}
                              <div className="border-t mt-1 pt-1">
                                <ManagePipelineStagesDialog 
                                  trigger={
                                    <button 
                                      type="button"
                                      className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted rounded cursor-pointer"
                                    >
                                      <Settings2 className="h-4 w-4" />
                                      ניהול שלבי משפך
                                    </button>
                                  }
                                />
                              </div>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />

                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">מקור הגעה</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right rounded-lg border-2 h-11">
                              <SelectValue placeholder="בחר מקור" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50 text-right" align="end">
                            <SelectItem value="phone">טלפון</SelectItem>
                            <SelectItem value="website">אתר</SelectItem>
                            <SelectItem value="facebook">פייסבוק</SelectItem>
                            <SelectItem value="google">גוגל</SelectItem>
                            <SelectItem value="referral">הפניה</SelectItem>
                            <SelectItem value="other">אחר</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="created_at"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium">תאריך יצירת ליד</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-right font-normal rounded-lg border-2 h-11",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>בחר תאריך</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">תחום עיסוק</FormLabel>
                      <FormControl>
                        <Input {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="folder_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">קישור לתיקייה</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://..." className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" />
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
                      <FormLabel className="text-sm font-medium">הערות</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} className="text-right rounded-lg border-2 px-4 py-3" dir="rtl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                  {updateMutation.isPending ? "מעדכן..." : "עדכן ליד"}
                </Button>
              </TabsContent>

              {/* Tab 2: Proposals & Pricing */}
              <TabsContent value="proposals" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="products"
                  render={({ field }) => {
                    const selectedProducts = field.value || [];
                    
                    const handleToggleProduct = (productId: string) => {
                      const currentProducts = [...selectedProducts];
                      const index = currentProducts.indexOf(productId);
                      
                      if (index > -1) {
                        currentProducts.splice(index, 1);
                      } else {
                        currentProducts.push(productId);
                      }
                      
                      field.onChange(currentProducts);
                      
                      // Calculate total price
                      const totalPrice = currentProducts.reduce((sum, id) => {
                        const product = products?.find(p => p.id === id);
                        return sum + (product ? parseFloat(product.price.toString()) : 0);
                      }, 0);
                      
                      form.setValue("estimated_deal_value", totalPrice.toString());
                    };
                    
                    return (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">מוצרים/שירותים (בחר אחד או יותר)</FormLabel>
                        <div className="space-y-2 border-2 rounded-lg p-4 bg-background">
                          {products?.map((product) => (
                            <div key={product.id} className="flex items-center space-x-2 space-x-reverse">
                              <Checkbox
                                id={product.id}
                                checked={selectedProducts.includes(product.id)}
                                onCheckedChange={() => handleToggleProduct(product.id)}
                              />
                              <label
                                htmlFor={product.id}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1 flex justify-between items-center"
                              >
                                <span>{product.name}</span>
                                <span className="text-muted-foreground">₪{parseFloat(product.price.toString()).toLocaleString()}</span>
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="estimated_deal_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">שווי שירות (₪)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" placeholder="0" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthly_budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">{getFieldLabel('monthly_budget', 'תקציב')} (₪)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="text-right rounded-lg border-2 h-11 px-4" dir="rtl" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="proposal_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">{getFieldLabel('proposal_date', 'תאריך הצעה')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-right font-normal rounded-lg border-2 h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy")
                                ) : (
                                  <span>בחר תאריך</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {isFieldVisible('itai_meeting_date') && (
                  <FormField
                    control={form.control}
                    name="itai_meeting_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-sm font-medium">{getFieldLabel('itai_meeting_date', 'שיחה עם איתי')}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-right font-normal rounded-lg border-2 h-11",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "dd/MM/yyyy")
                                ) : (
                                  <span>בחר תאריך</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="sale_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel className="text-sm font-medium">תאריך מכירה</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-right font-normal rounded-lg border-2 h-11",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "dd/MM/yyyy")
                              ) : (
                                <span>בחר תאריך</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showLostReason && (
                  <FormField
                    control={form.control}
                    name="lost_reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium">פרטי סגירה / סיבת אובדן</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={2} placeholder="האם נסגר בהצלחה או אבד? פרטים..." className="text-right rounded-lg border-2 px-4 py-3" dir="rtl" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <Button type="submit" disabled={updateMutation.isPending} className="w-full">
                  {updateMutation.isPending ? "מעדכן..." : "עדכן הצעות מחיר"}
                </Button>
              </TabsContent>

              {/* Tab 3: Schedule Meeting */}
              <TabsContent value="meeting" className="space-y-4 mt-0">
                <div className="space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    קביעת פגישה חדשה
                  </h4>

                  {!lead.email && (
                    <Alert variant="default" className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 dark:text-amber-400">
                        לליד זה אין כתובת אימייל. ניתן לקבוע פגישה ביומן אך לא לשלוח זימון במייל.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Calendar Side */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium">בחר תאריך</label>
                      <Card className="p-2">
                        <Calendar
                          mode="single"
                          selected={meetingDate}
                          onSelect={setMeetingDate}
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
                          שעת הפגישה
                        </label>
                        <Select value={meetingTime} onValueChange={setMeetingTime}>
                          <SelectTrigger className="w-full text-right rounded-lg border-2 h-11">
                            <SelectValue placeholder="בחר שעה" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-[200px]">
                            {timeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">נושא הפגישה</label>
                        <Input
                          value={meetingSubject}
                          onChange={(e) => setMeetingSubject(e.target.value)}
                          placeholder={`פגישה עם ${lead.contact_name || lead.company_name}`}
                          className="text-right rounded-lg border-2 h-11 px-4"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">הודעה אישית (אופציונלי)</label>
                        <Textarea
                          value={personalMessage}
                          onChange={(e) => setPersonalMessage(e.target.value)}
                          placeholder="הוסף הודעה אישית לזימון..."
                          rows={3}
                          className="text-right rounded-lg border-2 px-4 py-3"
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
                        onClick={handleScheduleMeeting}
                        disabled={!meetingDate || isSchedulingMeeting}
                        className="w-full h-11"
                      >
                        {isSchedulingMeeting ? (
                          "קובע פגישה..."
                        ) : lead.email ? (
                          <>
                            <Send className="h-4 w-4 ml-2" />
                            קבע פגישה ושלח זימון
                          </>
                        ) : (
                          <>
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            קבע פגישה ביומן
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: Updates */}
              <TabsContent value="updates" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">היסטוריית עדכונים</h4>
                    <span className="text-xs text-muted-foreground">
                      {leadUpdates?.length || 0} עדכונים
                    </span>
                  </div>

                  {/* Updates List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {leadUpdates?.map((update: any) => (
                      <Card key={update.id} className="p-3">
                        {editingUpdateId === update.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingUpdateContent}
                              onChange={(e) => setEditingUpdateContent(e.target.value)}
                              rows={3}
                              className="w-full text-right rounded-lg border-2 px-4 py-3"
                              dir="rtl"
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
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(update.created_at), "d בMMMM, HH:mm", { locale: he })}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">
                                {update.content}
                              </p>
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
                                  className="h-7 w-7 text-destructive"
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
                    {(!leadUpdates || leadUpdates.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        אין עדכונים עדיין
                      </p>
                    )}
                  </div>

                  {/* Add New Update */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Textarea
                      value={newUpdate}
                      onChange={(e) => setNewUpdate(e.target.value)}
                      placeholder="הוסף עדכון חדש..."
                      rows={3}
                      className="flex-1 text-right rounded-lg border-2 px-4 py-3"
                      dir="rtl"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleAddUpdate}
                      disabled={!newUpdate.trim() || addUpdateMutation.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
