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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Check, ChevronsUpDown, TestTube, Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestAutomationDialogProps {
  automation: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TestAutomationDialog({ automation, open, onOpenChange }: TestAutomationDialogProps) {
  const { tenantId } = useCurrentTenant();
  const { toast } = useToast();
  
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [leadComboOpen, setLeadComboOpen] = useState(false);
  const [clientComboOpen, setClientComboOpen] = useState(false);
  
  // Meeting details for meeting_created trigger
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingTime, setMeetingTime] = useState("10:00");
  const [meetingLocation, setMeetingLocation] = useState("משרד ראשי");
  
  const [testResult, setTestResult] = useState<any>(null);

  // Fetch leads
  const { data: leads = [] } = useQuery({
    queryKey: ["leads-for-test", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, phone")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Fetch clients
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-test", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, contact_name, phone")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!tenantId,
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      if (!selectedLeadId && !selectedClientId) {
        throw new Error("יש לבחור ליד או לקוח לבדיקה");
      }

      const testData: any = {
        test: true,
        automation_name: automation.name,
        timestamp: new Date().toISOString(),
      };

      if (selectedLeadId) {
        testData.lead_id = selectedLeadId;
      }
      if (selectedClientId) {
        testData.client_id = selectedClientId;
      }

      // Add meeting details for meeting_created trigger
      if (automation.trigger_type === "meeting_created") {
        testData.meeting_date = meetingDate;
        testData.meeting_time = meetingTime;
        testData.meeting_location = meetingLocation;
        
        const selectedLead = leads.find((l: any) => l.id === selectedLeadId);
        const selectedClient = clients.find((c: any) => c.id === selectedClientId);
        testData.contact_name = selectedLead?.contact_name || selectedClient?.contact_name || "איש קשר";
      }

      const response = await supabase.functions.invoke('trigger-automation', {
        body: {
          trigger_type: automation.trigger_type,
          tenant_id: tenantId,
          data: testData,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: (data) => {
      setTestResult(data);
      toast({
        title: "בדיקה הושלמה",
        description: "בדוק את התוצאות למטה",
      });
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
    setSelectedClientId("");
    setTestResult(null);
    onOpenChange(false);
  };

  const selectedLead = leads.find((l: any) => l.id === selectedLeadId);
  const selectedClient = clients.find((c: any) => c.id === selectedClientId);
  const isMeetingTrigger = automation?.trigger_type === "meeting_created";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            בדיקת אוטומציה: {automation?.name}
          </DialogTitle>
          <DialogDescription>
            בחר ליד או לקוח אמיתי להרצת בדיקה
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lead Selection */}
          <div className="space-y-2">
            <Label>בחר ליד לבדיקה:</Label>
            <Popover open={leadComboOpen} onOpenChange={setLeadComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={leadComboOpen}
                  className="w-full justify-between"
                  disabled={!!selectedClientId}
                >
                  {selectedLead
                    ? `${selectedLead.company_name} ${selectedLead.contact_name ? `(${selectedLead.contact_name})` : ''}`
                    : "חיפוש ליד..."}
                  <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש לפי שם..." />
                  <CommandList>
                    <CommandEmpty>לא נמצאו לידים</CommandEmpty>
                    <CommandGroup>
                      {leads.map((lead: any) => (
                        <CommandItem
                          key={lead.id}
                          value={`${lead.company_name} ${lead.contact_name || ''}`}
                          onSelect={() => {
                            setSelectedLeadId(lead.id);
                            setSelectedClientId("");
                            setLeadComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{lead.company_name}</span>
                            {lead.contact_name && (
                              <span className="text-xs text-muted-foreground">{lead.contact_name}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="text-center text-sm text-muted-foreground">── או ──</div>

          {/* Client Selection */}
          <div className="space-y-2">
            <Label>בחר לקוח לבדיקה:</Label>
            <Popover open={clientComboOpen} onOpenChange={setClientComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientComboOpen}
                  className="w-full justify-between"
                  disabled={!!selectedLeadId}
                >
                  {selectedClient
                    ? `${selectedClient.name} ${selectedClient.contact_name ? `(${selectedClient.contact_name})` : ''}`
                    : "חיפוש לקוח..."}
                  <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="חיפוש לפי שם..." />
                  <CommandList>
                    <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                    <CommandGroup>
                      {clients.map((client: any) => (
                        <CommandItem
                          key={client.id}
                          value={`${client.name} ${client.contact_name || ''}`}
                          onSelect={() => {
                            setSelectedClientId(client.id);
                            setSelectedLeadId("");
                            setClientComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedClientId === client.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{client.name}</span>
                            {client.contact_name && (
                              <span className="text-xs text-muted-foreground">{client.contact_name}</span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Meeting Details for meeting_created trigger */}
          {isMeetingTrigger && (selectedLeadId || selectedClientId) && (
            <div className="space-y-3 border-t pt-4">
              <Label className="font-medium">פרטי פגישה לדוגמה:</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">תאריך</Label>
                  <Input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">שעה</Label>
                  <Input
                    type="time"
                    value={meetingTime}
                    onChange={(e) => setMeetingTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">מיקום</Label>
                <Input
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="משרד ראשי"
                />
              </div>
            </div>
          )}

          {/* Test Results */}
          {testResult && (
            <div className="space-y-2 border-t pt-4">
              <Label className="font-medium">תוצאות:</Label>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                {testResult.error ? (
                  <div className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>{testResult.error}</span>
                  </div>
                ) : (
                  <>
                    {testResult.results?.map((result: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        {result.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>{result.automation_name}</span>
                        {result.error && (
                          <span className="text-xs text-destructive">({result.error})</span>
                        )}
                      </div>
                    ))}
                    {testResult.automations_found !== undefined && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <span>נמצאו {testResult.automations_found} אוטומציות מתאימות</span>
                      </div>
                    )}
                    {testResult.results?.length > 0 && testResult.results.every((r: any) => r.success) && (
                      <div className="flex items-center gap-2 text-green-600 font-medium pt-2 border-t">
                        <CheckCircle className="h-5 w-5" />
                        <span>האוטומציה הופעלה בהצלחה!</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            סגור
          </Button>
          <Button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || (!selectedLeadId && !selectedClientId)}
          >
            {testMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מריץ בדיקה...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 ml-2" />
                הרץ בדיקה
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
