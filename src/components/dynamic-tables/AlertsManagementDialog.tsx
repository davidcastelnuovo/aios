import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Bell, Plus, Trash2, Edit2, X } from "lucide-react";

interface AlertsManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
}

interface ReportAlert {
  id: string;
  name: string;
  metric: string;
  comparison_type: string;
  operator: string;
  threshold: number;
  is_percentage: boolean;
  is_active: boolean;
}

const METRICS = [
  { value: "cost_per_lead", label: "עלות לליד" },
  { value: "spend", label: "הוצאות" },
  { value: "leads", label: "לידים" },
  { value: "impressions", label: "חשיפות" },
  { value: "clicks", label: "קליקים" },
  { value: "ctr", label: "CTR" },
  { value: "cpm", label: "CPM" },
  { value: "account_status", label: "חסימת חשבון/אשראי" },
];

const COMPARISON_TYPES = [
  { value: "week_over_week", label: "שבוע מול שבוע קודם" },
  { value: "month_over_month", label: "חודש מול חודש קודם" },
  { value: "vs_target", label: "מול יעד קבוע" },
  { value: "no_data", label: "אין נתונים (חסימה)" },
];

const OPERATORS = [
  { value: "increase", label: "עליה של יותר מ-" },
  { value: "decrease", label: "ירידה של יותר מ-" },
  { value: "above", label: "מעל" },
  { value: "below", label: "מתחת ל-" },
  { value: "no_data_days", label: "אין נתונים במשך X ימים" },
];

export function AlertsManagementDialog({
  open,
  onOpenChange,
  tableId,
}: AlertsManagementDialogProps) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingAlert, setEditingAlert] = useState<ReportAlert | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    metric: "cost_per_lead",
    comparison_type: "week_over_week",
    operator: "increase",
    threshold: 20,
    is_percentage: true,
    is_active: true,
  });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["report-alerts", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_alerts")
        .select("*")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as ReportAlert[];
    },
    enabled: !!tableId && open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("report_alerts").insert({
        tenant_id: tenantId,
        table_id: tableId,
        ...data,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-alerts", tableId] });
      toast.success("התראה נוצרה בהצלחה");
      resetForm();
    },
    onError: () => {
      toast.error("שגיאה ביצירת התראה");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<typeof formData>;
    }) => {
      const { error } = await supabase
        .from("report_alerts")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-alerts", tableId] });
      toast.success("התראה עודכנה בהצלחה");
      resetForm();
    },
    onError: () => {
      toast.error("שגיאה בעדכון התראה");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_alerts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-alerts", tableId] });
      toast.success("התראה נמחקה");
    },
    onError: () => {
      toast.error("שגיאה במחיקת התראה");
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      metric: "cost_per_lead",
      comparison_type: "week_over_week",
      operator: "increase",
      threshold: 20,
      is_percentage: true,
      is_active: true,
    });
    setIsAddingNew(false);
    setEditingAlert(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("נא להזין שם להתראה");
      return;
    }

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (alert: ReportAlert) => {
    setFormData({
      name: alert.name,
      metric: alert.metric,
      comparison_type: alert.comparison_type,
      operator: alert.operator,
      threshold: alert.threshold,
      is_percentage: alert.is_percentage,
      is_active: alert.is_active,
    });
    setEditingAlert(alert);
    setIsAddingNew(true);
  };

  const handleToggleActive = (alert: ReportAlert) => {
    updateMutation.mutate({
      id: alert.id,
      data: { is_active: !alert.is_active },
    });
  };

  const getMetricLabel = (value: string) =>
    METRICS.find((m) => m.value === value)?.label || value;
  const getComparisonLabel = (value: string) =>
    COMPARISON_TYPES.find((c) => c.value === value)?.label || value;
  const getOperatorLabel = (value: string) =>
    OPERATORS.find((o) => o.value === value)?.label || value;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            ניהול התראות
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add/Edit Form */}
          {isAddingNew ? (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">
                  {editingAlert ? "עריכת התראה" : "הוספת התראה חדשה"}
                </h3>
                <Button variant="ghost" size="icon" onClick={resetForm}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label>שם ההתראה</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="לדוגמה: עליה בעלות לליד"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>מדד</Label>
                    <Select
                      value={formData.metric}
                      onValueChange={(v) =>
                        setFormData({ ...formData, metric: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {METRICS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>סוג השוואה</Label>
                    <Select
                      value={formData.comparison_type}
                      onValueChange={(v) =>
                        setFormData({ ...formData, comparison_type: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPARISON_TYPES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>תנאי</Label>
                    <Select
                      value={formData.operator}
                      onValueChange={(v) =>
                        setFormData({ ...formData, operator: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>
                      סף {formData.is_percentage ? "(אחוזים)" : "(ערך מוחלט)"}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={formData.threshold}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            threshold: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            is_percentage: !formData.is_percentage,
                          })
                        }
                      >
                        {formData.is_percentage ? "%" : "₪"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  ביטול
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingAlert ? "עדכון" : "הוספה"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus className="h-4 w-4 ml-2" />
              הוספת התראה חדשה
            </Button>
          )}

          {/* Alerts List */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-muted-foreground">
              התראות מוגדרות ({alerts.length})
            </h3>

            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">
                טוען...
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>אין התראות מוגדרות</p>
                <p className="text-sm">הוסף התראה כדי לקבל עדכונים על שינויים במדדים</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border rounded-lg p-3 flex items-center justify-between ${
                      alert.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{alert.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getMetricLabel(alert.metric)} •{" "}
                        {getComparisonLabel(alert.comparison_type)} •{" "}
                        {getOperatorLabel(alert.operator)}{" "}
                        {alert.threshold}
                        {alert.is_percentage ? "%" : ""}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={alert.is_active}
                        onCheckedChange={() => handleToggleActive(alert)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(alert)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(alert.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
