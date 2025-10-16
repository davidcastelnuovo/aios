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
import { Upload } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVRow {
  name: string;
  agency_id: string;
  phone?: string;
  email?: string;
  folder_link?: string;
  industry?: string;
  monthly_budget?: string;
  website?: string;
  notes?: string;
}

export function ImportClientsCSV() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || "";
        row[header] = value;
      });

      rows.push(row as CSVRow);
    }

    return rows;
  };

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error("לא נמצאו נתונים בקובץ");
      }

      const validRows = rows.filter(row => row.name && row.agency_id);
      
      if (validRows.length === 0) {
        throw new Error("לא נמצאו שורות תקינות עם שם ומזהה סוכנות");
      }

      const clientsData = validRows.map(row => ({
        name: row.name,
        agency_id: row.agency_id,
        phone: row.phone || null,
        email: row.email || null,
        folder_link: row.folder_link || null,
        industry: row.industry || null,
        monthly_budget: row.monthly_budget ? parseFloat(row.monthly_budget) : null,
        website: row.website || null,
        notes: row.notes || null,
      }));

      const { data, error } = await supabase
        .from("clients")
        .insert(clientsData)
        .select();

      if (error) throw error;

      return {
        imported: data?.length || 0,
        total: rows.length,
        skipped: rows.length - validRows.length,
      };
    },
    onSuccess: (data) => {
      if (data.skipped > 0) {
        toast.warning(`יובאו ${data.imported} לקוחות`, {
          description: `דולגו על ${data.skipped} שורות ללא שם או מזהה סוכנות`,
        });
      } else {
        toast.success(`יובאו ${data.imported} לקוחות בהצלחה`);
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      setFile(null);
    },
    onError: (error: any) => {
      toast.error("שגיאה בייבוא לקוחות: " + error.message);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast.error("נא לבחור קובץ CSV");
    }
  };

  const handleImport = () => {
    if (!file) {
      toast.error("נא לבחור קובץ");
      return;
    }
    mutation.mutate(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="ml-2 h-4 w-4" />
          ייבוא מ-CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ייבוא לקוחות מקובץ CSV</DialogTitle>
          <DialogDescription>
            העלה קובץ CSV עם פרטי הלקוחות
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertDescription>
              <strong>פורמט נדרש:</strong> הקובץ צריך לכלול עמודות עם הכותרות הבאות:
              <br />
              name, agency_id, phone, email, folder_link, industry, monthly_budget, website, notes
              <br />
              <br />
              <strong>שדות חובה:</strong> name, agency_id
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="csv-file">קובץ CSV</Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                נבחר: {file.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleImport}
            disabled={mutation.isPending || !file}
            className="w-full"
          >
            {mutation.isPending ? "מייבא..." : "ייבא לקוחות"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
