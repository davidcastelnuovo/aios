import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Merge, Check } from "lucide-react";
import { format } from "date-fns";

interface DuplicateGroup {
  key: string;
  type: "phone" | "email";
  value: string;
  leads: any[];
}

interface MergeLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DuplicateGroup;
  onMergeComplete: () => void;
}

interface FieldSelection {
  [fieldName: string]: string; // leadId
}

const MERGE_FIELDS = [
  { key: "company_name", label: "שם חברה" },
  { key: "contact_name", label: "שם איש קשר" },
  { key: "phone", label: "טלפון" },
  { key: "email", label: "אימייל" },
  { key: "status", label: "שלב במשפך" },
  { key: "response_status", label: "סטטוס תגובה" },
  { key: "agency_id", label: "סוכנות" },
  { key: "source", label: "מקור" },
  { key: "campaign_name", label: "קמפיין" },
  { key: "monthly_budget", label: "תקציב חודשי" },
  { key: "notes", label: "הערות" },
  { key: "meeting_date", label: "תאריך פגישה" },
  { key: "meeting_time", label: "שעת פגישה" },
];

export function MergeLeadsDialog({
  open,
  onOpenChange,
  group,
  onMergeComplete,
}: MergeLeadsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize field selections - prefer oldest lead (first) or the one with value
  const initialSelections = useMemo(() => {
    const selections: FieldSelection = {};
    
    MERGE_FIELDS.forEach((field) => {
      // Find first lead with a non-empty value for this field
      const leadWithValue = group.leads.find((lead) => {
        const value = lead[field.key];
        return value !== null && value !== undefined && value !== "";
      });
      
      selections[field.key] = leadWithValue?.id || group.leads[0].id;
    });

    return selections;
  }, [group.leads]);

  const [fieldSelections, setFieldSelections] = useState<FieldSelection>(initialSelections);

  // Update selection for a field
  const updateSelection = (fieldKey: string, leadId: string) => {
    setFieldSelections((prev) => ({
      ...prev,
      [fieldKey]: leadId,
    }));
  };

  // Get display value for a field
  const getDisplayValue = (lead: any, fieldKey: string) => {
    const value = lead[fieldKey];
    
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground">-</span>;
    }

    if (fieldKey === "agency_id") {
      return lead.agencies?.name || value;
    }

    if (fieldKey === "monthly_budget") {
      return `₪${Number(value).toLocaleString()}`;
    }

    if (fieldKey === "meeting_date" && value) {
      return format(new Date(value), "dd/MM/yyyy");
    }

    if (fieldKey === "notes" && typeof value === "string" && value.length > 50) {
      return value.substring(0, 50) + "...";
    }

    return String(value);
  };

  // Merge mutation
  const mergeMutation = useMutation({
    mutationFn: async () => {
      // Build the merged lead data
      const masterLead = group.leads[0]; // Keep the oldest lead as master
      const mergedData: Record<string, any> = {};

      MERGE_FIELDS.forEach((field) => {
        const selectedLeadId = fieldSelections[field.key];
        const selectedLead = group.leads.find((l) => l.id === selectedLeadId);
        if (selectedLead && selectedLead[field.key] !== null && selectedLead[field.key] !== undefined) {
          mergedData[field.key] = selectedLead[field.key];
        }
      });

      // Combine notes from all leads
      const allNotes = group.leads
        .map((lead) => lead.notes)
        .filter((note) => note && note.trim())
        .join("\n---\n");
      
      if (allNotes) {
        mergedData.notes = allNotes;
      }

      // Update the master lead with merged data
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          ...mergedData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", masterLead.id);

      if (updateError) throw updateError;

      // Move all lead_updates to master lead
      const otherLeadIds = group.leads.slice(1).map((l) => l.id);
      
      if (otherLeadIds.length > 0) {
        const { error: updateUpdatesError } = await supabase
          .from("lead_updates")
          .update({ lead_id: masterLead.id })
          .in("lead_id", otherLeadIds);

        if (updateUpdatesError) {
          console.error("Error moving lead updates:", updateUpdatesError);
        }

        // Move chat_contact_tags
        const { error: tagsError } = await supabase
          .from("chat_contact_tags")
          .update({ lead_id: masterLead.id })
          .in("lead_id", otherLeadIds);

        if (tagsError) {
          console.error("Error moving chat tags:", tagsError);
        }

        // Move tasks
        const { error: tasksError } = await supabase
          .from("tasks")
          .update({ lead_id: masterLead.id })
          .in("lead_id", otherLeadIds);

        if (tasksError) {
          console.error("Error moving tasks:", tasksError);
        }

        // Move chat_messages
        const { error: messagesError } = await supabase
          .from("chat_messages")
          .update({ lead_id: masterLead.id })
          .in("lead_id", otherLeadIds);

        if (messagesError) {
          console.error("Error moving chat messages:", messagesError);
        }

        // Delete the duplicate leads
        const { error: deleteError } = await supabase
          .from("leads")
          .delete()
          .in("id", otherLeadIds);

        if (deleteError) throw deleteError;
      }

      return otherLeadIds.length;
    },
    onSuccess: (deletedCount) => {
      toast({
        title: "לידים מוזגו בהצלחה",
        description: `${deletedCount} לידים כפולים מוזגו לליד אחד`,
      });
      onMergeComplete();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה במיזוג לידים",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            מיזוג {group.leads.length} לידים
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          בחר את הערך המועדף עבור כל שדה. הליד הראשון (הישן ביותר) ישמש כבסיס והאחרים יימחקו.
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="border-b">
                  <th className="text-right p-3 font-semibold w-32">שדה</th>
                  {group.leads.map((lead, idx) => (
                    <th key={lead.id} className="text-right p-3 font-semibold min-w-[150px]">
                      <div className="flex flex-col gap-1">
                        <span>ליד {idx + 1}</span>
                        {idx === 0 && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 w-fit"
                          >
                            ראשון
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground font-normal">
                          {format(new Date(lead.created_at), "dd/MM/yy HH:mm")}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MERGE_FIELDS.map((field) => (
                  <tr key={field.key} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{field.label}</td>
                    {group.leads.map((lead) => {
                      const isSelected = fieldSelections[field.key] === lead.id;
                      const hasValue = lead[field.key] !== null && 
                                       lead[field.key] !== undefined && 
                                       lead[field.key] !== "";
                      
                      return (
                        <td
                          key={lead.id}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-primary/10 ring-2 ring-primary ring-inset"
                              : hasValue
                              ? "hover:bg-muted"
                              : "text-muted-foreground"
                          }`}
                          onClick={() => hasValue && updateSelection(field.key, lead.id)}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            )}
                            <span className={!hasValue ? "italic" : ""}>
                              {getDisplayValue(lead, field.key)}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={() => mergeMutation.mutate()}
            disabled={mergeMutation.isPending}
          >
            {mergeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ממזג...
              </>
            ) : (
              <>
                <Merge className="h-4 w-4 ml-2" />
                מזג לידים
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
