import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

interface ImportLeadsSheetProps {
  trigger?: React.ReactNode;
}

export function ImportLeadsSheet({ trigger }: ImportLeadsSheetProps) {
  const [open, setOpen] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [range, setRange] = useState("Sheet1!A:Z");
  const [agencyId, setAgencyId] = useState<string>("");
  const [addNotesAsUpdates, setAddNotesAsUpdates] = useState(true);
  const queryClient = useQueryClient();
  const { tenant } = useCurrentTenant();

  // Fetch agencies for dropdown
  const { data: agencies = [] } = useQuery({
    queryKey: ['agencies', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name')
        .eq('tenant_id', tenant.id)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id
  });

  // Extract sheet ID from URL or use as-is
  const extractSheetId = (input: string): string => {
    // If it's a full URL, extract the ID
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      return match[1];
    }
    // Otherwise assume it's already an ID
    return input.trim();
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const sheetId = extractSheetId(sheetUrl);
      if (!sheetId) {
        throw new Error("יש להזין קישור או מזהה גיליון תקין");
      }

      const { data, error } = await supabase.functions.invoke('import-leads-from-sheets', {
        body: {
          sheetId,
          range,
          agencyId: agencyId === "none" ? null : agencyId,
          addNotesAsUpdates
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const message = `יובאו ${data.imported} לידים חדשים, עודכנו ${data.updated} לידים קיימים`;
      const updatesMsg = data.updatesAdded ? `, נוספו ${data.updatesAdded} עדכונים` : '';
      toast.success(message + updatesMsg);
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Import errors:', data.errors);
        toast.warning(`${data.errors.length} שגיאות בייבוא - ראה קונסול`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-updates'] });
      setOpen(false);
      setSheetUrl("");
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      toast.error(error.message || "שגיאה בייבוא הנתונים");
    }
  });

  const handleImport = () => {
    if (!sheetUrl.trim()) {
      toast.error("יש להזין קישור לגיליון");
      return;
    }
    importMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            ייבוא מגוגל שיטס
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ייבוא לידים מ-Google Sheets</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sheetUrl">קישור לגיליון או מזהה</Label>
            <Input
              id="sheetUrl"
              placeholder="הדבק קישור לגיליון גוגל..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="range">טווח תאים (אופציונלי)</Label>
            <Input
              id="range"
              placeholder="Sheet1!A:Z"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>סוכנות (אופציונלי)</Label>
            <Select value={agencyId || "none"} onValueChange={setAgencyId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוכנות..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא סוכנות</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="addNotesAsUpdates"
              checked={addNotesAsUpdates}
              onCheckedChange={(checked) => setAddNotesAsUpdates(checked as boolean)}
            />
            <Label htmlFor="addNotesAsUpdates" className="cursor-pointer">
              הוסף הערות כעדכונים ללידים
            </Label>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>עמודות נתמכות:</strong>
              <br />
              שם/company_name, טלפון/phone, מייל/email, תאריך/created_at, מקור/source, סטטוס/status, הערות/notes
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleImport} 
            disabled={importMutation.isPending}
            className="w-full"
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מייבא...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4 ml-2" />
                התחל ייבוא
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
