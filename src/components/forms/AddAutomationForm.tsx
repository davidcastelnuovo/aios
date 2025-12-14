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
import { MessageTemplateBuilder } from "./MessageTemplateBuilder";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";

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
  ]),
  action_type: z.enum(["webhook", "email", "notification", "update_status", "send_whatsapp", "create_manychat_subscriber", "send_greenapi_message", "send_greenapi_to_campaigner", "add_lead_update", "add_client_update"]),
  // Green API connection selection
  green_api_integration_id: z.string().optional(),
  // Green API to campaigner fields
  campaigner_send_target: z.enum(["phone", "group"]).optional(),
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

const TRIGGER_OPTIONS = [
  { value: "task_assigned", label: "משימה שוייכה" },
  { value: "task_status_changed", label: "סטטוס משימה השתנה" },
  { value: "lead_status_changed", label: "סטטוס ליד השתנה" },
  { value: "lead_created", label: "ליד נוצר" },
  { value: "client_created", label: "לקוח נוצר" },
  { value: "client_status_changed", label: "סטטוס לקוח השתנה" },
  { value: "onboarding_status_changed", label: "סטטוס קליטה השתנה" },
  { value: "meeting_created", label: "נוצרה פגישה" },
  { value: "task_calendar_created", label: "משימה נוספה ליומן" },
  { value: "task_overdue", label: "משימה לא הושלמה בזמן" },
];

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

export function AddAutomationForm() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const { activeStatuses: leadStatuses, isLoading: isLoadingStatuses } = useLeadStatuses();

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
      trigger_status_value: "any",
      update_field_name: "none",
      update_field_value: "today",
      manychat_tag_id: "",
      field_mapping_date: "",
      field_mapping_time: "",
      field_mapping_location: "",
      field_mapping_contact: "",
      message_template: "",
      update_template: "אין מענה בתאריך {{date}} בשעה {{time}}",
      campaigner_send_target: "phone",
      green_api_integration_id: "",
    },
  });

  const actionType = form.watch("action_type");

  // Fetch ManyChat tags when action type is send_whatsapp or create_manychat_subscriber
  const { data: manychatTags, isLoading: isLoadingTags } = useQuery({
    queryKey: ['manychat-tags', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.functions.invoke('get-manychat-tags', {
        body: { tenantId }
      });
      if (error) throw error;
      return Array.isArray(data?.tags) ? data.tags : [];
    },
    enabled: !!tenantId && (actionType === "send_whatsapp" || actionType === "create_manychat_subscriber"),
  });

  // Fetch Green API integrations when action type requires Green API
  // Include both tenant integrations AND integrations the user has permission to use
  const { data: greenApiIntegrations } = useQuery({
    queryKey: ['green-api-integrations-for-automation', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Get tenant integrations
      const { data: tenantIntegrations, error: tenantError } = await supabase
        .from('tenant_integrations')
        .select('id, settings, user_id, profiles!tenant_integrations_user_id_fkey(full_name)')
        .eq('tenant_id', tenantId)
        .eq('integration_type', 'green_api')
        .eq('is_active', true);
      
      if (tenantError) throw tenantError;
      
      // Get integrations the user has permission to use
      const { data: permissions } = await supabase
        .from('integration_user_permissions')
        .select('integration_id')
        .eq('user_id', user.id);
      
      const permittedIds = permissions?.map(p => p.integration_id) || [];
      
      if (permittedIds.length > 0) {
        // Fetch permitted integrations from other tenants
        const { data: permittedIntegrations } = await supabase
          .from('tenant_integrations')
          .select('id, settings, user_id, profiles!tenant_integrations_user_id_fkey(full_name)')
          .in('id', permittedIds)
          .eq('integration_type', 'green_api')
          .eq('is_active', true);
        
        // Merge and deduplicate
        const allIntegrations = [...(tenantIntegrations || [])];
        const existingIds = new Set(allIntegrations.map(i => i.id));
        
        permittedIntegrations?.forEach(integration => {
          if (!existingIds.has(integration.id)) {
            allIntegrations.push(integration);
          }
        });
        
        return allIntegrations;
      }
      
      return tenantIntegrations || [];
    },
    enabled: !!tenantId && (actionType === "send_greenapi_message" || actionType === "send_greenapi_to_campaigner"),
  });

  const createAutomationMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Ensure a tenant is selected
      if (!tenantId) throw new Error("No tenant selected");

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
      if (values.trigger_status_value && values.trigger_status_value !== 'any') {
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
        const cfg: any = {
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
      }

      const { data, error } = await supabase
        .from("automations")
        .insert({
          name: values.name,
          description: values.description,
          trigger_type: values.trigger_type as any,
          action_type: values.action_type,
          configuration: configuration,
          conditions: conditions,
          tenant_id: tenantId,
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
    console.log('Form submitted with values:', values);
    console.log('Form errors:', form.formState.errors);
    createAutomationMutation.mutate(values);
  };

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
                      <SelectItem value="send_whatsapp">שלח WhatsApp (ManyChat)</SelectItem>
                      <SelectItem value="create_manychat_subscriber">צור subscriber ב-ManyChat</SelectItem>
                      <SelectItem value="send_greenapi_message">שלח WhatsApp (Green API)</SelectItem>
                      <SelectItem value="send_greenapi_to_campaigner">שלח WhatsApp לקמפיינר (Green API)</SelectItem>
                      <SelectItem value="add_lead_update">הוסף עדכון לליד</SelectItem>
                      <SelectItem value="add_client_update">הוסף עדכון ללקוח</SelectItem>
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
                          <Input placeholder="לדוגמה: 123456" {...field} className="h-8 text-sm" />
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
                          <Input placeholder="לדוגמה: 123457" {...field} className="h-8 text-sm" />
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
                          <Input placeholder="לדוגמה: 123458" {...field} className="h-8 text-sm" />
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
                          <Input placeholder="לדוגמה: 123459" {...field} className="h-8 text-sm" />
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
                {greenApiIntegrations && greenApiIntegrations.length > 1 && (
                  <FormField
                    control={form.control}
                    name="green_api_integration_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>בחר חיבור Green API</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר חיבור (ברירת מחדל: הראשון הזמין)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-[100]">
                            <SelectItem value="">ברירת מחדל (חיבור ראשון)</SelectItem>
                            {greenApiIntegrations.map((integration: any) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.profiles?.full_name || 'חיבור'} - {integration.settings?.idInstance}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          בחר איזה חיבור Green API להשתמש לשליחת ההודעה
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
                {greenApiIntegrations && greenApiIntegrations.length > 1 && (
                  <FormField
                    control={form.control}
                    name="green_api_integration_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>בחר חיבור Green API</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר חיבור (ברירת מחדל: הראשון הזמין)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-[100]">
                            <SelectItem value="">ברירת מחדל (חיבור ראשון)</SelectItem>
                            {greenApiIntegrations.map((integration: any) => (
                              <SelectItem key={integration.id} value={integration.id}>
                                {integration.profiles?.full_name || 'חיבור'} - {integration.settings?.idInstance}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-xs">
                          בחר איזה חיבור Green API להשתמש לשליחת ההודעה
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="campaigner_send_target"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>שלח ל *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || "phone"}>
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
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-600 dark:text-blue-400">הסבר:</p>
                  <ul className="text-muted-foreground text-xs mt-1 space-y-1">
                    <li>• שליחה לטלפון: ההודעה תישלח לטלפון האישי של הקמפיינר</li>
                    <li>• שליחה לקבוצה: ההודעה תישלח לקבוצת WhatsApp ששויכה לקמפיינר</li>
                    <li>• וודא שהגדרת מזהה קבוצה בכרטיס הקמפיינר אם בוחר שליחה לקבוצה</li>
                  </ul>
                </div>
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
              <Button 
                type="submit" 
                disabled={createAutomationMutation.isPending}
                onClick={() => {
                  console.log('Button clicked');
                  console.log('Form state:', form.formState);
                  console.log('Form values:', form.getValues());
                }}
              >
                {createAutomationMutation.isPending ? "יוצר..." : "צור אוטומציה"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
