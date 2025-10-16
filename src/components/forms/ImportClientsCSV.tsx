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

      // Fetch existing clients to check for duplicates
      const { data: existingClients, error: existingError } = await supabase
        .from("clients")
        .select("name, phone");

      if (existingError) throw existingError;

      const existingSet = new Set(
        existingClients?.map(c => 
          `${c.name.toLowerCase()}|${c.phone || ''}`
        ) || []
      );

      const clientsData = validRows
        .map(row => {
          // Try to find agency by name if not a UUID
          let agencyId = row.agency;
          if (!row.agency.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            agencyId = agencyMap.get(row.agency.toLowerCase()) || row.agency;
          }

          return {
            name: row.name,
            agency_id: agencyId,
            phone: row.phone || null,
            email: row.email || null,
            folder_link: row.folder_link || null,
            industry: row.industry || null,
            monthly_budget: row.monthly_budget ? parseFloat(row.monthly_budget) : null,
            website: row.website || null,
            notes: row.notes || null,
          };
        })
        .filter(row => {
          // Filter out rows without valid agency_id
          if (!row.agency_id) return false;
          
          // Filter out duplicates
          const key = `${row.name.toLowerCase()}|${row.phone || ''}`;
          return !existingSet.has(key);
        });

      if (clientsData.length === 0) {
        throw new Error("כל הלקוחות בקובץ כבר קיימים במערכת");
      }

      const { data, error } = await supabase
        .from("clients")
        .insert(clientsData)
        .select();

      if (error) throw error;

      return {
        imported: data?.length || 0,
        total: rows.length,
        skipped: rows.length - clientsData.length,
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
