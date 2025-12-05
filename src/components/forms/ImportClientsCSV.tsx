import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Upload, ArrowLeft, ArrowRight, Check, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing';

interface FieldOption {
  key: string;
  label: string;
  required?: boolean;
}

const SYSTEM_FIELDS: FieldOption[] = [
  { key: 'name', label: 'שם', required: true },
  { key: 'agency', label: 'סוכנות', required: true },
  { key: 'contact_name', label: 'איש קשר' },
  { key: 'phone', label: 'טלפון' },
  { key: 'email', label: 'אימייל' },
  { key: 'industry', label: 'תעשייה' },
  { key: 'monthly_budget', label: 'תקציב חודשי' },
  { key: 'retainer', label: 'ריטיינר' },
  { key: 'website', label: 'אתר' },
  { key: 'folder_link', label: 'קישור לתיקייה' },
  { key: 'notes', label: 'הערות' },
  { key: 'is_seo_client', label: 'לקוח SEO' },
];

// Auto-detection mappings for common header names
const AUTO_DETECT_MAPPINGS: Record<string, string> = {
  // Hebrew
  'שם': 'name',
  'שם לקוח': 'name',
  'שם הלקוח': 'name',
  'שם החברה': 'name',
  'חברה': 'name',
  'סוכנות': 'agency',
  'שם סוכנות': 'agency',
  'איש קשר': 'contact_name',
  'שם איש קשר': 'contact_name',
  'טלפון': 'phone',
  'נייד': 'phone',
  'מספר טלפון': 'phone',
  'פלאפון': 'phone',
  'אימייל': 'email',
  'מייל': 'email',
  'דוא"ל': 'email',
  'כתובת מייל': 'email',
  'תעשייה': 'industry',
  'תחום': 'industry',
  'ענף': 'industry',
  'תקציב': 'monthly_budget',
  'תקציב חודשי': 'monthly_budget',
  'budget': 'monthly_budget',
  'ריטיינר': 'retainer',
  'תשלום חודשי': 'retainer',
  'אתר': 'website',
  'כתובת אתר': 'website',
  'אתר אינטרנט': 'website',
  'קישור לתיקייה': 'folder_link',
  'תיקייה': 'folder_link',
  'לינק לתיקייה': 'folder_link',
  'הערות': 'notes',
  'הערה': 'notes',
  'seo': 'is_seo_client',
  'לקוח seo': 'is_seo_client',
  // English
  'name': 'name',
  'client name': 'name',
  'company': 'name',
  'company name': 'name',
  'agency': 'agency',
  'agency_id': 'agency',
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'phone': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'email': 'email',
  'e-mail': 'email',
  'industry': 'industry',
  'monthly_budget': 'monthly_budget',
  'monthly budget': 'monthly_budget',
  'retainer': 'retainer',
  'website': 'website',
  'site': 'website',
  'url': 'website',
  'folder_link': 'folder_link',
  'folder': 'folder_link',
  'notes': 'notes',
  'note': 'notes',
  'comments': 'notes',
  'is_seo_client': 'is_seo_client',
  'seo client': 'is_seo_client',
};

export function ImportClientsCSV() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Fetch agencies for agency name resolution
  const { data: agencies } = useQuery({
    queryKey: ['agencies-for-import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const agencyMap = useMemo(() => {
    return new Map(agencies?.map(a => [a.name.toLowerCase(), a.id]) || []);
  }, [agencies]);

  const parseCSVRaw = (text: string): { headers: string[]; data: string[][] } => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length < 1) return { headers: [], data: [] };

    // Parse CSV properly handling quoted values
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const data: string[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i]);
      if (row.some(cell => cell.trim())) { // Skip empty rows
        data.push(row);
      }
    }

    return { headers, data };
  };

  const autoDetectMappings = (headers: string[]): Record<string, string> => {
    const mappings: Record<string, string> = {};
    const usedFields = new Set<string>();

    headers.forEach((header, index) => {
      const normalizedHeader = header.toLowerCase().trim();
      const detectedField = AUTO_DETECT_MAPPINGS[normalizedHeader];
      
      if (detectedField && !usedFields.has(detectedField)) {
        mappings[index.toString()] = detectedField;
        usedFields.add(detectedField);
      }
    });

    return mappings;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Accept both .csv and text files
    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv' && selectedFile.type !== 'text/plain') {
      toast.error("נא לבחור קובץ CSV");
      return;
    }

    setFile(selectedFile);
    
    try {
      const text = await selectedFile.text();
      const { headers, data } = parseCSVRaw(text);
      
      if (headers.length === 0 || data.length === 0) {
        toast.error("הקובץ ריק או בפורמט לא תקין");
        return;
      }

      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-detect field mappings
      const autoMappings = autoDetectMappings(headers);
      setFieldMappings(autoMappings);
      
      setStep('mapping');
    } catch (error) {
      toast.error("שגיאה בקריאת הקובץ");
      console.error(error);
    }
  };

  const handleMappingChange = (headerIndex: string, fieldKey: string) => {
    setFieldMappings(prev => {
      const newMappings = { ...prev };
      
      // If selecting "skip", remove the mapping
      if (fieldKey === '_skip') {
        delete newMappings[headerIndex];
        return newMappings;
      }

      // Remove any existing mapping for this field (to prevent duplicates)
      Object.keys(newMappings).forEach(key => {
        if (newMappings[key] === fieldKey) {
          delete newMappings[key];
        }
      });

      newMappings[headerIndex] = fieldKey;
      return newMappings;
    });
  };

  const requiredFieldsMapped = useMemo(() => {
    const mappedFields = new Set(Object.values(fieldMappings));
    return SYSTEM_FIELDS
      .filter(f => f.required)
      .every(f => mappedFields.has(f.key));
  }, [fieldMappings]);

  const getMappedData = useMemo(() => {
    return csvData.map(row => {
      const mappedRow: Record<string, string> = {};
      Object.entries(fieldMappings).forEach(([headerIndex, fieldKey]) => {
        const value = row[parseInt(headerIndex)] || '';
        mappedRow[fieldKey] = value;
      });
      return mappedRow;
    });
  }, [csvData, fieldMappings]);

  const previewData = useMemo(() => {
    return getMappedData.slice(0, 5);
  }, [getMappedData]);

  const validRowsCount = useMemo(() => {
    return getMappedData.filter(row => row.name && row.agency).length;
  }, [getMappedData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("משתמש לא מחובר");
      
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      
      if (!tenantData) throw new Error("לא נמצא tenant למשתמש");

      const rows = getMappedData;
      const validRows = rows.filter(row => row.name && row.agency);
      
      if (validRows.length === 0) {
        throw new Error("לא נמצאו שורות תקינות עם שם וסוכנות");
      }

      // Fetch existing clients
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

      const updates: Array<{ id: string; data: Record<string, any> }> = [];
      const inserts: Array<{
        name: string;
        agency_id: string;
        phone?: string | null;
        email?: string | null;
        contact_name?: string | null;
        industry?: string | null;
        folder_link?: string | null;
        monthly_budget?: number | null;
        retainer?: number | null;
        website?: string | null;
        notes?: string | null;
        is_seo_client?: boolean;
        tenant_id: string;
      }> = [];

      validRows.forEach((row) => {
        // Resolve agency ID
        let agencyId = row.agency;
        if (!row.agency.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
          agencyId = agencyMap.get(row.agency.toLowerCase()) || '';
        }

        if (!agencyId) return;

        const name = row.name?.trim();
        if (!name) return;

        const existing = existingMap.get(`${name.toLowerCase()}|${agencyId}`);

        const isSeoClient = row.is_seo_client?.toLowerCase() === 'כן' || 
                           row.is_seo_client?.toLowerCase() === 'yes' || 
                           row.is_seo_client === '1' || 
                           row.is_seo_client?.toLowerCase() === 'true';

        if (existing) {
          const updateFields: Record<string, any> = {};
          if (row.phone) updateFields.phone = row.phone;
          if (row.email) updateFields.email = row.email;
          if (row.contact_name) updateFields.contact_name = row.contact_name;
          if (row.industry) updateFields.industry = row.industry;
          if (row.folder_link) updateFields.folder_link = row.folder_link;
          if (row.monthly_budget) updateFields.monthly_budget = parseFloat(row.monthly_budget);
          if (row.retainer) updateFields.retainer = parseFloat(row.retainer);
          if (row.website) updateFields.website = row.website;
          if (row.notes) updateFields.notes = row.notes;
          if (row.is_seo_client) updateFields.is_seo_client = isSeoClient;

          if (Object.keys(updateFields).length > 0) {
            updates.push({ id: existing.id, data: updateFields });
          }
        } else {
          inserts.push({
            name,
            agency_id: agencyId,
            phone: row.phone || null,
            email: row.email || null,
            contact_name: row.contact_name || null,
            industry: row.industry || null,
            folder_link: row.folder_link || null,
            monthly_budget: row.monthly_budget ? parseFloat(row.monthly_budget) : null,
            retainer: row.retainer ? parseFloat(row.retainer) : null,
            website: row.website || null,
            notes: row.notes || null,
            is_seo_client: isSeoClient,
            tenant_id: tenantData.tenant_id,
          });
        }
      });

      // Apply updates
      let updatedCount = 0;
      if (updates.length > 0) {
        const results = await Promise.all(
          updates.map((u) => {
            return supabase
              .from("clients")
              .update({ ...u.data, updated_at: new Date().toISOString() })
              .eq("id", u.id)
              .select("id");
          })
        );
        updatedCount = results.reduce((acc, r) => acc + (r.error ? 0 : (r.data?.length || 0)), 0);
      }

      // Save backup
      if (file) {
        const text = await file.text();
        await supabase
          .from("import_history")
          .insert({
            tenant_id: tenantData.tenant_id,
            import_type: "clients",
            file_name: file.name,
            file_content: text,
            imported_by: user.id,
            records_count: validRows.length,
          });
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
            description: `דולגו ${data.skipped} שורות (סוכנות לא נמצאה או ללא שינוי)`,
          });
        } else {
          toast.success(title);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      handleClose();
    },
    onError: (error: any) => {
      toast.error("שגיאה בייבוא לקוחות: " + error.message);
      setStep('preview');
    },
  });

  const handleClose = () => {
    setOpen(false);
    setStep('upload');
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setFieldMappings({});
  };

  const handleImport = () => {
    setStep('importing');
    mutation.mutate();
  };

  const getFieldLabel = (fieldKey: string): string => {
    return SYSTEM_FIELDS.find(f => f.key === fieldKey)?.label || fieldKey;
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="ml-2 h-4 w-4" />
          ייבוא מ-CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>ייבוא לקוחות מקובץ CSV</DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'העלה קובץ CSV עם פרטי הלקוחות'}
            {step === 'mapping' && 'מפה את העמודות מהקובץ לשדות במערכת'}
            {step === 'preview' && 'בדוק את הנתונים לפני הייבוא'}
            {step === 'importing' && 'מייבא את הנתונים...'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Badge variant={step === 'upload' ? 'default' : 'secondary'}>1. העלאה</Badge>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'mapping' ? 'default' : 'secondary'}>2. מיפוי</Badge>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <Badge variant={step === 'preview' || step === 'importing' ? 'default' : 'secondary'}>3. ייבוא</Badge>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4 p-4">
              <Alert>
                <AlertDescription>
                  <strong>הוראות:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>העלה קובץ CSV עם נתוני הלקוחות</li>
                    <li>השורה הראשונה צריכה להכיל כותרות עמודות</li>
                    <li>בשלב הבא תוכל למפות כל עמודה לשדה המתאים</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="csv-file">בחר קובץ CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          )}

          {/* Step 2: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4 p-4">
              {!requiredFieldsMapped && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    יש למפות את שדות החובה: <strong>שם</strong> ו<strong>סוכנות</strong>
                  </AlertDescription>
                </Alert>
              )}

              <div className="text-sm text-muted-foreground">
                נמצאו {csvHeaders.length} עמודות ו-{csvData.length} שורות בקובץ
              </div>

              <ScrollArea className="h-[300px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">עמודה בקובץ</TableHead>
                      <TableHead className="w-1/12 text-center">→</TableHead>
                      <TableHead className="w-1/3">שדה במערכת</TableHead>
                      <TableHead className="w-1/4">דוגמה מהקובץ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvHeaders.map((header, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell className="text-center">→</TableCell>
                        <TableCell>
                          <Select
                            value={fieldMappings[index.toString()] || '_skip'}
                            onValueChange={(value) => handleMappingChange(index.toString(), value)}
                          >
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="בחר שדה" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover z-50">
                              <SelectItem value="_skip">לא למפות</SelectItem>
                              {SYSTEM_FIELDS.map((field) => (
                                <SelectItem key={field.key} value={field.key}>
                                  {field.label} {field.required && '*'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm truncate max-w-[150px]">
                          {csvData[0]?.[index] || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowRight className="ml-2 h-4 w-4" />
                  חזור
                </Button>
                <Button 
                  onClick={() => setStep('preview')} 
                  disabled={!requiredFieldsMapped}
                >
                  המשך לתצוגה מקדימה
                  <ArrowLeft className="mr-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4 p-4">
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  <strong>{validRowsCount}</strong> שורות תקינות מתוך <strong>{csvData.length}</strong> ייובאו למערכת
                </AlertDescription>
              </Alert>

              <div className="text-sm font-medium">תצוגה מקדימה (5 שורות ראשונות):</div>
              
              <ScrollArea className="h-[250px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.values(fieldMappings).map((fieldKey) => (
                        <TableHead key={fieldKey}>{getFieldLabel(fieldKey)}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {Object.values(fieldMappings).map((fieldKey) => (
                          <TableCell key={fieldKey} className="truncate max-w-[150px]">
                            {row[fieldKey] || '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep('mapping')}>
                  <ArrowRight className="ml-2 h-4 w-4" />
                  חזור למיפוי
                </Button>
                <Button onClick={handleImport} disabled={validRowsCount === 0}>
                  <Check className="ml-2 h-4 w-4" />
                  ייבא {validRowsCount} לקוחות
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">מייבא לקוחות...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
