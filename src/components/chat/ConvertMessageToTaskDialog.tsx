import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const taskSchema = z.object({
  title: z.string().min(1, "כותרת היא שדה חובה"),
  agency_id: z.string().min(1, "סוכנות היא שדה חובה"),
  campaigner_id: z.string().min(1, "קמפיינר הוא שדה חובה"),
  client_id: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.number().min(1).max(10).default(5),
  notes: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface ConvertMessageToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageText: string;
  contactId?: string;
  contactType?: 'client' | 'lead' | 'group' | 'unknown';
  agencyId?: string;
}

export function ConvertMessageToTaskDialog({
  open,
  onOpenChange,
  messageText,
  contactId,
  contactType,
  agencyId,
}: ConvertMessageToTaskDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: messageText.slice(0, 50) + (messageText.length > 50 ? "..." : ""),
      notes: messageText,
      agency_id: agencyId || "",
      client_id: contactType === 'client' ? contactId : "",
      priority: 5,
    },
  });

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch clients for selected agency
  const selectedAgencyId = form.watch("agency_id");
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", tenantId, selectedAgencyId],
    queryFn: async () => {
      if (!tenantId || !selectedAgencyId) return [];
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .eq("agency_id", selectedAgencyId)
        .order("name");
      return data || [];
    },
    enabled: !!tenantId && !!selectedAgencyId && open,
  });

  // Fetch campaigners for selected agency
  const { data: campaigners = [] } = useQuery({
    queryKey: ["campaigners-for-agency", tenantId, selectedAgencyId],
    queryFn: async () => {
      if (!tenantId || !selectedAgencyId) return [];
      const { data } = await supabase
        .from("campaigner_agencies")
        .select("campaigner_id, campaigners(id, full_name)")
        .eq("agency_id", selectedAgencyId);
      
      return data?.map((ca: any) => ca.campaigners).filter(Boolean) || [];
    },
    enabled: !!tenantId && !!selectedAgencyId && open,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      if (!tenantId) throw new Error("No tenant");

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          tenant_id: tenantId,
          title: values.title,
          agency_id: values.agency_id,
          campaigner_id: values.campaigner_id,
          client_id: values.client_id || null,
          due_date: values.due_date || null,
          priority: values.priority,
          notes: values.notes,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("המשימה נוצרה בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Create task error:", error);
      toast.error("שגיאה ביצירת המשימה");
    },
  });

  const onSubmit = (values: TaskFormValues) => {
    createTaskMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>המרת הודעה למשימה</DialogTitle>
          <DialogDescription>
            צור משימה חדשה מתוכן ההודעה
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">כותרת המשימה</Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="כותרת קצרה למשימה"
            />
            {form.formState.errors.title && (
              <p className="text-sm text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agency_id">סוכנות</Label>
            <Select
              value={form.watch("agency_id")}
              onValueChange={(value) => {
                form.setValue("agency_id", value);
                form.setValue("campaigner_id", "");
                form.setValue("client_id", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר סוכנות" />
              </SelectTrigger>
              <SelectContent>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.agency_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.agency_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaigner_id">קמפיינר</Label>
            <Select
              value={form.watch("campaigner_id")}
              onValueChange={(value) => form.setValue("campaigner_id", value)}
              disabled={!selectedAgencyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר קמפיינר" />
              </SelectTrigger>
              <SelectContent>
                {campaigners.map((campaigner: any) => (
                  <SelectItem key={campaigner.id} value={campaigner.id}>
                    {campaigner.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.campaigner_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.campaigner_id.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_id">לקוח (אופציונלי)</Label>
            <Select
              value={form.watch("client_id") || "__none__"}
              onValueChange={(value) => form.setValue("client_id", value === "__none__" ? "" : value)}
              disabled={!selectedAgencyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="בחר לקוח" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">ללא לקוח</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="due_date">תאריך יעד (אופציונלי)</Label>
            <Input
              id="due_date"
              type="date"
              {...form.register("due_date")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">עדיפות (1-10)</Label>
            <Input
              id="priority"
              type="number"
              min="1"
              max="10"
              {...form.register("priority", { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">תוכן ההודעה</Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              rows={4}
              className="resize-none bg-muted"
              readOnly
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              צור משימה
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
