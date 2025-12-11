import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

type Step = "upload" | "mapping" | "preview" | "importing";

interface FieldMapping {
  csvColumn: string;
  systemField: string | null;
}

const BASE_SYSTEM_FIELDS = [
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
  'שם העסק/חברה': 'company_name',
  'שם איש קשר': 'contact_name',
  'איש קשר': 'contact_name',
  'שם': 'contact_name',
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
  'name': 'contact_name',
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
  'proposal_date': 'proposal_date',
  'won_date': 'won_date',
  'deal_value': 'estimated_deal_value',
  'folder_link': 'folder_link',
};

export function ImportLeadsWithMapping() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [defaultAgencyId, setDefaultAgencyId] = useState<string>("");
  const [defaultSalesPersonId, setDefaultSalesPersonId] = useState<string>("");
  const [importResult, setImportResult] = useState<{ updates: number; inserts: number } | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  // Fetch custom fields configuration
  const { data: customFields = [] } = useQuery({
    queryKey: ["custom-fields", tenantId, "lead"],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("custom_fields")
        .select("field_key, is_required, is_visible")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "lead");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Build dynamic system fields based on custom_fields
  const systemFields = useMemo(() => {
    return BASE_SYSTEM_FIELDS.map(field => {
      const customField = customFields.find(cf => cf.field_key === field.key);
      return {
        ...field,
        required: customField?.is_required ?? false,
        visible: customField?.is_visible ?? true,
      };
    }).filter(f => f.visible);
  }, [customFields]);

  // Fetch agencies
  const { data: agencies = [] } = useQuery({
    queryKey: ["agencies", tenantId],
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
    enabled: !!tenantId && open,
  });

  // Fetch sales people based on selected agency
  const { data: salesPeople = [] } = useQuery({
    queryKey: ["sales_people", defaultAgencyId],
    queryFn: async () => {
      if (!defaultAgencyId) return [];
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name")
        .eq("agency_id", defaultAgencyId)
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!defaultAgencyId && open,
  });

  const resetState = () => {
    setStep("upload");
    setFileName("");
    setRawData([]);
    setCsvColumns([]);
    setMappings([]);
    setDefaultAgencyId("");
    setDefaultSalesPersonId("");
    setImportResult(null);
  };

  const handleClose = () => {
    setOpen(false);
    resetState();
  };

  const parseFile = async (file: File): Promise<any[]> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
      const text = await file.text();
      const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
      return parsed.data || [];
    } else if (extension === 'xlsx' || extension === 'xls') {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { 
        type: 'array',
        cellFormula: true,
        cellNF: true,
        cellText: true,
      });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(firstSheet, { 
        defval: '',
        raw: true,
      });
      
      // Normalize column names by trimming whitespace
      return data.map((row: any) => {
        const normalized: Record<string, any> = {};
        Object.entries(row).forEach(([key, value]) => {
          normalized[key.trim()] = value;
        });
        return normalized;
      });
    }
    
    throw new Error("פורמט קובץ לא נתמך. יש להעלות CSV או Excel");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
      toast({
        title: "שגיאה",
        description: "יש להעלות קובץ CSV או Excel בלבד",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const data = await parseFile(file);
      
      if (data.length === 0) {
        throw new Error("לא נמצאו נתונים בקובץ");
      }

      // Extract columns from first row
      const columns = Object.keys(data[0]);
      
      // Auto-detect mappings
      const autoMappings: FieldMapping[] = columns.map(col => {
        const normalizedCol = col.trim().toLowerCase();
        const detectedField = AUTO_DETECT_MAPPINGS[col] || 
                             AUTO_DETECT_MAPPINGS[col.trim()] ||
                             AUTO_DETECT_MAPPINGS[normalizedCol] ||
                             null;
        return { csvColumn: col, systemField: detectedField };
      });

      setFileName(file.name);
      setRawData(data);
      setCsvColumns(columns);
      setMappings(autoMappings);
      setStep("mapping");
    } catch (error: any) {
      toast({
        title: "שגיאה בקריאת הקובץ",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateMapping = (csvColumn: string, systemField: string | null) => {
    setMappings(prev => 
      prev.map(m => 
        m.csvColumn === csvColumn 
          ? { ...m, systemField: systemField === "skip" ? null : systemField }
          : m
      )
    );
  };

  const missingRequiredFields = useMemo(() => {
    const requiredFields = systemFields.filter(f => f.required);
    return requiredFields.filter(rf => !mappings.some(m => m.systemField === rf.key));
  }, [mappings, systemFields]);

  const previewData = useMemo(() => {
    if (rawData.length === 0) return [];
    
    return rawData.slice(0, 5).map(row => {
      const mapped: Record<string, any> = {};
      mappings.forEach(m => {
        if (m.systemField) {
          mapped[m.systemField] = row[m.csvColumn];
        }
      });
      return mapped;
    });
  }, [rawData, mappings]);

  const parseDate = (val: string) => {
    if (!val) return null;
    // Try DD/MM/YY or DD/MM/YYYY format
    const parts = val.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      const d = new Date(`${year}-${month}-${day}`);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    // Try ISO format
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return null;
  };

  const mapSource = (val: string) => {
    const v = val.toLowerCase().replace(/[\s_\-]/g, '');
    if (v.includes("אתר") || v.includes("website")) return "website";
    if (v.includes("לינקדאין") || v.includes("linkedin")) return "linkedin";
    if (v.includes("שיחה") || v.includes("טלפון") || v.includes("המלצה") || v.includes("referral")) return "referral";
    if (v.includes("facebook") || v.includes("פייסבוק")) return "facebook";
    if (v.includes("instagram") || v.includes("אינסטגרם")) return "instagram";
    return "other";
  };

  const mapStatus = (val: string) => {
    const v = val.toLowerCase().replace(/[\s_\-]/g, '');
    if (v.includes("closed") || v.includes("נסגר") || v.includes("won")) return "closed";
    if (v.includes("lost") || v.includes("הפסד") || v.includes("לארלוונטי")) return "lost";
    if (v.includes("proposal") || v.includes("הצעה")) return "proposal_sent";
    if (v.includes("contact") || v.includes("פניה")) return "contacted";
    if (v.includes("follow") || v.includes("פולואפ")) return "follow_up";
    if (v.includes("qualified")) return "qualified";
    return "new";
  };

  const handleImport = async () => {
    if (!tenantId) {
      toast({ title: "שגיאה", description: "לא נמצא ארגון", variant: "destructive" });
      return;
    }

    if (!defaultAgencyId) {
      toast({ title: "שגיאה", description: "יש לבחור סוכנות ברירת מחדל", variant: "destructive" });
      return;
    }

    if (missingRequiredFields.length > 0) {
      toast({ 
        title: "שגיאה", 
        description: `חובה למפות את השדות: ${missingRequiredFields.map(f => f.label).join(', ')}`,
        variant: "destructive" 
      });
      return;
    }

    setStep("importing");
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("משתמש לא מחובר");

      // Build field map
      const fieldMap: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.systemField) {
          fieldMap[m.csvColumn] = m.systemField;
        }
      });

      const mapped = rawData.map(row => {
        const lead: any = {
          tenant_id: tenantId,
          agency_id: defaultAgencyId,
        };

        if (defaultSalesPersonId) {
          lead.sales_person_id = defaultSalesPersonId;
        }

        // Map each field
        Object.entries(fieldMap).forEach(([csvCol, sysField]) => {
          const value = row[csvCol];
          if (value === undefined || value === null || String(value).trim() === '') return;

          const strValue = String(value).trim();

          switch (sysField) {
            case 'company_name':
            case 'contact_name':
            case 'notes':
            case 'products':
            case 'campaign_name':
            case 'industry':
            case 'folder_link':
              lead[sysField] = strValue;
              break;
            case 'email':
              if (strValue.includes('@')) lead.email = strValue;
              break;
            case 'phone':
              lead.phone = strValue.replace(/[^\d+\-\s]/g, '');
              break;
            case 'source':
              lead.source = mapSource(strValue);
              break;
            case 'status':
              lead.status = mapStatus(strValue);
              break;
            case 'monthly_budget':
            case 'three_month_budget':
            case 'estimated_deal_value':
              const num = parseFloat(strValue.replace(/[^\d.-]/g, ''));
              if (!isNaN(num) && num > 0) lead[sysField] = num;
              break;
            case 'created_at':
              const createdDate = parseDate(strValue);
              if (createdDate) lead.created_at = createdDate + 'T00:00:00Z';
              break;
            case 'proposal_date':
              const propDate = parseDate(strValue);
              if (propDate) {
                lead.proposal_date = propDate;
                lead.proposal_sent_date = propDate;
              }
              break;
            case 'won_date':
              const wonDate = parseDate(strValue);
              if (wonDate) {
                lead.won_date = wonDate;
                lead.sale_date = wonDate;
                lead.closing_date = wonDate;
                lead.status = 'closed';
              }
              break;
          }
        });

        // Fallbacks
        if (!lead.company_name && lead.contact_name) {
          lead.company_name = lead.contact_name;
        }
        if (!lead.source) lead.source = 'other';
        if (!lead.status) lead.status = 'new';
        if (!lead.created_at) lead.created_at = new Date().toISOString();

        return lead;
      });

      // Filter valid leads
      const validLeads = mapped.filter(l => {
        const name = (l.company_name || '').trim();
        const contact = (l.contact_name || '').trim();
        const email = (l.email || '').trim();
        const phone = (l.phone || '').trim();
        return name || contact || email || phone;
      });

      if (validLeads.length === 0) {
        throw new Error("לא נמצאו לידים תקינים בקובץ");
      }

      // Save backup
      await supabase.from("import_history").insert({
        tenant_id: tenantId,
        import_type: "leads",
        file_name: fileName,
        file_content: JSON.stringify(rawData),
        imported_by: user.id,
        records_count: validLeads.length,
      });

      // Get existing leads for comparison
      const { data: existingLeads } = await supabase
        .from("leads")
        .select("id, company_name, email, phone")
        .eq("agency_id", defaultAgencyId);

      const normalizeStr = (s: string | null | undefined) => (s || "").toString().trim().toLowerCase();
      const updates: any[] = [];
      const inserts: any[] = [];

      for (const lead of validLeads) {
        const name = normalizeStr(lead.company_name);
        const email = normalizeStr(lead.email);
        const phone = (lead.phone || "").toString().replace(/[\s-]/g, "");
        
        const existing = existingLeads?.find(e =>
          normalizeStr(e.company_name) === name &&
          (
            (email && normalizeStr(e.email) === email) ||
            (!email && e.phone && e.phone.toString().replace(/[\s-]/g, "") === phone)
          )
        );

        if (existing) {
          updates.push({ ...lead, id: existing.id });
        } else {
          inserts.push(lead);
        }
      }

      // Execute updates
      if (updates.length > 0) {
        const { error } = await supabase.from("leads").upsert(updates);
        if (error) throw error;
      }

      // Execute inserts
      if (inserts.length > 0) {
        const { error } = await supabase.from("leads").insert(inserts);
        if (error) throw error;
      }

      setImportResult({ updates: updates.length, inserts: inserts.length });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
      toast({
        title: "הצלחה!",
        description: `${updates.length} לידים עודכנו, ${inserts.length} לידים חדשים נוספו`,
      });

    } catch (error: any) {
      console.error("Error importing leads:", error);
      toast({
        title: "שגיאה בייבוא",
        description: error.message,
        variant: "destructive",
      });
      setStep("preview");
    } finally {
      setIsLoading(false);
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            בחר קובץ CSV או Excel להעלאה
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="leads-upload"
            disabled={isLoading}
          />
          <label htmlFor="leads-upload">
            <Button asChild disabled={isLoading}>
              <span className="cursor-pointer">
                {isLoading ? "טוען..." : "בחר קובץ"}
              </span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>{fileName}</span>
        <Badge variant="secondary">{rawData.length} שורות</Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <Label>סוכנות ברירת מחדל *</Label>
          <Select value={defaultAgencyId} onValueChange={setDefaultAgencyId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוכנות" />
            </SelectTrigger>
            <SelectContent>
              {agencies.map(agency => (
                <SelectItem key={agency.id} value={agency.id}>
                  {agency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>איש מכירות ברירת מחדל</Label>
          <Select 
            value={defaultSalesPersonId} 
            onValueChange={setDefaultSalesPersonId}
            disabled={!defaultAgencyId}
          >
            <SelectTrigger>
              <SelectValue placeholder={defaultAgencyId ? "בחר איש מכירות" : "בחר סוכנות קודם"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ללא</SelectItem>
              {salesPeople.map(sp => (
                <SelectItem key={sp.id} value={sp.id}>
                  {sp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="text-sm font-medium mb-2">מיפוי שדות:</div>
      <ScrollArea className="h-[300px] border rounded-lg p-2">
        <div className="space-y-2">
          {mappings.map((mapping, idx) => {
            const sampleValue = rawData[0]?.[mapping.csvColumn];
            const displaySample = sampleValue !== undefined && sampleValue !== null && sampleValue !== '' 
              ? String(sampleValue) 
              : "(ריק)";
            return (
              <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                <div className="flex-1">
                  <div className="font-mono text-sm truncate" title={mapping.csvColumn}>
                    {mapping.csvColumn}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={displaySample}>
                    דוגמה: {displaySample}
                  </div>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={mapping.systemField || "skip"}
                  onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="skip">
                      <span className="text-muted-foreground">דלג על שדה זה</span>
                    </SelectItem>
                    {systemFields.map(field => (
                      <SelectItem key={field.key} value={field.key}>
                        {field.label} {field.required && "*"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {missingRequiredFields.length > 0 && (
        <p className="text-sm text-destructive">* חובה למפות: {missingRequiredFields.map(f => f.label).join(', ')}</p>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={resetState}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזור
        </Button>
        <Button 
          onClick={() => setStep("preview")} 
          disabled={missingRequiredFields.length > 0 || !defaultAgencyId}
        >
          המשך לתצוגה מקדימה
          <ArrowLeft className="h-4 w-4 mr-2" />
        </Button>
      </div>
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="secondary">{rawData.length} שורות לייבוא</Badge>
        <Badge variant="outline">
          סוכנות: {agencies.find(a => a.id === defaultAgencyId)?.name}
        </Badge>
      </div>

      <div className="text-sm font-medium">תצוגה מקדימה (5 שורות ראשונות):</div>
      <ScrollArea className="h-[250px] border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {systemFields.filter(f => mappings.some(m => m.systemField === f.key)).map(field => (
                <TableHead key={field.key} className="whitespace-nowrap">
                  {field.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((row, idx) => (
              <TableRow key={idx}>
                {systemFields.filter(f => mappings.some(m => m.systemField === f.key)).map(field => (
                  <TableCell key={field.key} className="max-w-[150px] truncate">
                    {row[field.key] ?? "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setStep("mapping")}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזור למיפוי
        </Button>
        <Button onClick={handleImport} disabled={isLoading}>
          {isLoading ? "מייבא..." : "התחל ייבוא"}
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
              {importResult.updates} לידים עודכנו, {importResult.inserts} לידים חדשים נוספו
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
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          ייבוא לידים
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {step === "upload" && "ייבוא לידים מקובץ"}
            {step === "mapping" && "מיפוי שדות"}
            {step === "preview" && "תצוגה מקדימה"}
            {step === "importing" && "מייבא..."}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
          {step === "upload" && renderUploadStep()}
          {step === "mapping" && renderMappingStep()}
          {step === "preview" && renderPreviewStep()}
          {step === "importing" && renderImportingStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
