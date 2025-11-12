import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Info } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "שם האוטומציה הוא שדה חובה"),
  description: z.string().optional(),
  trigger_type: z.enum([
    "task_assigned",
    "task_status_changed",
    "lead_status_changed",
    "lead_created",
    "client_created",
    "client_status_changed",
    "onboarding_status_changed",
  ]),
  action_type: z.enum(["webhook", "email", "notification", "update_status"]),
  webhook_url: z.string().url("כתובת URL לא תקינה").optional(),
  webhook_method: z.enum(["POST", "GET", "PUT"]).optional(),
  body_template: z.string().optional(),
  conditions: z.string().optional(), // JSON string
  status_entity: z.enum(["lead", "task"]).optional(),
  status_value: z.string().optional(),
  trigger_status_value: z.string().optional(), // For status change triggers
  update_field_name: z.string().optional(), // Field to update
  update_field_value: z.string().optional(), // Value to set
});

type FormValues = z.infer<typeof formSchema>;

const TRIGGER_OPTIONS = [
  { value: "task_assigned", label: "משימה שוייכה" },
  { value: "task_status_changed", label: "סטטוס משימה השתנה" },
  { value: "lead_status_changed", label: "סטטוס ליד השתנה" },
  { value: "lead_created", label: "ליד נוצר" },
  { value: "client_created", label: "לקוח נוצר" },
  { value: "client_status_changed", label: "סטטוס לקוח השתנה" },
  { value: "onboarding_status_changed", label: "סטטוס קליטה השתנה" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "ליד חדש" },
  { value: "contacted", label: "נוצר קשר" },
  { value: "follow_up", label: "בתהליך" },
  { value: "proposal_sent", label: "נשלחה הצעה" },
  { value: "closed", label: "נסגר" },
  { value: "transferred_to_onboarding", label: "הועבר לקליטה" },
];

const TASK_STATUS_OPTIONS = [
  { value: "open", label: "פתוח" },
  { value: "in_progress", label: "בתהליך" },
  { value: "done", label: "הושלם" },
];

const LEAD_DATE_FIELDS = [
  { value: "won_date", label: "תאריך נסגר" },
  { value: "proposal_sent_date", label: "תאריך שליחת הצעה" },
  { value: "itai_meeting_date", label: "תאריך פגישה עם איתי" },
];

const TASK_DATE_FIELDS = [
  { value: "due_date", label: "תאריך יעד" },
];

export function AddAutomationForm() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "task_assigned",
      action_type: "webhook",
      webhook_method: "POST",
      webhook_url: "",
      body_template: "",
      conditions: "",
      status_entity: "lead",
      status_value: "",
      trigger_status_value: "",
      update_field_name: "",
      update_field_value: "today",
    },
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!tenantUser) throw new Error("No tenant found");

      // Parse conditions if provided
      let conditions: any = {};
      if (values.conditions?.trim()) {
        try {
          conditions = JSON.parse(values.conditions);
        } catch (e) {
          throw new Error("תנאים חייבים להיות JSON תקין");
        }
      }
      
      // Add trigger status condition if specified
      if (values.trigger_status_value) {
        conditions.new_status = values.trigger_status_value;
      }

      // Build configuration based on action type
      let configuration: any = {};
      if (values.action_type === "webhook") {
        configuration = {
          url: values.webhook_url,
          method: values.webhook_method || "POST",
          headers: { "Content-Type": "application/json" },
          body_template: values.body_template || "",
        };
      } else if (values.action_type === "update_status") {
        configuration = {
          entity: values.status_entity,
          status: values.status_value,
          update_field: values.update_field_name,
          update_field_value: values.update_field_value,
        };
      }

      const { data, error } = await supabase
        .from("automations")
        .insert({
          name: values.name,
          description: values.description,
          trigger_type: values.trigger_type,
          action_type: values.action_type,
          configuration: configuration,
          conditions: conditions,
          tenant_id: tenantUser.tenant_id,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "אוטומציה נוספה בהצלחה",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה ביצירת אוטומציה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    createAutomationMutation.mutate(values);
  };

  const actionType = form.watch("action_type");
  const statusEntity = form.watch("status_entity");
  const triggerType = form.watch("trigger_type");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full md:w-auto">
          <Plus className="h-4 w-4 ml-2" />
          אוטומציה חדשה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>יצירת אוטומציה חדשה</DialogTitle>
          <DialogDescription>
            הגדר טריגר ופעולה שיתבצעו אוטומטית
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם האוטומציה *</FormLabel>
                  <FormControl>
                    <Input placeholder="שלח webhook כשמשימה משוייכת" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תיאור</FormLabel>
                  <FormControl>
                    <Textarea placeholder="תיאור קצר..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>מתי להפעיל? *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר טריגר" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-[100]">
                      {TRIGGER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(triggerType === "lead_status_changed" || triggerType === "task_status_changed") && (
              <FormField
                control={form.control}
                name="trigger_status_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>לאיזה סטטוס השתנה? (אופציונלי)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="כל סטטוס (ללא סינון)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="">כל סטטוס</SelectItem>
                        {triggerType === "lead_status_changed" && LEAD_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                        {triggerType === "task_status_changed" && TASK_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      האוטומציה תרוץ רק כשהסטטוס משתנה לערך זה
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="action_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג פעולה *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר פעולה" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background z-[100]">
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="update_status">שינוי סטטוס</SelectItem>
                      <SelectItem value="email" disabled>אימייל (בקרוב)</SelectItem>
                      <SelectItem value="notification" disabled>התראה (בקרוב)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {actionType === "webhook" && (
              <>
                <FormField
                  control={form.control}
                  name="webhook_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://hooks.zapier.com/..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        כתובת ה-webhook שיקבל את הנתונים
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="webhook_method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HTTP Method</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="body_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Body Template (JSON)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder='{"task_id": "{{id}}", "title": "{{title}}"}'
                          rows={4}
                          className="font-mono text-xs"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        השתמש ב-{`{{variable}}`} להחליף ערכים. אם ריק, כל הנתונים יישלחו.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {actionType === "update_status" && (
              <>
                <FormField
                  control={form.control}
                  name="status_entity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סוג רשומה *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר סוג רשומה" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="lead">ליד</SelectItem>
                          <SelectItem value="task">משימה</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="status_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>סטטוס חדש *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר סטטוס" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          {statusEntity === "lead" && LEAD_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {statusEntity === "task" && TASK_STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        הסטטוס יעודכן אוטומטית כשהאוטומציה תופעל
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="update_field_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>עדכון שדה תאריך נוסף (אופציונלי)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="אל תעדכן שדה נוסף" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="">ללא</SelectItem>
                          {statusEntity === "lead" && LEAD_DATE_FIELDS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                          {statusEntity === "task" && TASK_DATE_FIELDS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        שדה תאריך שיעודכן לתאריך היום כשהאוטומציה תופעל
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תנאים (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder='{"priority": "high", "status": "open"}'
                      rows={3}
                      className="font-mono text-xs"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-xs flex items-start gap-1">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>JSON של תנאים. האוטומציה תרוץ רק אם כל התנאים מתקיימים.</span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={createAutomationMutation.isPending}>
                {createAutomationMutation.isPending ? "יוצר..." : "צור אוטומציה"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
