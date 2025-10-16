import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ImportClientsSheet() {
  const [open, setOpen] = useState(false);
  const [sheetId, setSheetId] = useState("");
  const [range, setRange] = useState("Sheet1!A:I");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ sheetId, range }: { sheetId: string; range: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "import-clients-from-sheets",
        {
          body: { sheetId, range },
        }
      );

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.errors && data.errors.length > 0) {
        toast.warning(`יובאו ${data.imported} לקוחות`, {
          description: `נמצאו ${data.errors.length} שגיאות בשורות מסוימות`,
        });
      } else {
        toast.success(`יובאו ${data.imported} לקוחות בהצלחה`);
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setSheetId("");
      setRange("Sheet1!A:I");
    },
    onError: (error: any) => {
      toast.error("שגיאה בייבוא לקוחות: " + error.message);
    },
  });

  const extractSheetId = (url: string) => {
    // Extract sheet ID from Google Sheets URL
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleImport = () => {
    const id = extractSheetId(sheetId);
    if (!id) {
      toast.error("נא להזין URL או ID תקין של Google Sheet");
      return;
    }
    const finalRange = (range || '').trim() || 'Sheet1!A:I';
    mutation.mutateAsync({ sheetId: id, range: finalRange });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="ml-2 h-4 w-4" />
          ייבוא מגוגל שיטס
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ייבוא לקוחות מגוגל שיטס</DialogTitle>
          <DialogDescription>
            ייבא לקוחות ישירות מגיליון Google Sheets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>פורמט נדרש:</strong> הגיליון צריך לכלול עמודות עם הכותרות הבאות:
              <br />
              שם, מזהה סוכנות, טלפון, אימייל, קישור לתיקיה, תעשייה, תקציב חודשי, אתר, הערות
              <br />
              <br />
              <strong>חשוב:</strong> השתתף את הגיליון כ"כל מי שיש לו את הקישור יכול לצפות"
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="sheetId">URL או ID של Google Sheet</Label>
            <Input
              id="sheetId"
              placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID או רק ה-ID"
              value={sheetId}
              onChange={(e) => setSheetId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="range">טווח תאים (אופציונלי)</Label>
            <Input
              id="range"
              placeholder="Sheet1!A:I"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              לדוגמה: Sheet1!A:I או Sheet1!A1:I100
            </p>
          </div>

          <Button
            onClick={handleImport}
            disabled={mutation.isPending || !sheetId}
            className="w-full"
          >
            {mutation.isPending ? "מייבא..." : "ייבא לקוחות"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
