import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Facebook, CheckCircle2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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

  const handleBulkConfigChange = (updates: Record<string, any>) => {
    onUpdate(node.id, {
      configuration: { ...node.configuration, ...updates },
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
              onBulkConfigChange={handleBulkConfigChange}
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
  onBulkConfigChange,
}: {
  tenantId: string | undefined;
  leadSource: string;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
  onBulkConfigChange: (updates: Record<string, any>) => void;
}) {
  const [showFbDialog, setShowFbDialog] = useState(false);
  const isFacebookForm = leadSource === "facebook_form";

  // Display current selection summary
  const hasSelection = configuration?.facebook_form_id && configuration?.facebook_page_name;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-right block">מקור הליד</Label>
        <Select
          value={leadSource}
          onValueChange={(v) => {
            onConfigChange("lead_source", v);
            if (v === "facebook_form") {
              setShowFbDialog(true);
            }
          }}
        >
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

      {/* Show selected form summary */}
      {isFacebookForm && hasSelection && (
        <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFbDialog(true)}
              className="text-xs"
            >
              שנה
            </Button>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">טופס מחובר</span>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-xs text-muted-foreground">
              עמוד: <span className="text-foreground">{configuration?.facebook_page_name || configuration?.facebook_page_id}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              טופס: <span className="text-foreground">{configuration?.facebook_form_name || configuration?.facebook_form_id}</span>
            </p>
          </div>
        </div>
      )}

      {/* Show button to open dialog if facebook_form selected but no form chosen yet */}
      {isFacebookForm && !hasSelection && (
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => setShowFbDialog(true)}
        >
          <Facebook className="h-4 w-4" />
          בחר טופס ליד מפייסבוק
        </Button>
      )}

      {/* Facebook form selection dialog */}
      <FacebookFormSelectionDialog
        open={showFbDialog}
        onClose={() => setShowFbDialog(false)}
        tenantId={tenantId}
        configuration={configuration}
        onSave={(selected) => {
          onBulkConfigChange({
            facebook_integration_id: selected.integrationId,
            facebook_page_id: selected.pageId,
            facebook_page_name: selected.pageName,
            facebook_form_id: selected.formId,
            facebook_form_name: selected.formName,
          });
          setShowFbDialog(false);
        }}
      />
    </>
  );
}

// Dialog for selecting Facebook page & form
function FacebookFormSelectionDialog({
  open,
  onClose,
  tenantId,
  configuration,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string | undefined;
  configuration: Record<string, any>;
  onSave: (selected: {
    integrationId: string;
    pageId: string;
    pageName: string;
    formId: string;
    formName: string;
  }) => void;
}) {
  const [selectedIntegrationId, setSelectedIntegrationId] = useState(configuration?.facebook_integration_id || "");
  const [selectedPageId, setSelectedPageId] = useState(configuration?.facebook_page_id || "");
  const [selectedFormId, setSelectedFormId] = useState(configuration?.facebook_form_id || "");
  const [pageSearchQuery, setPageSearchQuery] = useState("");

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIntegrationId(configuration?.facebook_integration_id || "");
      setSelectedPageId(configuration?.facebook_page_id || "");
      setSelectedFormId(configuration?.facebook_form_id || "");
      setPageSearchQuery("");
    }
  }, [open, configuration]);

  // Fetch Facebook integrations
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
    enabled: !!tenantId && open,
  });

  const selectedIntegration = fbIntegrations?.find((i) => i.id === selectedIntegrationId);
  const accessToken = selectedIntegration?.api_key || null;

  // Fetch pages
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
    enabled: !!accessToken && !!tenantId && open,
  });

  // Fetch forms
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
    enabled: !!accessToken && !!selectedPageId && !!tenantId && open,
  });

  const selectedPage = pagesData?.find((p: FacebookPage) => p.id === selectedPageId);
  const selectedForm = formsData?.find((f: FacebookForm) => f.id === selectedFormId);
  const canSave = !!selectedIntegrationId && !!selectedPageId && !!selectedFormId;

  const filteredPages = useMemo(() => {
    if (!pagesData || pagesData.length === 0) return [];
    if (!pageSearchQuery.trim()) return pagesData;
    const q = pageSearchQuery.trim().toLowerCase();
    return pagesData.filter((p: FacebookPage) => p.name.toLowerCase().includes(q));
  }, [pagesData, pageSearchQuery]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <Facebook className="h-5 w-5 text-blue-600" />
            בחירת טופס ליד מפייסבוק
          </DialogTitle>
          <DialogDescription className="text-right">
            בחר את חיבור הפייסבוק, העמוד והטופס שממנו יגיעו הלידים לאוטומציה זו.
            <br />
            <span className="text-xs text-amber-600">* חיבור הטופס כאן לא ישפיע על הגדרות הלידים של הארגון</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Step 1: Integration */}
          <div className="space-y-2">
            <Label className="text-right block font-medium">
              <span className="inline-flex items-center gap-2">
                <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">1</Badge>
                חיבור Facebook
              </span>
            </Label>
            {loadingIntegrations ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : fbIntegrations && fbIntegrations.length > 0 ? (
              <Select
                value={selectedIntegrationId}
                onValueChange={(v) => {
                  setSelectedIntegrationId(v);
                  setSelectedPageId("");
                  setSelectedFormId("");
                }}
              >
                <SelectTrigger className="text-right">
                  <SelectValue placeholder="בחר חיבור..." />
                </SelectTrigger>
                <SelectContent>
                  {fbIntegrations.map((integration) => {
                    const settings = integration.settings as Record<string, any> | null;
                    const name = settings?.connection_name || "Facebook Lead Ads";
                    return (
                      <SelectItem key={integration.id} value={integration.id}>
                        {name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-center">
                <p className="text-sm text-muted-foreground">
                  אין חיבור Facebook פעיל.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  הגדר אינטגרציית Facebook Lead Ads בעמוד האינטגרציות.
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Page */}
          {selectedIntegrationId && (
            <div className="space-y-2">
              <Label className="text-right block font-medium">
                <span className="inline-flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">2</Badge>
                  דף פייסבוק
                </span>
              </Label>
              {loadingPages ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : pagesData && pagesData.length > 0 ? (
                <div className="space-y-2">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={pageSearchQuery}
                      onChange={(e) => setPageSearchQuery(e.target.value)}
                      placeholder="חפש עמוד לפי שם..."
                      className="text-right pr-9"
                    />
                  </div>
                  {/* Pages list */}
                  <ScrollArea className="h-[200px] rounded-md border">
                    <div className="p-1">
                      {filteredPages.length > 0 ? (
                        filteredPages.map((page: FacebookPage) => (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => {
                              setSelectedPageId(page.id);
                              setSelectedFormId("");
                            }}
                            className={`w-full text-right px-3 py-2 rounded-md text-sm transition-colors ${
                              selectedPageId === page.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            }`}
                          >
                            {page.name}
                          </button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          לא נמצאו עמודים תואמים
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                  {pagesData.length > 5 && (
                    <p className="text-xs text-muted-foreground text-right">
                      {filteredPages.length} מתוך {pagesData.length} עמודים
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-right">
                  לא נמצאו דפים. בדוק את ההרשאות של חיבור הפייסבוק.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Form */}
          {selectedPageId && (
            <div className="space-y-2">
              <Label className="text-right block font-medium">
                <span className="inline-flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs">3</Badge>
                  טופס ליד
                </span>
              </Label>
              {loadingForms ? (
                <div className="flex items-center justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : formsData && formsData.length > 0 ? (
                <Select
                  value={selectedFormId}
                  onValueChange={(v) => setSelectedFormId(v)}
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
                <p className="text-sm text-muted-foreground text-right">
                  לא נמצאו טפסים בדף זה.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
          <Button
            disabled={!canSave}
            onClick={() => {
              onSave({
                integrationId: selectedIntegrationId,
                pageId: selectedPageId,
                pageName: selectedPage?.name || selectedPageId,
                formId: selectedFormId,
                formName: selectedForm?.name || selectedFormId,
              });
            }}
          >
            <CheckCircle2 className="h-4 w-4 ml-2" />
            אישור
          </Button>
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
