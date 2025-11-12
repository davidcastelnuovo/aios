import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Info } from "lucide-react";

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
  webhook_url: z.string().optional(),
  webhook_method: z.enum(["POST", "GET", "PUT"]).optional(),
  body_template: z.string().optional(),
  conditions: z.string().optional(),
  status_entity: z.enum(["lead", "task"]).optional(),
  status_value: z.string().optional(),
  trigger_status_value: z.string().optional(),
  update_field_name: z.string().optional(),
  update_field_value: z.string().optional(),
}).refine((data) => {
  if (data.action_type === "webhook" && !data.webhook_url) {
    return false;
  }
  if (data.action_type === "update_status" && !data.status_value) {
    return false;
  }
  return true;
}, {
  message: "נא למלא את כל השדות הנדרשים",
  path: ["action_type"],
});

type FormValues = z.infer<typeof formSchema>;

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

interface EditAutomationDialogProps {
  automation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAutomationDialog({ automation, open, onOpenChange }: EditAutomationDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: automation.name || "",
      description: automation.description || "",
      trigger_type: automation.trigger_type,
      action_type: automation.action_type,
      webhook_method: automation.configuration?.method || "POST",
      webhook_url: automation.configuration?.url || "",
      body_template: automation.configuration?.body_template || "",
      conditions: automation.conditions ? JSON.stringify(automation.conditions, null, 2) : "",
      status_entity: automation.configuration?.entity || "lead",
      status_value: automation.configuration?.status || "",
      trigger_status_value: automation.conditions?.new_status || "any",
      update_field_name: automation.configuration?.update_field || "none",
      update_field_value: automation.configuration?.update_field_value || "today",
    },
  });

  const updateAutomationMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      let conditions: any = null;
      if (values.conditions) {
        try {
          conditions = JSON.parse(values.conditions);
        } catch (e) {
          throw new Error("JSON לא תקין בתנאים");
        }
      } else {
        conditions = {};
      }
      
      // Add trigger status condition if specified
      if (values.trigger_status_value && values.trigger_status_value !== 'any') {
        conditions.new_status = values.trigger_status_value;
      }

      let configuration: any = {};
      if (values.action_type === "webhook") {
        configuration = {
          url: values.webhook_url,
          method: values.webhook_method || "POST",
          headers: { "Content-Type": "application/json" },
          body_template: values.body_template || "",
        };
      } else if (values.action_type === "update_status") {
        let cfg: any = {
          entity: values.status_entity,
          status: values.status_value,
        };
        if (values.update_field_name && values.update_field_name !== 'none') {
          cfg.update_field = values.update_field_name;
          cfg.update_field_value = values.update_field_value || 'today';
        }
        configuration = cfg;
      }

      const { error } = await supabase
        .from("automations")
        .update({
          name: values.name,
          description: values.description,
          trigger_type: values.trigger_type,
          action_type: values.action_type,
          configuration: configuration,
          conditions: conditions,
        })
        .eq("id", automation.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast.success("האוטומציה עודכנה בהצלחה");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`שגיאה: ${error.message}`);
    },
  });

  const onSubmit = (values: FormValues) => {
    console.log('Form submitted with values:', values);
    console.log('Form errors:', form.formState.errors);
    updateAutomationMutation.mutate(values);
  };

  const actionType = form.watch("action_type");
  const statusEntity = form.watch("status_entity");
  const triggerType = form.watch("trigger_type");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת אוטומציה</DialogTitle>
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
                    <Input {...field} placeholder="התראה על משימות חדשות" />
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
                  <FormLabel>תיאור (אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} placeholder="תיאור קצר של מה האוטומציה עושה" />
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
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="task_assigned">משימה שוייכה</SelectItem>
                      <SelectItem value="task_status_changed">סטטוס משימה השתנה</SelectItem>
                      <SelectItem value="lead_status_changed">סטטוס ליד השתנה</SelectItem>
                      <SelectItem value="lead_created">ליד נוצר</SelectItem>
                      <SelectItem value="client_created">לקוח נוצר</SelectItem>
                      <SelectItem value="client_status_changed">סטטוס לקוח השתנה</SelectItem>
                      <SelectItem value="onboarding_status_changed">סטטוס קליטה השתנה</SelectItem>
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
                        <SelectItem value="any">כל סטטוס</SelectItem>
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
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="webhook">Webhook (Make.com, Zapier וכו')</SelectItem>
                      <SelectItem value="update_status">שינוי סטטוס</SelectItem>
                      <SelectItem value="email">אימייל (בקרוב)</SelectItem>
                      <SelectItem value="notification">התראה (בקרוב)</SelectItem>
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
                        <Input {...field} placeholder="https://hook.eu2.make.com/..." />
                      </FormControl>
                      <FormDescription className="text-xs">
                        כתובת ה-Webhook של Make.com, Zapier או שירות אחר
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
                        <SelectContent className="bg-background">
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
                          {...field}
                          rows={6}
                          placeholder='{"task_title": "{{task_title}}", "campaigner_name": "{{campaigner_name}}"}'
                          className="font-mono text-xs"
                        />
                      </FormControl>
                      <FormDescription className="text-xs flex items-start gap-1">
                        <Info className="h-3 w-3 mt-0.5 shrink-0" />
                        <span>
                          השתמש ב-{`{{variable}}`} כדי להחליף ערכים דינמיים. 
                          לדוגמה: {`{{task_title}}`}, {`{{campaigner_name}}`}, {`{{client_name}}`}, {`{{priority}}`}
                        </span>
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
                      <Select onValueChange={field.onChange} value={field.value}>
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
                          <SelectItem value="none">ללא</SelectItem>
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
                  <FormLabel>תנאים (JSON - אופציונלי)</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      placeholder='{"status": "high"}'
                      className="font-mono text-xs"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    האוטומציה תופעל רק אם התנאים האלה מתקיימים (פורמט JSON)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={updateAutomationMutation.isPending} className="flex-1">
                {updateAutomationMutation.isPending ? "שומר..." : "שמור שינויים"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
