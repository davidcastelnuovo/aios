import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronLeft,
  Clock,
  Bot,
  MessageSquare,
  Zap,
  RefreshCw,
  Send,
  ClipboardList,
  UserPlus,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  automationId: string;
}

const ACTION_ICONS: Record<string, any> = {
  agent: Bot,
  send_whatsapp: Send,
  send_greenapi_message: MessageSquare,
  send_greenapi_to_campaigner: MessageSquare,
  webhook: Zap,
  add_lead_update: ClipboardList,
  add_client_update: ClipboardList,
  create_task: ClipboardList,
  create_lead: UserPlus,
  create_manychat_subscriber: UserPlus,
  update_status: ArrowLeftRight,
};

const ACTION_LABELS: Record<string, string> = {
  agent: "סוכן AI",
  send_whatsapp: "שליחת WhatsApp",
  send_greenapi_message: "WhatsApp (Green API)",
  send_greenapi_to_campaigner: "WhatsApp לקמפיינר",
  webhook: "Webhook",
  add_lead_update: "עדכון ליד",
  add_client_update: "עדכון לקוח",
  create_task: "יצירת משימה",
  create_lead: "יצירת ליד",
  create_manychat_subscriber: "יצירת מנוי ManyChat",
  update_status: "עדכון סטטוס",
};

export function ExecutionHistoryPanel({
  open,
  onClose,
  automationId,
}: ExecutionHistoryPanelProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["automation-logs-flow", automationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("automation_id", automationId)
        .order("triggered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!automationId,
  });

  const toggleLog = (logId: string) => {
    setExpandedLogId((prev) => (prev === logId ? null : logId));
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[460px] sm:w-[520px] p-0 flex flex-col" dir="rtl">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              היסטוריית ריצות
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-8 w-8">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>אין ריצות עדיין</p>
              <p className="text-xs mt-1">הרץ טסט כדי לראות תוצאות כאן</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const response = log.response as any;
                const payload = log.payload as any;
                const flowSteps = response?.steps || [];
                const isFlow = response?.flow === true;
                const agentOutput = response?.agent_output;
                const triggeredAt = new Date(log.triggered_at);

                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleLog(log.id)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-right p-3 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          {log.success ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {triggeredAt.toLocaleDateString("he-IL")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {triggeredAt.toLocaleTimeString("he-IL")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {log.execution_time_ms && (
                                <span className="text-xs text-muted-foreground">
                                  {log.execution_time_ms}ms
                                </span>
                              )}
                              {isFlow && flowSteps.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {flowSteps.filter((s: any) => s.success).length}/{flowSteps.length} שלבים
                                </span>
                              )}
                              {log.error_message && (
                                <Badge variant="destructive" className="text-[10px] h-4">
                                  שגיאה
                                </Badge>
                              )}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 space-y-3">
                        {/* Error message */}
                        {log.error_message && (
                          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                            <p className="text-xs text-destructive font-medium">שגיאה:</p>
                            <p className="text-xs text-destructive mt-0.5">{log.error_message}</p>
                          </div>
                        )}

                        {/* Payload summary */}
                        {payload && (
                          <div className="rounded-md bg-muted/50 p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">נתונים שנשלחו:</p>
                            <div className="flex flex-wrap gap-1">
                              {payload.contact_name && (
                                <Badge variant="outline" className="text-[10px]">
                                  {payload.contact_name}
                                </Badge>
                              )}
                              {payload.company_name && (
                                <Badge variant="outline" className="text-[10px]">
                                  {payload.company_name}
                                </Badge>
                              )}
                              {payload.phone && (
                                <Badge variant="outline" className="text-[10px]" dir="ltr">
                                  {payload.phone}
                                </Badge>
                              )}
                              {payload.lead_id && (
                                <Badge variant="secondary" className="text-[10px]">
                                  ליד
                                </Badge>
                              )}
                              {payload.test && (
                                <Badge variant="secondary" className="text-[10px]">
                                  טסט
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Flow steps */}
                        {isFlow && flowSteps.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">שלבים:</p>
                            {flowSteps.map((step: any, idx: number) => {
                              const StepIcon = ACTION_ICONS[step.action_type] || Zap;
                              const stepLabel = ACTION_LABELS[step.action_type] || step.action_type;
                              const stepOutput = step.response?.output || step.response?.message;

                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    "rounded-md border p-2 text-xs",
                                    step.success
                                      ? "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900"
                                      : "border-destructive/30 bg-destructive/5"
                                  )}
                                >
                                  <div className="flex items-center gap-1.5">
                                    {step.success ? (
                                      <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                                    )}
                                    <StepIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-medium">{stepLabel}</span>
                                  </div>

                                  {/* Agent output - this is the key debugging info */}
                                  {step.action_type === "agent" && stepOutput && (
                                    <div className="mt-1.5 rounded bg-muted p-2">
                                      <p className="text-[10px] font-medium text-muted-foreground mb-0.5">תוצאת הסוכן:</p>
                                      <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">
                                        {stepOutput}
                                      </p>
                                    </div>
                                  )}

                                  {/* Agent error details */}
                                  {step.action_type === "agent" && !step.success && step.error && (
                                    <div className="mt-1.5 rounded bg-destructive/10 p-2">
                                      <p className="text-[10px] font-medium text-destructive mb-0.5">שגיאת סוכן:</p>
                                      <p className="whitespace-pre-wrap break-words text-xs text-destructive">
                                        {step.error}
                                      </p>
                                    </div>
                                  )}

                                  {/* Agent command sent */}
                                  {step.action_type === "agent" && step.response?.command_text && (
                                    <div className="mt-1 rounded bg-muted/50 p-1.5">
                                      <p className="text-[10px] text-muted-foreground">
                                        פקודה: {step.response.command_text}
                                      </p>
                                    </div>
                                  )}

                                  {/* WhatsApp step details */}
                                  {(step.action_type === "send_whatsapp" || step.action_type === "send_greenapi_message") && step.response && (
                                    <div className="mt-1 text-[10px] text-muted-foreground">
                                      {step.response.subscriber_id && (
                                        <span>Subscriber: {step.response.subscriber_id}</span>
                                      )}
                                      {step.response.message_sent !== undefined && (
                                        <span className="mr-2">
                                          {step.response.message_sent ? "✅ נשלח" : "❌ לא נשלח"}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Generic error for non-agent steps */}
                                  {step.action_type !== "agent" && step.error && (
                                    <p className="mt-1 text-[10px] text-destructive">{step.error}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Agent output summary for quick view */}
                        {agentOutput && !flowSteps.some((s: any) => s.action_type === "agent") && (
                          <div className="rounded-md bg-muted p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">תוצאת סוכן AI:</p>
                            <p className="text-xs whitespace-pre-wrap">{agentOutput}</p>
                          </div>
                        )}

                        {/* Non-flow response */}
                        {!isFlow && response && !log.error_message && (
                          <div className="rounded-md bg-muted/50 p-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">תגובה:</p>
                            <pre className="text-[10px] overflow-auto max-h-32 whitespace-pre-wrap" dir="ltr">
                              {JSON.stringify(response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
