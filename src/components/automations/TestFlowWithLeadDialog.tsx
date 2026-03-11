import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Mail,
  Building2,
  MessageSquare,
  CalendarIcon,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay, subDays, format } from "date-fns";

interface TestFlowWithLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

type DateRange = "today" | "yesterday" | "last_week" | "custom";

function getDateFilter(range: DateRange, customFrom?: Date, customTo?: Date) {
  const now = new Date();
  switch (range) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: undefined };
    case "yesterday":
      return { from: startOfDay(subDays(now, 1)).toISOString(), to: startOfDay(now).toISOString() };
    case "last_week":
      return { from: startOfDay(subDays(now, 7)).toISOString(), to: undefined };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : startOfDay(subDays(now, 7)).toISOString(),
        to: customTo ? startOfDay(subDays(customTo, -1)).toISOString() : undefined,
      };
  }
}

export function TestFlowWithLeadDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
}: TestFlowWithLeadDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("last_week");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [testResults, setTestResults] = useState<Array<{ leadId: string; leadName: string; success: boolean; data?: any; error?: string }>>([]);
  const [lastMessageData, setLastMessageData] = useState<any>(null);
  const [isFetchingMessage, setIsFetchingMessage] = useState(false);
  const [inputMode, setInputMode] = useState<"select" | "manual">("select");
  const [manualData, setManualData] = useState({
    contact_name: "",
    company_name: "",
    phone: "",
    email: "",
    source: "",
    notes: "",
  });

  // Fetch automation to check trigger type and config
  const { data: automation } = useQuery({
    queryKey: ["automation-for-test", automationId],
    queryFn: async () => {
      if (!automationId) return null;
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("id", automationId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open && !!automationId,
  });

  // Fetch trigger step configuration for whatsapp automations
  const { data: triggerStep } = useQuery({
    queryKey: ["automation-trigger-step", automationId],
    queryFn: async () => {
      if (!automationId) return null;
      const { data, error } = await supabase
        .from("automation_flow_steps" as any)
        .select("*")
        .eq("automation_id", automationId)
        .eq("step_type", "trigger")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: open && !!automationId,
  });

  const isWhatsAppTrigger =
    automation?.trigger_type === "whatsapp_message_received" ||
    triggerStep?.action_type === "whatsapp_message_received";

  const triggerConfig = triggerStep?.configuration || (automation?.configuration as any) || {};

  const dateFilter = getDateFilter(dateRange, customFrom, customTo);

  // Fetch leads with date filtering
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-for-flow-test", tenantId, dateFilter.from, dateFilter.to],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("leads")
        .select("id, company_name, contact_name, phone, email, source, notes, agency_id, manychat_subscriber_id, status, industry, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (dateFilter.from) query = query.gte("created_at", dateFilter.from);
      if (dateFilter.to) query = query.lt("created_at", dateFilter.to);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Filtered leads by search
  const filteredLeads = leads.filter((l: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.company_name || "").toLowerCase().includes(q) ||
      (l.contact_name || "").toLowerCase().includes(q) ||
      (l.phone || "").includes(q) ||
      (l.email || "").toLowerCase().includes(q)
    );
  });

  const toggleLead = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((l: any) => l.id)));
    }
  };

  // Fetch last WhatsApp message matching automation config
  const handleFetchLastMessage = async () => {
    if (!tenantId) return;
    setIsFetchingMessage(true);
    setLastMessageData(null);

    try {
      let query = supabase
        .from("chat_messages")
        .select("*, whatsapp_groups!chat_messages_group_id_fkey(id, group_name, group_chat_id)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1);

      const sourceFilter = triggerConfig?.source_filter;
      if (sourceFilter === "group" && triggerConfig?.group_id) {
        query = query.eq("group_id", triggerConfig.group_id);
      }
      if (triggerConfig?.connection_user_id) {
        query = query.eq("connection_user_id", triggerConfig.connection_user_id);
      }
      if (triggerConfig?.keyword) {
        query = query.ilike("message_text", `%${triggerConfig.keyword}%`);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (!data) {
        toast({ title: "לא נמצאה הודעה", description: "לא נמצאה הודעה תואמת להגדרות הטריגר", variant: "destructive" });
        return;
      }

      const group = (data as any).whatsapp_groups;
      const msgData = {
        sender_name: data.sender_name || "לא ידוע",
        sender_phone: data.sender_phone || "",
        message_text: data.message_text || "",
        group_id: group?.id || null,
        group_name: group?.group_name || null,
        group_chat_id: group?.group_chat_id || null,
        contact_type: data.group_id ? "group" : data.lead_id ? "lead" : data.client_id ? "client" : "unknown",
        contact_id: data.lead_id || data.client_id || data.group_id || null,
        contact_name: group?.group_name || data.sender_name || "לא ידוע",
        connection_user_id: data.connection_user_id || "",
        direction: data.direction,
        created_at: data.created_at,
        lead_id: data.lead_id,
        client_id: data.client_id,
      };

      setLastMessageData(msgData);
      toast({ title: "הודעה נטענה", description: `"${data.message_text?.substring(0, 50)}..." מ-${msgData.sender_name}` });
    } catch (err: any) {
      toast({ title: "שגיאה בשליפת הודעה", description: err.message, variant: "destructive" });
    } finally {
      setIsFetchingMessage(false);
    }
  };

  // Batch test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      // WhatsApp trigger with message data
      if (lastMessageData && isWhatsAppTrigger) {
        const response = await supabase.functions.invoke("trigger-automation", {
          body: {
            automationId,
            tenant_id: tenantId,
            data: { test: true, ...lastMessageData, timestamp: new Date().toISOString() },
          },
        });
        if (response.error) throw response.error;
        return [{ leadId: "whatsapp", leadName: lastMessageData.sender_name, success: true, data: response.data }];
      }

      // Manual input mode
      if (inputMode === "manual") {
        const isFacebookTrigger =
          automation?.trigger_type === "inbound_webhook_lead" ||
          automation?.trigger_type === "lead_created" ||
          triggerStep?.action_type === "inbound_webhook_lead" ||
          triggerStep?.action_type === "lead_created";

        const testData: any = {
          test: true,
          manual: true,
          contact_name: manualData.contact_name || manualData.company_name,
          company_name: manualData.company_name,
          phone: manualData.phone,
          email: manualData.email,
          source: manualData.source || (isFacebookTrigger ? "facebook" : ""),
          notes: manualData.notes || "",
          timestamp: new Date().toISOString(),
        };

        // If trigger is Facebook/webhook, add fb_ prefixed fields to mimic real FB lead data
        if (isFacebookTrigger) {
          // Read actual form field names from trigger configuration
          const formFields = (triggerConfig as any)?.facebook_form_fields as Array<{type: string; label: string; key: string}> | undefined;
          
          // Build a mapping from generic type to actual fb_ field key
          const fieldMap: Record<string, string> = {
            fb_phone: 'fb_phone',
            fb_full_name: 'fb_full_name',
            fb_email: 'fb_email',
            fb_company_name: 'fb_company_name',
          };
          
          if (formFields && formFields.length > 0) {
            for (const field of formFields) {
              const fbKey = `fb_${field.label || field.key}`;
              const fieldType = (field.type || '').toUpperCase();
              if (fieldType === 'PHONE' || fieldType.includes('PHONE')) {
                fieldMap.fb_phone = fbKey;
              } else if (fieldType === 'FULL_NAME' || fieldType.includes('NAME')) {
                fieldMap.fb_full_name = fbKey;
              } else if (fieldType === 'EMAIL' || fieldType.includes('EMAIL')) {
                fieldMap.fb_email = fbKey;
              } else if (fieldType === 'COMPANY_NAME' || fieldType.includes('COMPANY')) {
                fieldMap.fb_company_name = fbKey;
              }
            }
          }
          
          if (manualData.phone) testData[fieldMap.fb_phone] = manualData.phone;
          if (manualData.contact_name) testData[fieldMap.fb_full_name] = manualData.contact_name;
          if (manualData.email) testData[fieldMap.fb_email] = manualData.email;
          if (manualData.company_name) testData[fieldMap.fb_company_name] = manualData.company_name;

          // Append fb_ fields to notes like real FB leads do
          const fbEntries = [
            manualData.contact_name && `${fieldMap.fb_full_name}: ${manualData.contact_name}`,
            manualData.phone && `${fieldMap.fb_phone}: ${manualData.phone}`,
            manualData.email && `${fieldMap.fb_email}: ${manualData.email}`,
            manualData.company_name && `${fieldMap.fb_company_name}: ${manualData.company_name}`,
          ].filter(Boolean);
          if (fbEntries.length > 0) {
            testData.notes = (testData.notes ? testData.notes + "\n" : "") + fbEntries.join("\n");
          }
        }

        const response = await supabase.functions.invoke("trigger-automation", {
          body: { automationId, tenant_id: tenantId, data: testData },
        });
        if (response.error) throw response.error;
        return [{ leadId: "manual", leadName: manualData.contact_name || manualData.company_name || "ידני", success: true, data: response.data }];
      }

      // Lead-based batch test
      if (selectedLeadIds.size === 0) throw new Error("יש לבחור לפחות ליד אחד");

      const results: Array<{ leadId: string; leadName: string; success: boolean; data?: any; error?: string }> = [];

      for (const leadId of selectedLeadIds) {
        const lead = leads.find((l: any) => l.id === leadId);
        if (!lead) continue;

        try {
          const testData: any = {
            test: true,
            lead_id: leadId,
            contact_name: lead.contact_name || lead.company_name,
            company_name: lead.company_name,
            phone: lead.phone,
            email: lead.email,
            source: lead.source,
            notes: lead.notes,
            industry: lead.industry,
            manychat_subscriber_id: lead.manychat_subscriber_id,
            timestamp: new Date().toISOString(),
          };

          const response = await supabase.functions.invoke("trigger-automation", {
            body: { automationId, tenant_id: tenantId, data: testData },
          });

          if (response.error) {
            results.push({ leadId, leadName: lead.company_name || lead.contact_name || "ליד", success: false, error: response.error.message });
          } else {
            results.push({ leadId, leadName: lead.company_name || lead.contact_name || "ליד", success: true, data: response.data });
          }
        } catch (err: any) {
          results.push({ leadId, leadName: lead.company_name || lead.contact_name || "ליד", success: false, error: err.message });
        }
      }

      return results;
    },
    onSuccess: (results) => {
      setTestResults(results);
      const successCount = results.filter((r) => r.success).length;
      toast({ title: "בדיקה הושלמה", description: `${successCount}/${results.length} הצליחו` });
    },
    onError: (error: any) => {
      setTestResults([{ leadId: "", leadName: "", success: false, error: error.message }]);
      toast({ title: "שגיאה בבדיקה", description: error.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setSelectedLeadIds(new Set());
    setTestResults([]);
    setLastMessageData(null);
    setSearchQuery("");
    setInputMode("select");
    setManualData({ contact_name: "", company_name: "", phone: "", email: "", source: "", notes: "" });
    onOpenChange(false);
  };

  const canRunManual = !!(manualData.contact_name || manualData.phone || manualData.company_name);
  const canRunTest = isWhatsAppTrigger
    ? !!lastMessageData
    : inputMode === "manual"
      ? canRunManual
      : selectedLeadIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            בדיקה: {automationName}
          </DialogTitle>
          <DialogDescription>
            {isWhatsAppTrigger
              ? "משוך הודעה אחרונה מהווטסאפ או בחר לידים להרצה"
              : "בחר לידים מהמאגר והרץ את האוטומציה על כולם"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-2 px-1">

            {/* WhatsApp: Pull Last Message */}
            {isWhatsAppTrigger && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">משוך הודעה אחרונה מהווטסאפ</Label>
                  <Button variant="outline" size="sm" onClick={handleFetchLastMessage} disabled={isFetchingMessage}>
                    {isFetchingMessage ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <MessageSquare className="h-4 w-4 ml-1" />}
                    משוך הודעה
                  </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {triggerConfig?.source_filter === "group" && <Badge variant="secondary" className="text-xs">קבוצה ספציפית</Badge>}
                  {triggerConfig?.source_filter === "tagged_contact" && <Badge variant="secondary" className="text-xs">איש קשר מתויג</Badge>}
                  {triggerConfig?.keyword && <Badge variant="outline" className="text-xs">מילת מפתח: {triggerConfig.keyword}</Badge>}
                  {(!triggerConfig?.source_filter || triggerConfig?.source_filter === "all") && <Badge variant="secondary" className="text-xs">כל ההודעות</Badge>}
                </div>

                {lastMessageData && (
                  <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">הודעה שנמשכה:</p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{lastMessageData.sender_name}</span>
                        <Badge variant="outline" className="text-xs mr-1">
                          {lastMessageData.direction === "inbound" ? "נכנסת" : "יוצאת"}
                        </Badge>
                      </div>
                      {lastMessageData.sender_phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span dir="ltr">{lastMessageData.sender_phone}</span>
                        </div>
                      )}
                      {lastMessageData.group_name && (
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{lastMessageData.group_name}</span>
                        </div>
                      )}
                      <div className="rounded bg-background p-2 text-xs border mt-1">
                        {lastMessageData.message_text?.substring(0, 200)}
                        {lastMessageData.message_text?.length > 200 ? "..." : ""}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {lastMessageData.created_at && new Date(lastMessageData.created_at).toLocaleString("he-IL")}
                      </p>
                    </div>
                  </div>
                )}

                <div className="relative flex items-center gap-2">
                  <div className="flex-1 border-t" />
                  <span className="text-xs text-muted-foreground px-2">או בחר לידים</span>
                  <div className="flex-1 border-t" />
                </div>
              </div>
            )}

            {/* Input Mode Tabs */}
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "select" | "manual")} className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="select">בחירה מהמאגר</TabsTrigger>
                <TabsTrigger value="manual">הזנה ידנית</TabsTrigger>
              </TabsList>

              <TabsContent value="select" className="space-y-4 mt-3">
                {/* Date Range Tabs */}
                <div className="space-y-2">
                  <Label>טווח תאריכים:</Label>
                  <Tabs value={dateRange} onValueChange={(v) => { setDateRange(v as DateRange); setSelectedLeadIds(new Set()); }}>
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="today">היום</TabsTrigger>
                      <TabsTrigger value="yesterday">אתמול</TabsTrigger>
                      <TabsTrigger value="last_week">שבוע אחרון</TabsTrigger>
                      <TabsTrigger value="custom">טווח מותאם</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {dateRange === "custom" && (
                    <div className="flex gap-2 items-center">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-right", !customFrom && "text-muted-foreground")}>
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            {customFrom ? format(customFrom, "dd/MM/yyyy") : "מתאריך"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                      <span className="text-sm text-muted-foreground">עד</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-right", !customTo && "text-muted-foreground")}>
                            <CalendarIcon className="h-4 w-4 ml-2" />
                            {customTo ? format(customTo, "dd/MM/yyyy") : "עד תאריך"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>

                {/* Search + Select All */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="חיפוש לפי שם, טלפון, אימייל..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-9 text-right"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleAll} className="shrink-0 gap-1.5">
                      {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                        <><Square className="h-3.5 w-3.5" /> בטל הכל</>
                      ) : (
                        <><CheckSquare className="h-3.5 w-3.5" /> בחר הכל</>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{filteredLeads.length} לידים</Badge>
                    {selectedLeadIds.size > 0 && (
                      <Badge className="text-xs">{selectedLeadIds.size} נבחרו</Badge>
                    )}
                  </div>
                </div>

                {/* Lead List with Checkboxes */}
                <div className="rounded-lg border">
                  <ScrollArea className="max-h-[280px]">
                    {leadsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : filteredLeads.length === 0 ? (
                      <div className="text-center py-8 text-sm text-muted-foreground">לא נמצאו לידים בטווח הנבחר</div>
                    ) : (
                      <div className="divide-y">
                        {filteredLeads.map((lead: any) => (
                          <label
                            key={lead.id}
                            className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={selectedLeadIds.has(lead.id)}
                              onCheckedChange={() => toggleLead(lead.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{lead.company_name || "ללא שם"}</span>
                                {lead.source && <Badge variant="outline" className="text-[10px] shrink-0">{lead.source}</Badge>}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {lead.contact_name && <span>{lead.contact_name}</span>}
                                {lead.phone && <span dir="ltr">{lead.phone}</span>}
                                <span>{new Date(lead.created_at).toLocaleDateString("he-IL")}</span>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Parameters Preview for selected lead */}
                {selectedLeadIds.size === 1 && (() => {
                  const selectedId = Array.from(selectedLeadIds)[0];
                  const selectedLead = leads.find((l: any) => l.id === selectedId);
                  if (!selectedLead) return null;
                  
                  const fbParams: Array<{key: string; value: string}> = [];
                  const sysParams: Array<{key: string; value: string}> = [];
                  
                  // Parse fb_ fields from notes
                  if (selectedLead.notes) {
                    const lines = String(selectedLead.notes).split('\n');
                    for (const line of lines) {
                      const match = line.match(/^(fb_[^:]+):\s*(.+)$/);
                      if (match) {
                        fbParams.push({ key: match[1], value: match[2].trim() });
                      }
                    }
                  }
                  
                  // System fields
                  if (selectedLead.contact_name) sysParams.push({ key: 'contact_name', value: selectedLead.contact_name });
                  if (selectedLead.company_name) sysParams.push({ key: 'company_name', value: selectedLead.company_name });
                  if (selectedLead.phone) sysParams.push({ key: 'phone', value: selectedLead.phone });
                  if (selectedLead.email) sysParams.push({ key: 'email', value: selectedLead.email });
                  if (selectedLead.source) sysParams.push({ key: 'source', value: selectedLead.source });
                  
                  return (
                    <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        📋 פרמטרים שימשכו לטסט:
                      </p>
                      {fbParams.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">שדות פייסבוק:</p>
                          {fbParams.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded px-2 py-1">
                              <span className="font-mono font-medium">{`{{${p.key}}}`}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{p.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-1.5">
                          ⚠️ לא נמצאו שדות fb_ בהערות הליד. משתני פייסבוק לא יוחלפו.
                        </div>
                      )}
                      {sysParams.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium">שדות מערכת:</p>
                          {sysParams.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                              <span className="font-mono font-medium">{`{{${p.key}}}`}</span>
                              <span className="text-muted-foreground">→</span>
                              <span>{p.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="manual" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">שם איש קשר</Label>
                    <Input
                      placeholder="שם מלא"
                      value={manualData.contact_name}
                      onChange={(e) => setManualData(prev => ({ ...prev, contact_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">שם חברה</Label>
                    <Input
                      placeholder="שם החברה"
                      value={manualData.company_name}
                      onChange={(e) => setManualData(prev => ({ ...prev, company_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">טלפון</Label>
                    <Input
                      placeholder="05X-XXXXXXX"
                      dir="ltr"
                      className="text-left"
                      value={manualData.phone}
                      onChange={(e) => setManualData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">אימייל</Label>
                    <Input
                      placeholder="email@example.com"
                      dir="ltr"
                      className="text-left"
                      type="email"
                      value={manualData.email}
                      onChange={(e) => setManualData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">מקור</Label>
                    <Input
                      placeholder="פייסבוק, גוגל..."
                      value={manualData.source}
                      onChange={(e) => setManualData(prev => ({ ...prev, source: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">הערות</Label>
                  <Textarea
                    placeholder="הערות נוספות..."
                    rows={2}
                    value={manualData.notes}
                    onChange={(e) => setManualData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                {!canRunManual && (
                  <p className="text-xs text-muted-foreground">יש למלא לפחות שם, טלפון או שם חברה</p>
                )}
              </TabsContent>
            </Tabs>

            {/* Test Results */}
            {testResults.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">תוצאות הבדיקה ({testResults.filter(r => r.success).length}/{testResults.length} הצליחו):</p>
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1.5">
                    {testResults.map((result, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm rounded-md bg-muted/50 p-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{result.leadName}</p>
                          {result.error && <p className="text-xs text-destructive mt-0.5">{result.error}</p>}
                          {result.data?.results && Array.isArray(result.data.results) && (
                            <div className="space-y-1 mt-1">
                              {result.data.results.map((step: any, si: number) => (
                                <div key={si} className="text-xs flex items-center gap-1">
                                  {step.success ? <CheckCircle className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-destructive" />}
                                  <span>{step.step_type === "agent" ? "סוכן AI" : step.action_type || step.step_type}</span>
                                  {step.error && <span className="text-destructive">- {step.error}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            סגור
          </Button>
          <Button
            onClick={() => testMutation.mutate()}
            disabled={!canRunTest || testMutation.isPending}
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מריץ...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 ml-2" />
                {inputMode === "manual" ? "הרץ טסט ידני" : selectedLeadIds.size > 1 ? `הרץ על ${selectedLeadIds.size} לידים` : "הרץ טסט"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
