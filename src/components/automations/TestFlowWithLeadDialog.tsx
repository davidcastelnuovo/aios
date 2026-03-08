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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ChevronsUpDown,
  TestTube,
  Loader2,
  CheckCircle,
  XCircle,
  User,
  Phone,
  Mail,
  Building2,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TestFlowWithLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

export function TestFlowWithLeadDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
}: TestFlowWithLeadDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();

  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [lastMessageData, setLastMessageData] = useState<any>(null);
  const [isFetchingMessage, setIsFetchingMessage] = useState(false);

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

  // Fetch leads with full details
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-flow-test", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, phone, email, source, notes, agency_id, manychat_subscriber_id, status, industry")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  const selectedLead = leads.find((l: any) => l.id === selectedLeadId);

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

      // Apply filters based on trigger configuration
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
        toast({
          title: "לא נמצאה הודעה",
          description: "לא נמצאה הודעה תואמת להגדרות הטריגר",
          variant: "destructive",
        });
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

      toast({
        title: "הודעה נטענה",
        description: `"${data.message_text?.substring(0, 50)}..." מ-${msgData.sender_name}`,
      });
    } catch (err: any) {
      toast({
        title: "שגיאה בשליפת הודעה",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsFetchingMessage(false);
    }
  };

  // Test mutation - direct execution mode
  const testMutation = useMutation({
    mutationFn: async () => {
      // If we have last message data (for whatsapp trigger), use it
      if (lastMessageData && isWhatsAppTrigger) {
        const response = await supabase.functions.invoke("trigger-automation", {
          body: {
            automationId,
            tenant_id: tenantId,
            data: {
              test: true,
              ...lastMessageData,
              timestamp: new Date().toISOString(),
            },
          },
        });
        if (response.error) throw response.error;
        return response.data;
      }

      // Original lead-based test
      if (!selectedLeadId || !selectedLead) {
        throw new Error("יש לבחור ליד לבדיקה");
      }

      const testData: any = {
        test: true,
        lead_id: selectedLeadId,
        contact_name: selectedLead.contact_name || selectedLead.company_name,
        company_name: selectedLead.company_name,
        phone: selectedLead.phone,
        email: selectedLead.email,
        source: selectedLead.source,
        notes: selectedLead.notes,
        industry: selectedLead.industry,
        manychat_subscriber_id: selectedLead.manychat_subscriber_id,
        timestamp: new Date().toISOString(),
      };

      const response = await supabase.functions.invoke("trigger-automation", {
        body: {
          automationId,
          tenant_id: tenantId,
          data: testData,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({ title: "בדיקה הושלמה", description: "בדוק את התוצאות למטה" });
    },
    onError: (error: any) => {
      setTestResult({ error: error.message });
      toast({
        title: "שגיאה בבדיקה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setSelectedLeadId("");
    setTestResult(null);
    setLastMessageData(null);
    onOpenChange(false);
  };

  const canRunTest = isWhatsAppTrigger ? !!lastMessageData : !!selectedLeadId;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            בדיקה: {automationName}
          </DialogTitle>
          <DialogDescription>
            {isWhatsAppTrigger
              ? "משוך הודעה אחרונה מהווטסאפ או בחר ליד להרצה"
              : "בחר ליד קיים מהמאגר והרץ את האוטומציה על הנתונים שלו"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-2 px-1">

            {/* WhatsApp: Pull Last Message */}
            {isWhatsAppTrigger && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">משוך הודעה אחרונה מהווטסאפ</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFetchLastMessage}
                    disabled={isFetchingMessage}
                  >
                    {isFetchingMessage ? (
                      <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 ml-1" />
                    )}
                    משוך הודעה
                  </Button>
                </div>

                {/* Show trigger filters info */}
                <div className="flex flex-wrap gap-1.5">
                  {triggerConfig?.source_filter === "group" && (
                    <Badge variant="secondary" className="text-xs">קבוצה ספציפית</Badge>
                  )}
                  {triggerConfig?.source_filter === "tagged_contact" && (
                    <Badge variant="secondary" className="text-xs">איש קשר מתויג</Badge>
                  )}
                  {triggerConfig?.keyword && (
                    <Badge variant="outline" className="text-xs">מילת מפתח: {triggerConfig.keyword}</Badge>
                  )}
                  {!triggerConfig?.source_filter || triggerConfig?.source_filter === "all" ? (
                    <Badge variant="secondary" className="text-xs">כל ההודעות</Badge>
                  ) : null}
                </div>

                {/* Last message preview */}
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
                  <span className="text-xs text-muted-foreground px-2">או בחר ליד</span>
                  <div className="flex-1 border-t" />
                </div>
              </div>
            )}

            {/* Lead Selection */}
            <div className="space-y-2">
              <Label>בחר ליד:</Label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between"
                  >
                    {selectedLead
                      ? `${selectedLead.company_name || ""} ${selectedLead.contact_name ? `(${selectedLead.contact_name})` : ""}`
                      : "חיפוש לפי שם, טלפון, חברה..."}
                    <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="חיפוש ליד..." />
                    <CommandList>
                      <CommandEmpty>לא נמצאו לידים</CommandEmpty>
                      <CommandGroup>
                        {leads.map((lead: any) => (
                          <CommandItem
                            key={lead.id}
                            value={`${lead.company_name || ""} ${lead.contact_name || ""} ${lead.phone || ""}`}
                            onSelect={() => {
                              setSelectedLeadId(lead.id);
                              setComboOpen(false);
                              setTestResult(null);
                              setLastMessageData(null); // Clear message data when selecting lead
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{lead.company_name || "ללא שם"}</span>
                              <span className="text-xs text-muted-foreground">
                                {[lead.contact_name, lead.phone].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Lead Preview */}
            {selectedLead && !lastMessageData && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">פרטי הליד שנבחר:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {selectedLead.contact_name && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{selectedLead.contact_name}</span>
                    </div>
                  )}
                  {selectedLead.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span dir="ltr">{selectedLead.phone}</span>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-1.5 col-span-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{selectedLead.email}</span>
                    </div>
                  )}
                  {selectedLead.company_name && (
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{selectedLead.company_name}</span>
                    </div>
                  )}
                  {selectedLead.source && (
                    <div>
                      <Badge variant="secondary" className="text-xs">{selectedLead.source}</Badge>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Test Results */}
            {testResult && (
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-sm font-medium">תוצאות הבדיקה:</p>
                {testResult.error ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span className="text-sm">{testResult.error}</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Overall status */}
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">האוטומציה הורצה בהצלחה</span>
                    </div>

                    {/* Step results */}
                    {testResult.results && Array.isArray(testResult.results) && (
                      <div className="space-y-1.5 mt-2">
                        {testResult.results.map((step: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-sm rounded-md bg-muted/50 p-2"
                          >
                            {step.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">
                                {step.step_type === "agent" ? "סוכן AI" : step.action_type || step.step_type}
                              </p>
                              {step.output && (
                                <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                                  {typeof step.output === "string" ? step.output : JSON.stringify(step.output, null, 2)}
                                </p>
                              )}
                              {step.error && (
                                <p className="text-xs text-destructive mt-0.5">{step.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Raw response fallback */}
                    {!testResult.results && (
                      <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-40" dir="ltr">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
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
                הרץ טסט
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
