import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { FlowNodeData } from "./FlowNode";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

const TRIGGER_OPTIONS = [
  { value: "lead_created", label: "ליד נוצר" },
  { value: "lead_status_changed", label: "סטטוס ליד השתנה" },
  { value: "client_created", label: "לקוח נוצר" },
  { value: "client_status_changed", label: "סטטוס לקוח השתנה" },
  { value: "task_status_changed", label: "סטטוס משימה השתנה" },
  { value: "task_assigned", label: "משימה שוייכה" },
  { value: "meeting_created", label: "נוצרה פגישה" },
  { value: "task_overdue", label: "משימה באיחור" },
  { value: "inbound_webhook_task", label: "Webhook נכנס" },
];

const ACTION_OPTIONS = [
  { value: "send_whatsapp", label: "שלח WhatsApp (ManyChat)" },
  { value: "send_greenapi_message", label: "שלח WhatsApp (Green API)" },
  { value: "create_task", label: "צור משימה" },
  { value: "add_lead_update", label: "הוסף עדכון לליד" },
  { value: "add_client_update", label: "הוסף עדכון ללקוח" },
  { value: "create_manychat_subscriber", label: "צור subscriber ב-ManyChat" },
  { value: "update_status", label: "שנה סטטוס" },
  { value: "webhook", label: "Webhook" },
  { value: "email", label: "אימייל" },
  { value: "notification", label: "התראה" },
];

const DELAY_UNITS = [
  { value: "minutes", label: "דקות" },
  { value: "hours", label: "שעות" },
  { value: "days", label: "ימים" },
];

const LEAD_SOURCE_OPTIONS = [
  { value: "any", label: "ליד חדש בארגון (כל מקור)" },
  { value: "facebook_form", label: "ליד מטופס ליד (Facebook)" },
];

interface StepConfigPanelProps {
  node: FlowNodeData | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (nodeId: string, updates: Partial<FlowNodeData>) => void;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token?: string;
}

interface FacebookForm {
  id: string;
  name: string;
  status: string;
}

export function StepConfigPanel({ node, open, onClose, onUpdate }: StepConfigPanelProps) {
  const { tenant } = useCurrentTenant();
  const tenantId = tenant?.id;

  if (!node) return null;

  const isLeadCreatedTrigger = node.step_type === "trigger" && node.action_type === "lead_created";
  const leadSource = node.configuration?.lead_source || "any";
  const isFacebookForm = leadSource === "facebook_form";

  const handleActionTypeChange = (value: string) => {
    onUpdate(node.id, { action_type: value });
  };

  const handleLabelChange = (value: string) => {
    onUpdate(node.id, { label: value });
  };

  const handleConfigChange = (key: string, value: any) => {
    onUpdate(node.id, {
      configuration: { ...node.configuration, [key]: value },
    });
  };

  const options = node.step_type === "trigger" ? TRIGGER_OPTIONS : ACTION_OPTIONS;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[360px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-right">
            {node.step_type === "trigger" ? "הגדרת טריגר" :
             node.step_type === "action" ? "הגדרת פעולה" :
             node.step_type === "condition" ? "הגדרת תנאי" :
             "הגדרת השהייה"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          {/* Label */}
          <div className="space-y-2">
            <Label className="text-right block">שם הצעד</Label>
            <Input
              value={node.label || ""}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="שם מותאם אישית (אופציונלי)"
              className="text-right"
            />
          </div>

          {/* Action type selector */}
          {(node.step_type === "trigger" || node.step_type === "action") && (
            <div className="space-y-2">
              <Label className="text-right block">
                {node.step_type === "trigger" ? "סוג טריגר" : "סוג פעולה"}
              </Label>
              <Select value={node.action_type || ""} onValueChange={handleActionTypeChange}>
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר..." />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Lead source sub-config when lead_created trigger */}
          {isLeadCreatedTrigger && (
            <LeadSourceConfig
              tenantId={tenantId}
              leadSource={leadSource}
              configuration={node.configuration}
              onConfigChange={handleConfigChange}
            />
          )}

          {/* Delay config */}
          {node.step_type === "delay" && (
            <>
              <div className="space-y-2">
                <Label className="text-right block">זמן המתנה</Label>
                <Input
                  type="number"
                  min={1}
                  value={node.configuration?.delay_value || ""}
                  onChange={(e) => handleConfigChange("delay_value", parseInt(e.target.value) || 0)}
                  placeholder="כמות"
                  className="text-right"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-right block">יחידה</Label>
                <Select
                  value={node.configuration?.delay_unit || "minutes"}
                  onValueChange={(v) => handleConfigChange("delay_unit", v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Condition config */}
          {node.step_type === "condition" && (
            <div className="space-y-2">
              <Label className="text-right block">תנאי (ביטוי)</Label>
              <Textarea
                value={node.configuration?.condition_expression || ""}
                onChange={(e) => handleConfigChange("condition_expression", e.target.value)}
                placeholder="למשל: lead.status === 'new'"
                className="text-right font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                אם התנאי מתקיים - הענף הראשי. אם לא - הענף החלופי.
              </p>
            </div>
          )}

          {/* Webhook URL for webhook action */}
          {node.action_type === "webhook" && (
            <div className="space-y-2">
              <Label className="text-right block">כתובת URL</Label>
              <Input
                value={node.configuration?.url || ""}
                onChange={(e) => handleConfigChange("url", e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
          )}

          {/* Message template for WhatsApp actions */}
          {(node.action_type === "send_whatsapp" || node.action_type === "send_greenapi_message") && (
            <div className="space-y-2">
              <Label className="text-right block">תבנית הודעה</Label>
              <Textarea
                value={node.configuration?.message_template || ""}
                onChange={(e) => handleConfigChange("message_template", e.target.value)}
                placeholder="שלום {{contact_name}}..."
                className="text-right"
                rows={4}
              />
              <p className="text-xs text-muted-foreground text-right">
                משתנים זמינים: {"{{contact_name}}"}, {"{{company_name}}"}
              </p>
            </div>
          )}

          {/* Status update config */}
          {node.action_type === "update_status" && (
            <>
              <div className="space-y-2">
                <Label className="text-right block">סוג ישות</Label>
                <Select
                  value={node.configuration?.entity || ""}
                  onValueChange={(v) => handleConfigChange("entity", v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">ליד</SelectItem>
                    <SelectItem value="task">משימה</SelectItem>
                    <SelectItem value="client">לקוח</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-right block">סטטוס חדש</Label>
                <Input
                  value={node.configuration?.status || ""}
                  onChange={(e) => handleConfigChange("status", e.target.value)}
                  placeholder="הסטטוס החדש"
                  className="text-right"
                />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Sub-component for lead source configuration
function LeadSourceConfig({
  tenantId,
  leadSource,
  configuration,
  onConfigChange,
}: {
  tenantId: string | undefined;
  leadSource: string;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}) {
  const isFacebookForm = leadSource === "facebook_form";
  const selectedIntegrationId = configuration?.facebook_integration_id || "";
  const selectedPageId = configuration?.facebook_page_id || "";
  const selectedFormId = configuration?.facebook_form_id || "";

  // Fetch Facebook integrations for this tenant
  const { data: fbIntegrations, isLoading: loadingIntegrations } = useQuery({
    queryKey: ["fb-integrations-for-flow", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, integration_type, settings, api_key, is_active")
        .eq("tenant_id", tenantId)
        .eq("integration_type", "facebook_lead_ads")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && isFacebookForm,
  });

  // Get the selected integration's access token
  const selectedIntegration = fbIntegrations?.find((i) => i.id === selectedIntegrationId);
  const accessToken = selectedIntegration?.api_key || null;

  // Fetch pages for the selected integration
  const { data: pagesData, isLoading: loadingPages } = useQuery({
    queryKey: ["fb-pages-for-flow", selectedIntegrationId, accessToken],
    queryFn: async () => {
      if (!accessToken || !tenantId) return [];
      const { data, error } = await supabase.functions.invoke("get-facebook-forms", {
        body: { tenant_id: tenantId, access_token: accessToken },
      });
      if (error || data?.error) return [];
      return (data?.pages as FacebookPage[]) || [];
    },
    enabled: !!accessToken && !!tenantId && isFacebookForm,
  });

  // Fetch forms for the selected page
  const pageToken = pagesData?.find((p: FacebookPage) => p.id === selectedPageId)?.access_token || null;
  const { data: formsData, isLoading: loadingForms } = useQuery({
    queryKey: ["fb-forms-for-flow", selectedPageId, accessToken, pageToken],
    queryFn: async () => {
      if (!accessToken || !selectedPageId || !tenantId) return [];
      const { data, error } = await supabase.functions.invoke("get-facebook-forms", {
        body: {
          tenant_id: tenantId,
          page_id: selectedPageId,
          access_token: accessToken,
          page_access_token: pageToken,
        },
      });
      if (error || data?.error) return [];
      return (data?.forms as FacebookForm[]) || [];
    },
    enabled: !!accessToken && !!selectedPageId && !!tenantId && isFacebookForm,
  });

  // Also build forms from existing integration settings (mapped forms)
  const settingsObj = selectedIntegration?.settings as Record<string, any> | null;
  const mappedForms = settingsObj?.form_mappings
    ? Object.keys(settingsObj.form_mappings as Record<string, any>)
    : [];

  return (
    <>
      <div className="space-y-2">
        <Label className="text-right block">מקור הליד</Label>
        <Select value={leadSource} onValueChange={(v) => onConfigChange("lead_source", v)}>
          <SelectTrigger className="text-right">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFacebookForm && (
        <>
          {/* Integration selector */}
          <div className="space-y-2">
            <Label className="text-right block">חיבור Facebook</Label>
            {loadingIntegrations ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : fbIntegrations && fbIntegrations.length > 0 ? (
              <Select
                value={selectedIntegrationId}
                onValueChange={(v) => {
                  onConfigChange("facebook_integration_id", v);
                  onConfigChange("facebook_page_id", "");
                  onConfigChange("facebook_form_id", "");
                }}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר חיבור..." />
                </SelectTrigger>
                <SelectContent>
                  {fbIntegrations.map((integration) => (
                    <SelectItem key={integration.id} value={integration.id}>
                      Facebook Lead Ads
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground text-right">
                אין חיבור Facebook פעיל. הגדר אינטגרציה בהגדרות לידים.
              </p>
            )}
          </div>

          {/* Page selector */}
          {selectedIntegrationId && (
            <div className="space-y-2">
              <Label className="text-right block">דף פייסבוק</Label>
              {loadingPages ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : pagesData && pagesData.length > 0 ? (
                <Select
                  value={selectedPageId}
                  onValueChange={(v) => {
                    onConfigChange("facebook_page_id", v);
                    onConfigChange("facebook_form_id", "");
                  }}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר דף..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pagesData.map((page: FacebookPage) => (
                      <SelectItem key={page.id} value={page.id}>
                        {page.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground text-right">
                  לא נמצאו דפים. בדוק את ההרשאות של חיבור הפייסבוק.
                </p>
              )}
            </div>
          )}

          {/* Form selector */}
          {selectedPageId && (
            <div className="space-y-2">
              <Label className="text-right block">טופס ליד</Label>
              {loadingForms ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : formsData && formsData.length > 0 ? (
                <Select
                  value={selectedFormId}
                  onValueChange={(v) => onConfigChange("facebook_form_id", v)}
                >
                  <SelectTrigger className="text-right">
                    <SelectValue placeholder="בחר טופס..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formsData.map((form: FacebookForm) => (
                      <SelectItem key={form.id} value={form.id}>
                        {form.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground text-right">
                  לא נמצאו טפסים בדף זה.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
