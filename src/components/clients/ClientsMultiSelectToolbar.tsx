import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, CheckSquare, Trash2, RefreshCw, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClientsMultiSelectToolbarProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onSelectAll?: () => void;
  totalCount: number;
  tenantId?: string;
}

const STATUS_OPTIONS = [
  { value: "active", label: "פעיל", color: "bg-success" },
  { value: "onboarding", label: "בקליטה", color: "bg-blue-500" },
  { value: "paused", label: "מושהה", color: "bg-yellow-500" },
  { value: "ended", label: "הסתיים", color: "bg-muted-foreground" },
] as const;

export function ClientsMultiSelectToolbar({
  selectedIds,
  onClearSelection,
  onSelectAll,
  totalCount,
  tenantId,
}: ClientsMultiSelectToolbarProps) {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies-for-bulk", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const bulkChangeAgencyMutation = useMutation({
    mutationFn: async (agencyId: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ agency_id: agencyId })
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success(`הסוכנות עודכנה ל-${selectedIds.length} לקוחות`);
      onClearSelection();
    },
    onError: () => toast.error("שגיאה בעדכון הסוכנות"),
  });

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async (status: "active" | "onboarding" | "paused" | "ended") => {
      const { error } = await supabase
        .from("clients")
        .update({ status })
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-onboarding"] });
      toast.success(`הסטטוס עודכן ל-${selectedIds.length} לקוחות`);
      onClearSelection();
    },
    onError: () => toast.error("שגיאה בעדכון הסטטוס"),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .delete()
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`${selectedIds.length} לקוחות נמחקו בהצלחה`);
      onClearSelection();
      setShowDeleteConfirm(false);
    },
    onError: () => toast.error("שגיאה במחיקת הלקוחות"),
  });

  return (
    <>
      <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg flex-wrap" dir="rtl">
        <span className="text-sm font-medium">
          {selectedIds.length} נבחרו מתוך {totalCount}
        </span>

        <div className="flex items-center gap-1 flex-wrap">
          {onSelectAll && (
            <Button size="sm" variant="ghost" onClick={onSelectAll}>
              <CheckSquare className="h-4 w-4 ml-1" />
              בחר הכל
            </Button>
          )}

          {/* Bulk status change */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <RefreshCw className="h-4 w-4 ml-1" />
                שנה סטטוס
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" dir="rtl">
              <div className="space-y-1">
                {STATUS_OPTIONS.map((opt) => (
                  <div
                    key={opt.value}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => bulkUpdateStatusMutation.mutate(opt.value)}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${opt.color}`} />
                    <span className="text-sm">{opt.label}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Bulk agency change */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost">
                <Building2 className="h-4 w-4 ml-1" />
                שנה סוכנות
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" dir="rtl">
              <div className="space-y-1">
                {agencies.map((agency) => (
                  <div
                    key={agency.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => bulkChangeAgencyMutation.mutate(agency.id)}
                  >
                    <span className="text-sm">{agency.name}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 ml-1" />
            מחק
          </Button>

          <Button size="sm" variant="ghost" onClick={onClearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>אישור מחיקת לקוחות</AlertDialogTitle>
            <AlertDialogDescription>
              האם אתה בטוח שברצונך למחוק <strong>{selectedIds.length}</strong> לקוחות?
              פעולה זו תמחק את כל הנתונים הקשורים ולא ניתן לבטל אותה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate()}
              className="bg-destructive hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              מחק {selectedIds.length} לקוחות
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
