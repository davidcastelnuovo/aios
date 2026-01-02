import { useState, useMemo } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileSpreadsheet, Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ImportLeadsSheetProps {
  trigger?: React.ReactNode;
}

type Step = "input" | "mapping" | "preview" | "importing";

interface FieldMapping {
  sheetColumn: string;
  systemField: string | null;
}

const SYSTEM_FIELDS = [
  { key: "company_name", label: "שם העסק" },
  { key: "contact_name", label: "שם איש קשר" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
  { key: "source", label: "מקור הגעה" },
  { key: "status", label: "סטטוס" },
  { key: "notes", label: "הערות" },
  { key: "products", label: "מוצרים" },
  { key: "campaign_name", label: "שם קמפיין" },
  { key: "industry", label: "תעשייה/תחום" },
  { key: "monthly_budget", label: "תקציב חד\"פ" },
  { key: "three_month_budget", label: "הצעה 3 חודשים" },
  { key: "estimated_deal_value", label: "שווי עסקה" },
  { key: "proposal_date", label: "תאריך הצעה" },
  { key: "won_date", label: "תאריך סגירה" },
  { key: "created_at", label: "תאריך יצירה" },
  { key: "folder_link", label: "קישור לתיקייה" },
];

const AUTO_DETECT_MAPPINGS: Record<string, string> = {
  // עברית
  'שם העסק': 'company_name',
  'שם החברה': 'company_name',
  'חברה': 'company_name',
  'עסק': 'company_name',
  'שם עסק': 'company_name',
  'שם': 'company_name',
  'שם איש קשר': 'contact_name',
  'איש קשר': 'contact_name',
  'טלפון': 'phone',
  'נייד': 'phone',
  'מייל': 'email',
  'אימייל': 'email',
  'מקור': 'source',
  'מקור הגעה': 'source',
  'סטטוס': 'status',
  'הערות': 'notes',
  'תקציב': 'monthly_budget',
  'הצעה חד"פ': 'monthly_budget',
  'הצעה חד״פ': 'monthly_budget',
  'הצעה 3 חודשים': 'three_month_budget',
  'מוצרים': 'products',
  'תעשייה': 'industry',
  'פרסום': 'industry',
  'תחום': 'industry',
  'קמפיין': 'campaign_name',
  'שם קמפיין': 'campaign_name',
  'תאריך יצירה': 'created_at',
  'תאריך': 'created_at',
  'תאריך הצעה': 'proposal_date',
  'נסגר': 'won_date',
  'תאריך סגירה': 'won_date',
  'שווי הצעות/הסכמים': 'estimated_deal_value',
  'שווי עסקה': 'estimated_deal_value',
  'קישור': 'folder_link',
  'קישור לתיקייה': 'folder_link',
  // English
  'company': 'company_name',
  'company name': 'company_name',
  'company_name': 'company_name',
  'business': 'company_name',
  'contact': 'contact_name',
  'contact name': 'contact_name',
  'contact_name': 'contact_name',
  'name': 'company_name',
  'phone': 'phone',
  'mobile': 'phone',
  'email': 'email',
  'source': 'source',
  'lead source': 'source',
  'status': 'status',
  'notes': 'notes',
  'budget': 'monthly_budget',
  'monthly_budget': 'monthly_budget',
  'products': 'products',
  'industry': 'industry',
  'campaign': 'campaign_name',
  'campaign_name': 'campaign_name',
  'created_at': 'created_at',
  'created': 'created_at',
  'date': 'created_at',
  'proposal_date': 'proposal_date',
  'won_date': 'won_date',
  'deal_value': 'estimated_deal_value',
  'folder_link': 'folder_link',
};

export function ImportLeadsSheet({ trigger }: ImportLeadsSheetProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [sheetUrl, setSheetUrl] = useState("");
  const [range, setRange] = useState("Sheet1!A:Z");
  const [agencyId, setAgencyId] = useState<string>("");
  const [addNotesAsUpdates, setAddNotesAsUpdates] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Mapping state
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetData, setSheetData] = useState<any[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number } | null>(null);
  
  const queryClient = useQueryClient();
  const { tenant, tenantId } = useCurrentTenant();

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
    const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      return match[1];
    }
    return input.trim();
  };

  const resetState = () => {
    setStep("input");
    setSheetUrl("");
    setRange("Sheet1!A:Z");
    setAgencyId("");
    setSheetHeaders([]);
    setSheetData([]);
    setMappings([]);
    setImportResult(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  // Step 1: Fetch headers from sheet
  const fetchSheetData = async () => {
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) {
      toast.error("יש להזין קישור או מזהה גיליון תקין");
      return;
    }
    if (!tenantId) {
      toast.error("לא נמצא ארגון פעיל");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('import-leads-from-sheets', {
        body: {
          sheetId,
          range,
          tenantId,
          fetchHeadersOnly: true
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const headers = data.headers || [];
      const rows = data.previewRows || [];

      if (headers.length === 0) {
        throw new Error("לא נמצאו עמודות בגיליון");
      }

      // Auto-detect mappings
      const autoMappings: FieldMapping[] = headers.map((col: string) => {
        const normalizedCol = col.trim().toLowerCase();
        const detectedField = AUTO_DETECT_MAPPINGS[col] || 
                             AUTO_DETECT_MAPPINGS[col.trim()] ||
                             AUTO_DETECT_MAPPINGS[normalizedCol] ||
                             null;
        return { sheetColumn: col, systemField: detectedField };
      });

      setSheetHeaders(headers);
      setSheetData(rows);
      setMappings(autoMappings);
      setStep("mapping");
    } catch (error: any) {
      console.error('Fetch headers error:', error);
      toast.error(error.message || "שגיאה בטעינת הגיליון");
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapping = (sheetColumn: string, systemField: string | null) => {
    setMappings(prev => 
      prev.map(m => 
        m.sheetColumn === sheetColumn 
          ? { ...m, systemField: systemField === "skip" ? null : systemField }
          : m
      )
    );
  };

  // Preview data with current mappings
  const previewData = useMemo(() => {
    if (sheetData.length === 0) return [];
    
    return sheetData.slice(0, 5).map(row => {
      const mapped: Record<string, any> = {};
      mappings.forEach((m, idx) => {
        if (m.systemField) {
          mapped[m.systemField] = row[idx];
        }
      });
      return mapped;
    });
  }, [sheetData, mappings]);

  // Step 3: Import with mappings
  const handleImport = async () => {
    const sheetId = extractSheetId(sheetUrl);
    
    // Build field map
    const fieldMap: Record<string, string> = {};
    mappings.forEach(m => {
      if (m.systemField) {
        fieldMap[m.sheetColumn] = m.systemField;
      }
    });

    if (Object.keys(fieldMap).length === 0) {
      toast.error("יש למפות לפחות שדה אחד");
      return;
    }

    setStep("importing");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('import-leads-from-sheets', {
        body: {
          sheetId,
          range,
          tenantId,
          agencyId: agencyId === "none" ? null : agencyId || null,
          addNotesAsUpdates,
          fieldMap
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      
      setImportResult({ imported: data.imported, updated: data.updated });
      
      const message = `יובאו ${data.imported} לידים חדשים, עודכנו ${data.updated} לידים קיימים`;
      const updatesMsg = data.updatesAdded ? `, נוספו ${data.updatesAdded} עדכונים` : '';
      toast.success(message + updatesMsg);
      
      if (data.errors && data.errors.length > 0) {
        console.warn('Import errors:', data.errors);
        toast.warning(`${data.errors.length} שגיאות בייבוא - ראה קונסול`);
      }
      
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-updates'] });
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || "שגיאה בייבוא הנתונים");
      setStep("mapping");
    } finally {
      setIsLoading(false);
    }
  };

  const renderInputStep = () => (
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

      <Button 
        onClick={fetchSheetData} 
        disabled={isLoading || !sheetUrl.trim()}
        className="w-full"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            טוען גיליון...
          </>
        ) : (
          <>
            המשך למיפוי שדות
            <ArrowLeft className="h-4 w-4 mr-2" />
          </>
        )}
      </Button>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>נמצאו {sheetHeaders.length} עמודות</span>
        <Badge variant="secondary">{sheetData.length} שורות לדוגמה</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>סוכנות ברירת מחדל</Label>
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
        <div className="flex items-end">
          <div className="flex items-center gap-2">
            <Checkbox
              id="addNotesAsUpdates"
              checked={addNotesAsUpdates}
              onCheckedChange={(checked) => setAddNotesAsUpdates(checked as boolean)}
            />
            <Label htmlFor="addNotesAsUpdates" className="cursor-pointer text-sm">
              הוסף הערות כעדכונים
            </Label>
          </div>
        </div>
      </div>

      <div className="text-sm font-medium">מיפוי שדות:</div>
      <ScrollArea className="h-[250px] border rounded-lg p-2">
        <div className="space-y-2">
          {mappings.map((mapping, idx) => {
            const sampleValue = sheetData[0]?.[idx];
            const displaySample = sampleValue !== undefined && sampleValue !== null && sampleValue !== '' 
              ? String(sampleValue) 
              : "(ריק)";
            return (
              <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate" title={mapping.sheetColumn}>
                    {mapping.sheetColumn}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={displaySample}>
                    דוגמה: {displaySample}
                  </div>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Select
                  value={mapping.systemField || "skip"}
                  onValueChange={(value) => updateMapping(mapping.sheetColumn, value)}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">
                      <span className="text-muted-foreground">דלג על שדה זה</span>
                    </SelectItem>
                    {SYSTEM_FIELDS.map(field => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep("input")}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזור
        </Button>
        <Button onClick={() => setStep("preview")}>
          המשך לתצוגה מקדימה
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary">5 שורות ראשונות</Badge>
        {agencyId && agencyId !== "none" && (
          <Badge variant="outline">
            סוכנות: {agencies.find(a => a.id === agencyId)?.name}
          </Badge>
        )}
      </div>

      <ScrollArea className="h-[250px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.key)).map(field => (
                <TableHead key={field.key} className="whitespace-nowrap">
                  {field.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((row, idx) => (
              <TableRow key={idx}>
                {SYSTEM_FIELDS.filter(f => mappings.some(m => m.systemField === f.key)).map(field => (
                  <TableCell key={field.key} className="max-w-[150px] truncate">
                    {row[field.key] ?? "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={() => setStep("mapping")}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזור למיפוי
        </Button>
        <Button onClick={handleImport} disabled={isLoading}>
          התחל ייבוא
          <Check className="h-4 w-4 mr-2" />
        </Button>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="space-y-4 text-center py-8">
      {isLoading ? (
        <>
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">מייבא לידים...</p>
        </>
      ) : importResult ? (
        <>
          <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium">הייבוא הושלם בהצלחה!</p>
            <p className="text-sm text-muted-foreground">
              {importResult.updated} לידים עודכנו, {importResult.imported} לידים חדשים נוספו
            </p>
          </div>
          <Button onClick={handleClose}>סגור</Button>
        </>
      ) : null}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4 ml-2" />
            ייבוא מגוגל שיטס
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle>
            {step === "input" && "ייבוא לידים מ-Google Sheets"}
            {step === "mapping" && "מיפוי שדות"}
            {step === "preview" && "תצוגה מקדימה"}
            {step === "importing" && "מייבא..."}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
          {step === "input" && renderInputStep()}
          {step === "mapping" && renderMappingStep()}
          {step === "preview" && renderPreviewStep()}
          {step === "importing" && renderImportingStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
