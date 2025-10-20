import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
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

interface OnboardingItem {
  id: string;
  title: string;
  notes: string | null;
  campaigner_id: string;
  client_id: string;
  due_date: string | null;
  status: "research_meeting" | "receiving_access" | "setup_and_content" | "campaign_live";
}

interface EditOnboardingDialogProps {
  item: OnboardingItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditOnboardingDialog({ item, open, onOpenChange }: EditOnboardingDialogProps) {
  const [clientOpen, setClientOpen] = useState(false);
  const queryClient = useQueryClient();

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
    queryKey: ["clients-for-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: item.title,
      notes: item.notes || "",
      campaigner_id: item.campaigner_id,
      client_id: item.client_id,
      due_date: item.due_date || "",
      status: item.status,
    },
  });

  const updateOnboardingMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase
        .from("client_onboarding")
        .update({
          title: values.title,
          notes: values.notes || null,
          campaigner_id: values.campaigner_id,
          client_id: values.client_id,
          due_date: values.due_date || null,
          status: values.status,
        })
        .eq("id", item.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success("תהליך קליטה עודכן בהצלחה");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("שגיאה בעדכון תהליך קליטה");
      console.error(error);
    },
  });

  const onSubmit = (values: FormValues) => {
    updateOnboardingMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ערוך תהליך קליטה</DialogTitle>
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

            <Button type="submit" className="w-full" disabled={updateOnboardingMutation.isPending}>
              {updateOnboardingMutation.isPending ? "מעדכן..." : "עדכן תהליך קליטה"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
