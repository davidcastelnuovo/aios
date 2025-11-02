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
  priority: z.enum(["low", "medium", "high"]),
}).refine((data) => {
  if (data.task_category === "client" && !data.client_id) {
    return false;
  }
  if (data.task_category === "general" && !data.agency_id) {
    return false;
  }
  return true;
}, {
  message: "יש לבחור לקוח למשימת לקוח או סוכנות למשימה כללית",
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
      priority: "medium",
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
        // For general tasks, use the selected agency
        if (!values.agency_id) {
          throw new Error("יש לבחור סוכנות למשימה כללית");
        }
        finalAgencyId = values.agency_id;
      }

      // Get campaigner name
      const selectedCampaigner = campaigners?.find(c => c.id === values.campaigner_id);
      
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
      }]);
      if (error) throw error;

      // Get tenant_id for automation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: tenantUser } = await supabase
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        if (tenantUser) {
          // Trigger automation
          await supabase.functions.invoke('trigger-automation', {
            body: {
              trigger_type: 'task_assigned',
              tenant_id: tenantUser.tenant_id,
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
        }
      }
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
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>דחיפות</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(
                          "border-0 text-white font-medium",
                          field.value === "high" && "bg-red-400 hover:bg-red-500",
                          field.value === "medium" && "bg-orange-400 hover:bg-orange-500",
                          field.value === "low" && "bg-purple-400 hover:bg-purple-500",
                          !field.value && "bg-muted text-muted-foreground"
                        )}>
                          <SelectValue placeholder="בחר דחיפות" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="high" className="text-red-600 focus:text-red-600 focus:bg-red-50">גבוה</SelectItem>
                        <SelectItem value="medium" className="text-orange-600 focus:text-orange-600 focus:bg-orange-50">בינוני</SelectItem>
                        <SelectItem value="low" className="text-purple-600 focus:text-purple-600 focus:bg-purple-50">נמוך</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
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
                    <FormLabel>סוכנות</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={!!agencyId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="בחר סוכנות" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
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
