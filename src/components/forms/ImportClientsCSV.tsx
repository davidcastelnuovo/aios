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
  [key: string]: string;
}

export function ImportClientsCSV() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const isPhoneNumber = (value: string): boolean => {
    return /^[\+]?[0-9]{9,15}$/.test(value.replace(/[\s\-\(\)]/g, ''));
  };

  const isEmail = (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const normalizeHeaders = (header: string): string => {
    const mappings: { [key: string]: string } = {
      'שם טלפון': 'name',
      'שם': 'name',
      'name': 'name',
      'טלפון': 'phone',
      'phone': 'phone',
      'אימייל': 'contact',  // Changed to generic 'contact' to handle mixed data
      'email': 'email',
      'סוכנות': 'agency',
      'agency': 'agency',
      'agency_id': 'agency',
      'תעשייה': 'industry',
      'industry': 'industry',
      'תקציב חודשי': 'monthly_budget',
      'monthly_budget': 'monthly_budget',
      'אתר': 'website',
      'website': 'website',
      'הערות': 'notes',
      'notes': 'notes',
      'קישור לתיקייה': 'folder_link',
      'folder_link': 'folder_link',
    };
    return mappings[header.trim()] || header.trim();
  };

  const parseCSV = (text: string): CSVRow[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => normalizeHeaders(h));
    const rows: CSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || "";
        
        // Smart detection: if header is 'contact', check if value is phone or email
        if (header === 'contact' && value) {
          if (isPhoneNumber(value)) {
            row['phone'] = value;
          } else if (isEmail(value)) {
            row['email'] = value;
          } else {
            row[header] = value;
          }
        } else {
          row[header] = value;
        }
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

      const validRows = rows.filter(row => row.name && row.agency);
      
      if (validRows.length === 0) {
        throw new Error("לא נמצאו שורות תקינות עם שם וסוכנות");
      }

      // Fetch all agencies to map names to IDs
      const { data: agencies, error: agenciesError } = await supabase
        .from("agencies")
        .select("id, name");

      if (agenciesError) throw agenciesError;

      const agencyMap = new Map(agencies?.map(a => [a.name.toLowerCase(), a.id]) || []);

      // Fetch existing clients to prepare updates and avoid duplicates
      const { data: existingClients, error: existingError } = await supabase
        .from("clients")
        .select("id, name, agency_id, phone, email");

      if (existingError) throw existingError;

      const existingMap = new Map(
        (existingClients || []).map((c) => [
          `${c.name.toLowerCase()}|${c.agency_id}`,
          c,
        ])
      );

      const updates: Array<{ id: string; phone?: string | null; email?: string | null }> = [];
      const inserts: Array<{ 
        name: string;
        agency_id: string;
        phone: string | null;
        email: string | null;
        folder_link: string | null;
        industry: string | null;
        monthly_budget: number | null;
        website: string | null;
        notes: string | null;
      }> = [];

      validRows.forEach((row) => {
        // Try to find agency by name if not a UUID
        let agencyId = row.agency;
        if (!row.agency.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          agencyId = agencyMap.get(row.agency.toLowerCase()) || row.agency;
        }

        const name = row.name?.trim();
        if (!name || !agencyId) return;

        const existing = existingMap.get(`${name.toLowerCase()}|${agencyId}`);

        if (existing) {
          const next: { id: string; phone?: string | null; email?: string | null } = { id: existing.id };
          // Overwrite existing fields if CSV provides values
          if (row.phone) next.phone = row.phone;
          if (row.email) next.email = row.email;

          if (typeof next.phone !== "undefined" || typeof next.email !== "undefined") {
            updates.push(next);
          }
        } else {
          inserts.push({
            name,
            agency_id: agencyId,
            phone: row.phone || null,
            email: row.email || null,
            folder_link: row.folder_link || null,
            industry: row.industry || null,
            monthly_budget: row.monthly_budget ? parseFloat(row.monthly_budget) : null,
            website: row.website || null,
            notes: row.notes || null,
          });
        }
      });

      // Apply updates
      let updatedCount = 0;
      if (updates.length > 0) {
        const results = await Promise.all(
          updates.map((u) =>
            supabase
              .from("clients")
              .update(
                {
                  ...(u.phone !== undefined ? { phone: u.phone } : {}),
                  ...(u.email !== undefined ? { email: u.email } : {}),
                  updated_at: new Date().toISOString(),
                }
              )
              .eq("id", u.id)
              .select("id")
          )
        );
        updatedCount = results.reduce((acc, r) => acc + (r.error ? 0 : (r.data?.length || 0)), 0);
      }

      // Insert new rows
      let insertedCount = 0;
      if (inserts.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from("clients")
          .insert(inserts)
          .select("id");

        if (insertError) throw insertError;
        insertedCount = inserted?.length || 0;
      }

      return {
        imported: insertedCount,
        updated: updatedCount,
        total: validRows.length,
        skipped: validRows.length - insertedCount - updatedCount,
      };
    },
    onSuccess: (data) => {
      if (data) {
        const parts: string[] = [];
        if (data.imported > 0) parts.push(`יובאו ${data.imported}`);
        if (data.updated > 0) parts.push(`עודכנו ${data.updated}`);
        const title = parts.length ? parts.join(" ו") + " לקוחות" : "לא בוצעו שינויים";

        if (data.skipped > 0) {
          toast.warning(title, {
            description: `דולגו ${data.skipped} שורות (חסרים שדות חובה או ללא שינוי)`,
          });
        } else {
          toast.success(title);
        }
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
              <strong>פורמט נדרש:</strong> הקובץ צריך לכלול עמודות עם הכותרות הבאות (בעברית או באנגלית):
              <br />
              שם טלפון / name, טלפון / phone, אימייל / email, סוכנות / agency
              <br />
              <br />
              <strong>שדות חובה:</strong> שם, סוכנות
              <br />
              <strong>הערה:</strong> ניתן לציין שם סוכנות או מזהה סוכנות
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
