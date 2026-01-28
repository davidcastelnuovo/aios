import { useForm } from "react-hook-form";
import { useState } from "react";
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
import { Info, Copy, ExternalLink } from "lucide-react";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { MessageTemplateBuilder } from "./MessageTemplateBuilder";

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
    "meeting_created",
    "task_calendar_created",
    "task_overdue",
    "inbound_webhook_task",
    "inbound_webhook_lead",
  ]),
  action_type: z.enum(["webhook", "email", "notification", "update_status", "send_whatsapp", "create_manychat_subscriber", "send_greenapi_message", "send_greenapi_to_campaigner", "add_lead_update", "add_client_update", "create_task", "create_lead"]),
  // Green API connection selection
  green_api_integration_id: z.string().optional(),
  campaigner_send_target: z.enum(["phone", "group"]).optional(),
  // Green API manual target fields
  greenapi_send_to_type: z.enum(["contact", "manual_phone", "manual_group"]).optional(),
  greenapi_manual_phone: z.string().optional(),
  greenapi_manual_group_id: z.string().optional(),
  // Green API / update template fields
  message_template: z.string().optional(),
  update_template: z.string().optional(),
  webhook_url: z.string().optional(),
  webhook_method: z.enum(["POST", "GET", "PUT"]).optional(),
  body_template: z.string().optional(),
  conditions: z.string().optional(),
  status_entity: z.enum(["lead", "task"]).optional(),
  status_value: z.string().optional(),
  trigger_status_value: z.string().optional(),
  update_field_name: z.string().optional(),
  update_field_value: z.string().optional(),
  // ManyChat WhatsApp fields
  manychat_tag_id: z.string().optional(),
  field_mapping_date: z.string().optional(),
  field_mapping_time: z.string().optional(),
  field_mapping_location: z.string().optional(),
  field_mapping_contact: z.string().optional(),
  // Create task fields
  task_title_template: z.string().optional(),
  task_notes_template: z.string().optional(),
  task_priority: z.number().optional(),
  task_due_days: z.number().optional(),
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

// LEAD_STATUS_OPTIONS removed - now using dynamic statuses from useLeadStatuses hook

const TASK_STATUS_OPTIONS = [
  { value: "open", label: "פתוח" },
  { value: "in_progress", label: "בתהליך" },
  { value: "done", label: "הושלם" },
];

const LEAD_DATE_FIELDS = [
  { value: "won_date", label: "תאריך נסגר" },
  { value: "sale_date", label: "תאריך מכירה" },
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
  const { activeStatuses: leadStatuses } = useLeadStatuses();

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
      manychat_tag_id: automation.configuration?.manychat_tag_id || "",
      field_mapping_date: automation.configuration?.field_mapping?.date || "",
      field_mapping_time: automation.configuration?.field_mapping?.time || "",
      field_mapping_location: automation.configuration?.field_mapping?.location || "",
      field_mapping_contact: automation.configuration?.field_mapping?.contact || "",
      message_template: automation.configuration?.message_template || "",
      update_template: automation.configuration?.update_template || "אין מענה בתאריך {{date}} בשעה {{time}}",
      campaigner_send_target: automation.configuration?.send_target || "phone",
      green_api_integration_id: automation.configuration?.integration_id || "",
      greenapi_send_to_type: automation.configuration?.send_to_type || "contact",
      greenapi_manual_phone: automation.configuration?.manual_phone || "",
      greenapi_manual_group_id: automation.configuration?.manual_group_id || "",
      task_title_template: automation.configuration?.task_title_template || "{{company_name}} - משימה חדשה",
      task_notes_template: automation.configuration?.task_notes_template || "",
      task_priority: automation.configuration?.task_priority || 5,
      task_due_days: automation.configuration?.task_due_days || 0,
    },
  });

  // Fetch ManyChat tags
  const { data: manychatTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['manychat-tags', automation.tenant_id],
    queryFn: async () => {
      if (!automation.tenant_id) return [];
      const { data, error } = await supabase.functions.invoke('get-manychat-tags', {
        body: { tenantId: automation.tenant_id }
      });
      if (error) throw error;
      return Array.isArray(data?.tags) ? data.tags : [];
    },
    enabled: !!automation.tenant_id && (form.watch("action_type") === "send_whatsapp" || form.watch("action_type") === "create_manychat_subscriber"),
  });

  // Fetch Green API integrations - include both tenant integrations AND permitted integrations
  const { data: greenApiIntegrations } = useQuery({
    queryKey: ['green-api-integrations-for-automation', automation.tenant_id],
    queryFn: async () => {
      if (!automation.tenant_id) return [];
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Get tenant integrations
      const { data: tenantIntegrations, error: tenantError } = await supabase
        .from('tenant_integrations')
        .select('id, settings, user_id')
        .eq('tenant_id', automation.tenant_id)
        .eq('integration_type', 'green_api')
        .eq('is_active', true);
      
      if (tenantError) throw tenantError;
      
      // Get integrations the user has permission to use
      const { data: permissions } = await supabase
        .from('integration_user_permissions')
        .select('integration_id')
        .eq('user_id', user.id);
      
      const permittedIds = permissions?.map(p => p.integration_id) || [];
      
      let allIntegrations = [...(tenantIntegrations || [])];
      
      if (permittedIds.length > 0) {
        // Fetch permitted integrations from other tenants
        const { data: permittedIntegrations } = await supabase
          .from('tenant_integrations')
          .select('id, settings, user_id')
          .in('id', permittedIds)
          .eq('integration_type', 'green_api')
          .eq('is_active', true);
        
        // Merge and deduplicate
        const existingIds = new Set(allIntegrations.map(i => i.id));
        
        permittedIntegrations?.forEach(integration => {
          if (!existingIds.has(integration.id)) {
            allIntegrations.push(integration);
          }
        });
      }
      
      // Fetch owner names for all integrations
      if (allIntegrations.length > 0) {
        const userIds = [...new Set(allIntegrations.map(i => i.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          const profileMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
          allIntegrations = allIntegrations.map(i => ({
            ...i,
            owner_name: profileMap.get(i.user_id) || null
          }));
        }
      }
      
      return allIntegrations;
    },
    enabled: !!automation.tenant_id && (form.watch("action_type") === "send_greenapi_message" || form.watch("action_type") === "send_greenapi_to_campaigner"),
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
      } else if (values.action_type === "send_whatsapp") {
        configuration = {
          manychat_tag_id: values.manychat_tag_id,
          field_mapping: {
            date: values.field_mapping_date,
            time: values.field_mapping_time,
            location: values.field_mapping_location,
            contact: values.field_mapping_contact,
          },
        };
      } else if (values.action_type === "create_manychat_subscriber") {
        configuration = {
          manychat_tag_id: values.manychat_tag_id || null,
        };
      } else if (values.action_type === "send_greenapi_message") {
        configuration = {
          message_template: values.message_template || "",
          integration_id: values.green_api_integration_id || null,
          send_to_type: values.greenapi_send_to_type || "contact",
          manual_phone: values.greenapi_manual_phone || null,
          manual_group_id: values.greenapi_manual_group_id || null,
        };
      } else if (values.action_type === "send_greenapi_to_campaigner") {
        configuration = {
          message_template: values.message_template || "",
          send_target: values.campaigner_send_target || "phone",
          integration_id: values.green_api_integration_id || null,
        };
      } else if (values.action_type === "add_lead_update" || values.action_type === "add_client_update") {
        configuration = {
          update_template: values.update_template || "",
        };
      } else if (values.action_type === "create_task") {
        configuration = {
          task_title_template: values.task_title_template || "{{company_name}} - משימה חדשה",
          task_notes_template: values.task_notes_template || "",
          task_priority: values.task_priority || 5,
          task_due_days: values.task_due_days || 0,
        };
      }

      const { error } = await supabase
        .from("automations")
        .update({
          name: values.name,
          description: values.description,
          trigger_type: values.trigger_type as any,
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
                      <SelectItem value="meeting_created">נוצרה פגישה</SelectItem>
                      <SelectItem value="task_calendar_created">משימה נוספה ליומן</SelectItem>
                      <SelectItem value="task_overdue">משימה לא הושלמה בזמן</SelectItem>
                      <SelectItem value="inbound_webhook_task">קבלת משימה מ-Webhook</SelectItem>
                      <SelectItem value="inbound_webhook_lead">קליטת ליד מ-Webhook (מסקיו)</SelectItem>
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
                        {triggerType === "lead_status_changed" && leadStatuses.map((status) => (
                          <SelectItem key={status.status_key} value={status.status_key}>
                            {status.label}
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

            {triggerType === "inbound_webhook_task" && (
              <div className="p-4 rounded-lg bg-muted/50 border space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ExternalLink className="h-4 w-4" />
                  <span>Webhook URL לקליטת משימות</span>
                </div>
                <div className="flex gap-2">
                  <Input 
                    readOnly 
                    value={`https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-task-intake`}
                    className="font-mono text-xs bg-background"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-task-intake`);
                      toast.success("הועתק!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  שלח POST request עם JSON לכתובת זו. חובה לכלול tenant_slug ו-title.
                </p>
              </div>
            )}

            {triggerType === "inbound_webhook_lead" && (
              <div className="p-4 rounded-lg bg-muted/50 border space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ExternalLink className="h-4 w-4" />
                  <span>Webhook URL לקליטת לידים מ-Maskyoo</span>
                </div>
                
                {/* Maskyoo URL */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">כתובת ה-Webhook למסקיו:</p>
                  <div className="flex gap-2">
                    <Input 
                      readOnly 
                      value={`https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-maskyoo-intake?tenant_id=${automation.tenant_id || 'YOUR_TENANT_ID'}`}
                      className="font-mono text-xs bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(`https://jnzguisakdtcollxmgzd.supabase.co/functions/v1/webhook-maskyoo-intake?tenant_id=${automation.tenant_id || ''}`);
                        toast.success("הועתק!");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Instructions for Maskyoo */}
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                  <p className="text-sm font-medium text-primary">📞 הוראות הגדרה במסקיו:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside mr-2">
                    <li>העתק את הכתובת למעלה</li>
                    <li>גש להגדרות האוטומציה במסקיו</li>
                    <li>בחר "פתיחת קישור" כסוג הפעולה</li>
                    <li>הדבק את הכתובת</li>
                    <li>בחר שיטת שליחה: <strong>POST</strong></li>
                    <li>סמן ✓ "הוסף פרמטרים מברירת מחדל לקישור"</li>
                  </ol>
                </div>

                <p className="text-xs text-muted-foreground">
                  💡 <strong>מה יקרה:</strong> כשמישהו יתקשר למספר המסקיו ולא יענו לו, ייווצר ליד חדש אוטומטית עם מספר הטלפון שלו.
                </p>
              </div>
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
                      <SelectItem value="send_whatsapp">שלח WhatsApp (ManyChat)</SelectItem>
                      <SelectItem value="create_manychat_subscriber">צור subscriber ב-ManyChat</SelectItem>
                      <SelectItem value="send_greenapi_message">שלח WhatsApp (Green API)</SelectItem>
                      <SelectItem value="send_greenapi_to_campaigner">שלח WhatsApp לקמפיינר (Green API)</SelectItem>
                      <SelectItem value="add_lead_update">הוסף עדכון לליד</SelectItem>
                      <SelectItem value="add_client_update">הוסף עדכון ללקוח</SelectItem>
                      <SelectItem value="create_task">צור משימה</SelectItem>
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
                          {statusEntity === "lead" && leadStatuses.map((status) => (
                            <SelectItem key={status.status_key} value={status.status_key}>
                              {status.label}
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

            {actionType === "send_whatsapp" && (
              <>
                <FormField
                  control={form.control}
                  name="manychat_tag_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>בחר טאג להפעלה ב-ManyChat *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingTags ? "טוען טאגים..." : "בחר טאג"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          {manychatTags?.map((tag: { id: number; name: string }) => (
                            <SelectItem key={tag.id} value={String(tag.id)}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        הטאג שייושם ב-ManyChat ויפעיל את ה-Automation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                  <p className="text-sm font-medium">מיפוי שדות ל-ManyChat Custom Fields</p>
                  <p className="text-xs text-muted-foreground">
                    העתק את ה-Field ID מ-ManyChat עבור כל שדה
                  </p>

                  <FormField
                    control={form.control}
                    name="field_mapping_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">תאריך הפגישה (Field ID)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="לדוגמה: 123456" className="h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="field_mapping_time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">שעת הפגישה (Field ID)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="לדוגמה: 123457" className="h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="field_mapping_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">מיקום/נושא הפגישה (Field ID)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="לדוגמה: 123458" className="h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="field_mapping_contact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">שם איש הקשר (Field ID)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="לדוגמה: 123459" className="h-8 text-sm" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            {actionType === "create_manychat_subscriber" && (
              <>
                <FormField
                  control={form.control}
                  name="manychat_tag_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>טאג להוספה (אופציונלי)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר טאג להוספה אחרי יצירת ה-subscriber" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="none">ללא טאג</SelectItem>
                          {isLoadingTags ? (
                            <SelectItem value="loading" disabled>טוען...</SelectItem>
                          ) : manychatTags?.map((tag: any) => (
                            <SelectItem key={tag.id} value={tag.id.toString()}>
                              {tag.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        הטאג ייושם אוטומטית אחרי יצירת ה-subscriber
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400">כיצד זה עובד?</p>
                  <ul className="text-muted-foreground text-xs mt-1 space-y-1">
                    <li>• כשליד נוצר, המערכת יוצרת subscriber חדש ב-ManyChat</li>
                    <li>• מספר הטלפון והשם של הליד יועברו ל-ManyChat</li>
                    <li>• ה-Subscriber ID יישמר בליד לשימוש עתידי</li>
                    <li>• אם נבחר טאג, הוא יתווסף אוטומטית ל-subscriber</li>
                  </ul>
                </div>
              </>
            )}

            {actionType === "send_greenapi_message" && (
              <>
                <FormField
                  control={form.control}
                  name="green_api_integration_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>בחר חיבור Green API *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר חיבור" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          {greenApiIntegrations && greenApiIntegrations.length > 0 ? (
                            greenApiIntegrations.map((integration: any) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.owner_name || 'חיבור'} ({integration.settings?.idInstance?.slice(-4) || 'לא ידוע'})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-3 text-sm text-muted-foreground">לא נמצאו חיבורי Green API</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        בחר איזה חיבור Green API להשתמש לשליחת ההודעה
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="greenapi_send_to_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שלח ל *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "contact"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר יעד" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="contact">איש קשר (ליד/לקוח)</SelectItem>
                          <SelectItem value="manual_phone">מספר טלפון ידני</SelectItem>
                          <SelectItem value="manual_group">קבוצת WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        בחר אם לשלוח לאיש הקשר מהטריגר או ליעד קבוע
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("greenapi_send_to_type") === "manual_phone" && (
                  <FormField
                    control={form.control}
                    name="greenapi_manual_phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>מספר טלפון</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="0501234567" />
                        </FormControl>
                        <FormDescription className="text-xs">
                          הזן מספר טלפון ישראלי (יתורגם אוטומטית ל-972)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("greenapi_send_to_type") === "manual_group" && (
                  <FormField
                    control={form.control}
                    name="greenapi_manual_group_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>מזהה קבוצה</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="120363..." />
                        </FormControl>
                        <FormDescription className="text-xs">
                          הזן את מזהה הקבוצה (ניתן למצוא בהגדרות הקבוצה או מ-WhatsApp Web)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="message_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MessageTemplateBuilder 
                          value={field.value || ""}
                          onChange={field.onChange}
                          label="תבנית הודעה *"
                          placeholder="שלום {{contact_name}}, תודה על פנייתך!"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {actionType === "send_greenapi_to_campaigner" && (
              <>
                <FormField
                  control={form.control}
                  name="green_api_integration_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>בחר חיבור Green API *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר חיבור" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          {greenApiIntegrations && greenApiIntegrations.length > 0 ? (
                            greenApiIntegrations.map((integration: any) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.owner_name || 'חיבור'} ({integration.settings?.idInstance?.slice(-4) || 'לא ידוע'})
                              </SelectItem>
                            ))
                          ) : (
                            <div className="py-2 px-3 text-sm text-muted-foreground">לא נמצאו חיבורי Green API</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        בחר איזה חיבור Green API להשתמש לשליחת ההודעה
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="campaigner_send_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שלח ל *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || "phone"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="בחר יעד" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="phone">טלפון הקמפיינר</SelectItem>
                          <SelectItem value="group">קבוצת WhatsApp של הקמפיינר</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        בחר אם לשלוח לטלפון האישי או לקבוצה המשויכת לקמפיינר
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="message_template"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <MessageTemplateBuilder 
                          value={field.value || ""}
                          onChange={field.onChange}
                          label="תבנית הודעה *"
                          placeholder="משימה חדשה: {{task_title}}&#10;לקוח: {{client_name}}&#10;עדיפות: {{priority}}"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {(actionType === "add_lead_update" || actionType === "add_client_update") && (
              <FormField
                control={form.control}
                name="update_template"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <MessageTemplateBuilder 
                        value={field.value || ""}
                        onChange={field.onChange}
                        label="תבנית עדכון *"
                        placeholder="אין מענה בתאריך {{date}} בשעה {{time}}"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
