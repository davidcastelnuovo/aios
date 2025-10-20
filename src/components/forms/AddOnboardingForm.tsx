import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  title: z.string().min(1, "כותרת היא שדה חובה"),
  notes: z.string().optional(),
  campaigner_id: z.string().min(1, "איש צוות הוא שדה חובה"),
  client_id: z.string().min(1, "לקוח הוא שדה חובה"),
  due_date: z.string().optional(),
  status: z.enum(["research_meeting", "receiving_access", "setup_and_content", "campaign_live"]),
});

type FormValues = z.infer<typeof formSchema>;

interface AddOnboardingFormProps {
  clientId?: string;
  agencyId?: string;
}

export default function AddOnboardingForm({ clientId, agencyId }: AddOnboardingFormProps) {
  const [open, setOpen] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      notes: "",
      campaigner_id: "",
      client_id: clientId || "",
      due_date: "",
      status: "research_meeting",
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-for-onboarding", agencyId],
    queryFn: async () => {
      let query = supabase.from("clients").select("id, name, agency_id").order("name");
      
      if (agencyId) {
        query = query.eq("agency_id", agencyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const createOnboardingMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const client = clients?.find((c) => c.id === values.client_id);
      if (!client) throw new Error("Client not found");

      const { error } = await supabase.from("client_onboarding").insert([
        {
          title: values.title,
          notes: values.notes || null,
          campaigner_id: values.campaigner_id,
          client_id: values.client_id,
          agency_id: client.agency_id,
          due_date: values.due_date || null,
          status: values.status,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success("תהליך קליטה נוסף בהצלחה");
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error("שגיאה בהוספת תהליך קליטה");
      console.error(error);
    },
  });

  const onSubmit = (values: FormValues) => {
    createOnboardingMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          הוסף תהליך קליטה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוסף תהליך קליטה חדש</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>כותרת</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="כותרת התהליך" />
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
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="הערות נוספות" rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="campaigner_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>איש צוות</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר איש צוות" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
              name="client_id"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>לקוח</FormLabel>
                  <Popover open={clientOpen} onOpenChange={setClientOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("justify-between", !field.value && "text-muted-foreground")}
                        >
                          {field.value
                            ? clients?.find((client) => client.id === field.value)?.name
                            : "בחר לקוח"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
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
                                  setClientOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    client.id === field.value ? "opacity-100" : "opacity-0"
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="research_meeting">פגישת מחקר</SelectItem>
                      <SelectItem value="receiving_access">קבלת גישות וחומרים</SelectItem>
                      <SelectItem value="setup_and_content">הקמות ויצירת תוכן</SelectItem>
                      <SelectItem value="campaign_live">קמפיין באוויר</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={createOnboardingMutation.isPending}>
              {createOnboardingMutation.isPending ? "מוסיף..." : "הוסף תהליך קליטה"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
