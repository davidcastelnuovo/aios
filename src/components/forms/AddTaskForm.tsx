import { useForm } from "react-hook-form";
import { useState, useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCustomFieldLabels } from "@/hooks/useCustomFieldLabels";
import { useUserRole } from "@/hooks/useUserRole";
import { useTerminology } from "@/hooks/useTerminology";
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
import { ChevronDown, ChevronUp, Check, ChevronsUpDown, Plus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formSchema = z.object({
  title: z.string().min(1, "שם המשימה הוא שדה חובה"),
  notes: z.string().optional(),
  campaigner_id: z.string().optional(), // Optional for quick tasks - will be auto-filled
  sales_person_id: z.string().optional(),
  task_category: z.enum(["client", "lead", "quick"]),
  client_id: z.string().optional(),
  lead_id: z.string().optional(),
  agency_id: z.string().optional(),
  due_date: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]),
  priority: z.number().min(1).max(10),
}).refine((data) => {
  // Only require client for client tasks
  if (data.task_category === "client" && !data.client_id) {
    return false;
  }
  return true;
}, {
  message: "יש לבחור לקוח למשימת לקוח",
  path: ["client_id"],
}).refine((data) => {
  // Only require lead for lead tasks
  if (data.task_category === "lead" && !data.lead_id) {
    return false;
  }
  return true;
}, {
  message: "יש לבחור ליד למשימת ליד",
  path: ["lead_id"],
}).refine((data) => {
  // For client/lead tasks, require either campaigner OR sales person
  if ((data.task_category === "client" || data.task_category === "lead") && !data.campaigner_id && !data.sales_person_id) {
    return false;
  }
  return true;
}, {
  message: "יש לבחור איש צוות אחראי",
  path: ["campaigner_id"],
});

interface AddTaskFormProps {
  clientId?: string;
  leadId?: string;
  agencyId?: string;
  defaultCampaignerId?: string;
  triggerButton?: React.ReactNode;
}

export default function AddTaskForm({ clientId, leadId, agencyId, defaultCampaignerId, triggerButton }: AddTaskFormProps) {
  const [open, setOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [leadPopoverOpen, setLeadPopoverOpen] = useState(false);
  const [taskCategory, setTaskCategory] = useState<"client" | "lead" | "quick">(
    leadId ? "lead" : clientId ? "client" : "client"
  );
  const queryClient = useQueryClient();
  const { tenantId: currentTenantId } = useCurrentTenant();
  const { getFieldLabel } = useCustomFieldLabels('task');
  const { isCampaigner, isTeamManager, isOwner, isSuperAdmin, campaignerId: userCampaignerId } = useUserRole();
  const { t } = useTerminology();

  // Determine default campaigner - any user with a linked campaigner_id gets themselves as default
  const effectiveCampaignerId = defaultCampaignerId || userCampaignerId || "";

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      notes: "",
      campaigner_id: effectiveCampaignerId,
      sales_person_id: "",
      task_category: leadId ? "lead" : clientId ? "client" : "client",
      client_id: clientId || "",
      lead_id: leadId || "",
      agency_id: agencyId || "",
      due_date: "",
      status: "open",
      priority: 5,
    },
  });

  // Update form when clientId, leadId, defaultCampaignerId or userCampaignerId changes
  useEffect(() => {
    if (clientId) {
      form.setValue("client_id", clientId);
      form.setValue("task_category", "client");
      setTaskCategory("client");
    }
    if (leadId) {
      form.setValue("lead_id", leadId);
      form.setValue("task_category", "lead");
      setTaskCategory("lead");
    }
    if (defaultCampaignerId) {
      form.setValue("campaigner_id", defaultCampaignerId);
    } else if (userCampaignerId && !form.getValues("campaigner_id")) {
      form.setValue("campaigner_id", userCampaignerId);
    }
  }, [clientId, leadId, defaultCampaignerId, userCampaignerId, isCampaigner, form]);

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

  // Filter campaigners - campaigners only see themselves, team_manager+ sees all
  const canSelectAnyCampaigner = isOwner || isTeamManager || isSuperAdmin;
  const visibleCampaigners = useMemo(() => {
    if (!campaigners) return [];
    if (canSelectAnyCampaigner) return campaigners;
    // Campaigners only see themselves
    if (isCampaigner && userCampaignerId) {
      return campaigners.filter(c => c.id === userCampaignerId);
    }
    return campaigners;
  }, [campaigners, canSelectAnyCampaigner, isCampaigner, userCampaignerId]);

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

  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("company_name");
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

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let selectedClient = null;
      let selectedLead = null;
      let finalAgencyId: string | null = null;
      let finalCampaignerId = values.campaigner_id;
      let entityName = 'משימה כללית';

      if (values.task_category === "client") {
        // Get agency_id from the selected client
        selectedClient = clients?.find(c => c.id === values.client_id);
        if (!selectedClient?.agency_id) {
          throw new Error("הלקוח שנבחר לא משויך לסוכנות");
        }
        finalAgencyId = selectedClient.agency_id;
        entityName = selectedClient.name;
      } else if (values.task_category === "lead") {
        // Get lead from DB (avoid stale UI state) to ensure FK exists
        const { data: leadRow, error: leadError } = await supabase
          .from("leads")
          .select("id, tenant_id, agency_id, company_name, contact_name")
          .eq("id", values.lead_id)
          .maybeSingle();

        if (leadError) throw leadError;
        if (!leadRow?.id) {
          throw new Error("הליד לא נמצא (כנראה נמחק/הומר ללקוח). רענן את הדף ונסה שוב.");
        }

        selectedLead = leadRow;

        if (selectedLead.agency_id) {
          finalAgencyId = selectedLead.agency_id;
        } else if (agencies && agencies.length > 0) {
          // Fallback to first available agency
          finalAgencyId = agencies[0].id;
        }
        entityName = selectedLead.company_name || selectedLead.contact_name || 'ליד';
        if (!finalAgencyId) {
          throw new Error("לא נמצאה סוכנות לשיוך המשימה");
        }
      } else {
        // For quick tasks - auto-assign to current user's campaigner if available
        if (!finalCampaignerId && userCampaignerId) {
          finalCampaignerId = userCampaignerId;
        }
        // If still no campaigner, use the first available one (optional for quick tasks)
        if (!finalCampaignerId && campaigners && campaigners.length > 0) {
          finalCampaignerId = campaigners[0].id;
        }
        // Quick tasks don't require a campaigner - can proceed without one
        
        // For quick tasks - get agency from the selected campaigner if available
        if (finalCampaignerId) {
          const { data: campaignerAgencies } = await supabase
            .from("campaigner_agencies")
            .select("agency_id")
            .eq("campaigner_id", finalCampaignerId)
            .limit(1);
          
          if (campaignerAgencies && campaignerAgencies.length > 0) {
            finalAgencyId = campaignerAgencies[0].agency_id;
          }
        }
        // Fallback to first available agency if none found
        if (!finalAgencyId && agencies && agencies.length > 0) {
          finalAgencyId = agencies[0].id;
        }
        if (!finalAgencyId) {
          throw new Error("לא נמצאה סוכנות לשיוך המשימה");
        }
      }

      // Get campaigner name
      const selectedCampaigner = campaigners?.find(c => c.id === finalCampaignerId);
      
      // ALWAYS use current tenant - tasks should appear where user is working
      if (!currentTenantId) throw new Error("לא נמצא טנט פעיל");
      const tenantId = currentTenantId;
      
      // Get current user ID for created_by field
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserId = sessionData?.session?.user?.id;

      const { error } = await supabase.from("tasks").insert([{
        title: values.title,
        notes: values.notes || null,
        campaigner_id: finalCampaignerId || null,
        sales_person_id: values.sales_person_id || null,
        client_id: values.task_category === "client" ? values.client_id : null,
        lead_id: values.task_category === "lead" ? values.lead_id : null,
        agency_id: finalAgencyId,
        due_date: values.due_date || null,
        status: values.status,
        priority: values.priority,
        task_type: "other",
        tenant_id: tenantId,
        created_by: currentUserId,
      }]);
      if (error) throw error;

      // Trigger automation
      await supabase.functions.invoke('trigger-automation', {
        body: {
          trigger_type: 'task_assigned',
          tenant_id: tenantId,
          data: {
            task_title: values.title,
            task_notes: values.notes || '',
            campaigner_id: finalCampaignerId || '',
            campaigner_name: selectedCampaigner?.full_name || '',
            campaigner_phone: selectedCampaigner?.phone || '',
            campaigner_whatsapp_group_id: selectedCampaigner?.whatsapp_group_id || '',
            client_name: entityName,
            priority: values.priority,
            status: values.status,
            due_date: values.due_date || '',
          }
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success("המשימה נוספה בהצלחה ותופיע במודול משימות");
      form.reset();
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהוספת משימה: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            משימה חדשה
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספת משימה חדשה</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת המשימה</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>תיאור משימה</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="task_category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג משימה</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setTaskCategory(value as "client" | "lead" | "quick");
                    }} 
                    value={field.value}
                    disabled={!!clientId || !!leadId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג משימה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="client">משימה ללקוח</SelectItem>
                      <SelectItem value="lead">משימה לליד</SelectItem>
                      <SelectItem value="quick">משימה מהירה</SelectItem>
                    </SelectContent>
                  </Select>
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
                  ...(visibleCampaigners?.map(c => ({ id: c.id, prefixedId: `campaigner:${c.id}`, name: c.full_name, type: 'campaigner' as const })) || []),
                  ...(salesPeople?.map(s => ({ id: s.id, prefixedId: `sales:${s.id}`, name: s.full_name, type: 'sales' as const })) || []),
                ];
                
                // Find selected member
                const selectedMember = allTeamMembers.find(m => 
                  (m.type === 'campaigner' && m.id === field.value) ||
                  (m.type === 'sales' && m.id === form.getValues('sales_person_id'))
                );
                
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>איש צוות אחראי</FormLabel>
                    <Popover open={teamMemberPopoverOpen} onOpenChange={setTeamMemberPopoverOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between",
                              !selectedMember && "text-muted-foreground"
                            )}
                            disabled={isCampaigner && !canSelectAnyCampaigner}
                          >
                            <span className="text-right flex-1">{selectedMember ? selectedMember.name : "בחר איש צוות"}</span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 bg-background" align="end" dir="rtl">
                        <Command>
                          <CommandInput placeholder="חפש איש צוות..." />
                          <CommandList>
                            <CommandEmpty>לא נמצאו אנשי צוות</CommandEmpty>
                            {visibleCampaigners && visibleCampaigners.length > 0 && (
                              <CommandGroup heading={t('role_campaigner', true)}>
                                {visibleCampaigners.map((campaigner) => (
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
                              <CommandGroup heading={t('role_sales_person', true)}>
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

            {/* Show additional fields only for client tasks */}
            {taskCategory === "client" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
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
                          <FormLabel>דחיפות</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="client_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>לקוח</FormLabel>
                      <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={!!clientId}
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? clients?.find((client) => client.id === field.value)?.name
                                : "בחר לקוח"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
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
              </>
            )}

            {/* Show lead selector for lead tasks */}
            {taskCategory === "lead" && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
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
                          <FormLabel>דחיפות</FormLabel>
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
                </div>

                <FormField
                  control={form.control}
                  name="lead_id"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>ליד</FormLabel>
                      <Popover open={leadPopoverOpen} onOpenChange={setLeadPopoverOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={!!leadId}
                              className={cn(
                                "justify-between",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value
                                ? leads?.find((lead) => lead.id === field.value)?.company_name || leads?.find((lead) => lead.id === field.value)?.contact_name
                                : "בחר ליד"}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0 bg-background" align="start">
                          <Command>
                            <CommandInput placeholder="חפש ליד..." />
                            <CommandList>
                              <CommandEmpty>לא נמצאו לידים</CommandEmpty>
                              <CommandGroup>
                                {leads?.map((lead) => (
                                  <CommandItem
                                    key={lead.id}
                                    value={`${lead.company_name} ${lead.contact_name || ''}`}
                                    onSelect={() => {
                                      form.setValue("lead_id", lead.id);
                                      setLeadPopoverOpen(false);
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        field.value === lead.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col">
                                      <span>{lead.company_name}</span>
                                      {lead.contact_name && (
                                        <span className="text-xs text-muted-foreground">{lead.contact_name}</span>
                                      )}
                                    </div>
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
              </>
            )}

            {/* Quick task info message */}
            {taskCategory === "quick" && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                משימה מהירה תשויך אליך אוטומטית עם דחיפות בינונית
              </div>
            )}

            {/* Show additional fields for client/lead tasks */}
            {(taskCategory === "client" || taskCategory === "lead") && (
              <>
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>תאריך יעד</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סטטוס</FormLabel>
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
              </>
            )}

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "מוסיף..." : "הוסף משימה"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
