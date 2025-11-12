import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  campaigner_id: z.string().min(1, "יש לבחור קמפיינר"),
  task_category: z.enum(["client", "general"]),
  client_id: z.string().optional(),
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
});

interface AddTaskFormProps {
  clientId?: string;
  agencyId?: string;
  defaultCampaignerId?: string;
  triggerButton?: React.ReactNode;
}

export default function AddTaskForm({ clientId, agencyId, defaultCampaignerId, triggerButton }: AddTaskFormProps) {
  const [open, setOpen] = useState(false);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [taskCategory, setTaskCategory] = useState<"client" | "general">(clientId ? "client" : "general");
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      notes: "",
      campaigner_id: defaultCampaignerId || "",
      task_category: clientId ? "client" : "general",
      client_id: clientId || "",
      agency_id: agencyId || "",
      due_date: "",
      status: "open",
      priority: 5,
    },
  });

  // Update form when clientId or defaultCampaignerId changes
  useEffect(() => {
    if (clientId) {
      form.setValue("client_id", clientId);
    }
    if (defaultCampaignerId) {
      form.setValue("campaigner_id", defaultCampaignerId);
    }
  }, [clientId, defaultCampaignerId, form]);

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

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      let selectedClient = null;
      let finalAgencyId = null;

      if (values.task_category === "client") {
        // Get agency_id from the selected client
        selectedClient = clients?.find(c => c.id === values.client_id);
        if (!selectedClient?.agency_id) {
          throw new Error("הלקוח שנבחר לא משויך לסוכנות");
        }
        finalAgencyId = selectedClient.agency_id;
      } else {
        // For general tasks, agency is optional
        finalAgencyId = values.agency_id || null;
      }

      // Get campaigner name
      const selectedCampaigner = campaigners?.find(c => c.id === values.campaigner_id);
      
      // Get tenant_id
      let tenantId: string;
      if (values.task_category === "client" && selectedClient) {
        tenantId = selectedClient.tenant_id;
      } else if (values.task_category === "general" && values.agency_id) {
        const selectedAgency = agencies?.find(a => a.id === values.agency_id);
        if (!selectedAgency?.tenant_id) throw new Error("הסוכנות לא משויכת לטנט");
        tenantId = selectedAgency.tenant_id;
      } else {
        // For general tasks without agency, get tenant from current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("משתמש לא מחובר");
        
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        
        if (tenantError || !tenantData) throw new Error("לא נמצא טנט למשתמש");
        tenantId = tenantData.tenant_id;
      }
      
      const { error } = await supabase.from("tasks").insert([{
        title: values.title,
        notes: values.notes || null,
        campaigner_id: values.campaigner_id,
        client_id: values.task_category === "client" ? values.client_id : null,
        agency_id: finalAgencyId,
        due_date: values.due_date || null,
        status: values.status,
        priority: values.priority,
        task_type: "other",
        tenant_id: tenantId,
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
            campaigner_name: selectedCampaigner?.full_name || '',
            client_name: selectedClient ? selectedClient.name : 'משימה כללית',
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
                      setTaskCategory(value as "client" | "general");
                    }} 
                    value={field.value}
                    disabled={!!clientId}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוג משימה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-50">
                      <SelectItem value="client">משימה ללקוח</SelectItem>
                      <SelectItem value="general">משימה כללית</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="campaigner_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>קמפיינר</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר קמפיינר" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        {campaigners?.map((campaigner) => (
                          <SelectItem key={campaigner.id} value={campaigner.id}>
                            {campaigner.full_name}
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

            {taskCategory === "client" ? (
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
            ) : (
              <FormField
                control={form.control}
                name="agency_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>סוכנות (אופציונלי)</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!agencyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוכנות (אופציונלי)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="">ללא סוכנות</SelectItem>
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
            )}

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

            <Button type="submit" disabled={mutation.isPending} className="w-full">
              {mutation.isPending ? "מוסיף..." : "הוסף משימה"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
