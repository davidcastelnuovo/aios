import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Zap, Activity, Trash2, Edit, TestTube } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AddAutomationForm } from "@/components/forms/AddAutomationForm";
import { EditAutomationDialog } from "@/components/forms/EditAutomationDialog";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TRIGGER_LABELS: Record<string, string> = {
  task_assigned: "משימה שוייכה",
  task_status_changed: "סטטוס משימה השתנה",
  lead_status_changed: "סטטוס ליד השתנה",
  lead_created: "ליד נוצר",
  client_created: "לקוח נוצר",
  client_status_changed: "סטטוס לקוח השתנה",
  onboarding_status_changed: "סטטוס קליטה השתנה",
};

const ACTION_LABELS: Record<string, string> = {
  webhook: "Webhook",
  email: "אימייל",
  notification: "התראה",
  update_status: "שינוי סטטוס",
};

export default function Automations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [selectedAutomationId, setSelectedAutomationId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<any>(null);
  const { tenantId } = useCurrentTenant();

  // Fetch automations
  const { data: automations, isLoading } = useQuery({
    queryKey: ["automations", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch logs for selected automation
  const { data: logs } = useQuery({
    queryKey: ["automation-logs", selectedAutomationId],
    queryFn: async () => {
      if (!selectedAutomationId) return [];
      
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .eq("automation_id", selectedAutomationId)
        .order("triggered_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedAutomationId,
  });

  // Toggle automation active status
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("automations")
        .update({ active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "אוטומציה עודכנה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete automation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automations")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      toast({
        title: "אוטומציה נמחקה",
      });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test automation
  const testMutation = useMutation({
    mutationFn: async (automation: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenantUser } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      const response = await supabase.functions.invoke('trigger-automation', {
        body: {
          trigger_type: automation.trigger_type,
          tenant_id: tenantUser?.tenant_id,
          data: {
            test: true,
            automation_name: automation.name,
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "בדיקה הופעלה",
        description: "בדוק את הלוגים לתוצאות",
      });
      queryClient.invalidateQueries({ queryKey: ["automation-logs"] });
    },
    onError: (error: any) => {
      toast({
        title: "שגיאה בבדיקה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleViewLogs = (automationId: string) => {
    setSelectedAutomationId(automationId);
    setLogsDialogOpen(true);
  };

  const handleEdit = (automation: any) => {
    setSelectedAutomation(automation);
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6 p-3 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 md:h-8 md:w-8" />
            אוטומציות
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            נהל אוטומציות והזרמות נתונים למערכות חיצוניות
          </p>
        </div>
        <AddAutomationForm />
      </div>

      {/* Automations Grid */}
      <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">
        {automations?.map((automation) => (
          <Card key={automation.id} className={automation.active ? "" : "opacity-60"}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base md:text-lg truncate">
                    {automation.name}
                  </CardTitle>
                  {automation.description && (
                    <CardDescription className="text-xs mt-1 line-clamp-2">
                      {automation.description}
                    </CardDescription>
                  )}
                </div>
                <Switch
                  checked={automation.active}
                  onCheckedChange={(checked) =>
                    toggleActiveMutation.mutate({ id: automation.id, active: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">
                  {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                </Badge>
                <Badge variant="secondary">
                  {ACTION_LABELS[automation.action_type] || automation.action_type}
                </Badge>
              </div>

              {(automation.configuration as any)?.url && (
                <p className="text-xs text-muted-foreground truncate">
                  URL: {(automation.configuration as any).url}
                </p>
              )}

              {automation.action_type === "update_status" && (automation.configuration as any)?.entity && (
                <p className="text-xs text-muted-foreground">
                  עדכון סטטוס: {(automation.configuration as any).entity === "lead" ? "ליד" : "משימה"} → {(automation.configuration as any).status}
                </p>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewLogs(automation.id)}
                  className="flex-1 min-w-0"
                >
                  <Activity className="h-3 w-3 ml-1" />
                  לוגים
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => testMutation.mutate(automation)}
                  disabled={testMutation.isPending}
                >
                  <TestTube className="h-3 w-3 ml-1" />
                  בדיקה
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(automation)}
                >
                  <Edit className="h-3 w-3 ml-1" />
                  עריכה
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("האם למחוק אוטומציה זו?")) {
                      deleteMutation.mutate(automation.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {automations?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              אין עדיין אוטומציות במערכת
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      {selectedAutomation && (
        <EditAutomationDialog
          automation={selectedAutomation}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
        />
      )}

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>לוגי הפעלה</DialogTitle>
            <DialogDescription>
              50 הרצות אחרונות של האוטומציה
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>תאריך</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>זמן ביצוע</TableHead>
                  <TableHead>פרטים</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {new Date(log.triggered_at).toLocaleString("he-IL")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.success ? "default" : "destructive"}>
                        {log.success ? "הצליח" : "נכשל"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.execution_time_ms}ms
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-xs">
                      {log.error_message || (log.response as any)?.statusText || "OK"}
                    </TableCell>
                  </TableRow>
                ))}
                {logs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      אין לוגים עדיין
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
