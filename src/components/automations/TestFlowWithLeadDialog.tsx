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

  // Test mutation - direct execution mode
  const testMutation = useMutation({
    mutationFn: async () => {
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

      // Include custom_fields if present
      if (selectedLead.custom_fields && typeof selectedLead.custom_fields === "object") {
        const cf = selectedLead.custom_fields as Record<string, any>;
        Object.entries(cf).forEach(([key, value]) => {
          testData[`fb_${key}`] = value;
          testData[key] = value;
        });
      }

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
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            בדיקה עם ליד: {automationName}
          </DialogTitle>
          <DialogDescription>
            בחר ליד קיים מהמאגר והרץ את האוטומציה על הנתונים שלו
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="space-y-4 py-2 px-1">
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
            {selectedLead && (
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

                {/* Custom fields preview */}
                {selectedLead.custom_fields && typeof selectedLead.custom_fields === "object" && Object.keys(selectedLead.custom_fields as object).length > 0 && (
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs font-medium text-blue-600 mb-1">שדות פייסבוק:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(selectedLead.custom_fields as Record<string, any>).map(([key, val]) => (
                        <Badge key={key} variant="outline" className="text-xs border-blue-300 text-blue-600 bg-blue-50">
                          {key}: {String(val)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
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
            disabled={!selectedLeadId || testMutation.isPending}
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
