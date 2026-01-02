import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, Plus, Tag } from "lucide-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type Step = "upload" | "mapping" | "preview" | "importing";

interface FieldMapping {
  csvColumn: string;
  systemField: string | null;
}

interface NewValueItem {
  value: string;
  color: string;
  type: 'status' | 'tag';
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280', // gray
  '#14B8A6', // teal
];

const BASE_SYSTEM_FIELDS = [
  { key: "company_name", label: "שם העסק" },
  { key: "contact_name", label: "שם איש קשר" },
  { key: "email", label: "אימייל" },
  { key: "phone", label: "טלפון" },
  { key: "source", label: "מקור הגעה" },
  { key: "status", label: "סטטוס (פייפליין)" },
  { key: "response_status", label: "סטטוס תגובה" },
  { key: "tags", label: "תגיות" },
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
  { key: "updates", label: "עדכונים" },
];

// Auto-detect update columns (עדכון 1-21)
const isUpdateColumn = (colName: string): boolean => {
  const normalized = colName.trim().toLowerCase();
  // Match "עדכון X" or "update X" patterns
  const hebrewMatch = normalized.match(/^עדכון\s*(\d+)$/);
  const englishMatch = normalized.match(/^update\s*(\d+)$/i);
  return !!(hebrewMatch || englishMatch);
};

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
  'סטטוס תגובה': 'response_status',
  'תגיות': 'tags',
  'תג': 'tags',
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
  'response_status': 'response_status',
  'tags': 'tags',
  'tag': 'tags',
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rawData, setRawData] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [defaultAgencyId, setDefaultAgencyId] = useState<string>("");
  const [defaultSalesPersonId, setDefaultSalesPersonId] = useState<string>("");
  const [importResult, setImportResult] = useState<{ updates: number; inserts: number; leadUpdates?: number } | null>(null);
  const [newValues, setNewValues] = useState<NewValueItem[]>([]);

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
        .select("field_key, field_label, is_required, is_visible")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "lead");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch existing lead statuses
  const { data: existingStatuses = [] } = useQuery({
    queryKey: ["lead-statuses", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("lead_statuses")
        .select("id, status_key, label, color")
        .eq("tenant_id", tenantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId && open,
  });

  // Fetch existing chat tags
  const { data: existingTags = [] } = useQuery({
    queryKey: ["chat-tags", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("chat_tags")
        .select("id, name, color")
        .eq("tenant_id", tenantId);
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
        // Use custom label if defined, otherwise fall back to base label
        label: customField?.field_label || field.label,
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
    setNewValues([]);
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
        // Check if it's an update column first
        if (isUpdateColumn(col)) {
          return { csvColumn: col, systemField: 'updates' };
        }
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

  // Detect new statuses and tags that need to be created
  const detectNewValues = useMemo(() => {
    const newItems: NewValueItem[] = [];
    
    // Check for response_status column
    const statusMapping = mappings.find(m => m.systemField === 'response_status');
    if (statusMapping) {
      const existingStatusLabels = existingStatuses.map(s => s.label.toLowerCase().trim());
      const existingStatusKeys = existingStatuses.map(s => s.status_key.toLowerCase().trim());
      const uniqueValues = new Set<string>();
      
      rawData.forEach(row => {
        const val = row[statusMapping.csvColumn];
        if (val && String(val).trim()) {
          uniqueValues.add(String(val).trim());
        }
      });
      
      let statusColorIdx = 0;
      uniqueValues.forEach((val) => {
        const normalizedVal = val.toLowerCase().trim();
        if (!existingStatusLabels.includes(normalizedVal) && !existingStatusKeys.includes(normalizedVal)) {
          // Check if already in newItems
          if (!newItems.some(item => item.value.toLowerCase() === normalizedVal && item.type === 'status')) {
            newItems.push({
              value: val,
              color: DEFAULT_COLORS[statusColorIdx % DEFAULT_COLORS.length],
              type: 'status'
            });
            statusColorIdx++;
          }
        }
      });
    }
    
    // Check for tags column
    const tagsMapping = mappings.find(m => m.systemField === 'tags');
    if (tagsMapping) {
      const existingTagNames = existingTags.map(t => t.name.toLowerCase().trim());
      const uniqueTags = new Set<string>();
      
      rawData.forEach(row => {
        const val = row[tagsMapping.csvColumn];
        if (val && String(val).trim()) {
          // Split by comma in case multiple tags
          const tags = String(val).split(',').map(t => t.trim()).filter(t => t);
          tags.forEach(tag => uniqueTags.add(tag));
        }
      });
      
      let colorIdx = 0;
      uniqueTags.forEach(tag => {
        const normalizedTag = tag.toLowerCase().trim();
        if (!existingTagNames.includes(normalizedTag)) {
          if (!newItems.some(item => item.value.toLowerCase() === normalizedTag && item.type === 'tag')) {
            newItems.push({
              value: tag,
              color: DEFAULT_COLORS[colorIdx % DEFAULT_COLORS.length],
              type: 'tag'
            });
            colorIdx++;
          }
        }
      });
    }
    
    return newItems;
  }, [mappings, rawData, existingStatuses, existingTags]);

  // Update newValues when detectNewValues changes
  const handleProceedToPreview = () => {
    setNewValues(detectNewValues);
    setStep("preview");
  };

  const updateNewValueColor = (value: string, type: 'status' | 'tag', color: string) => {
    setNewValues(prev => 
      prev.map(item => 
        item.value === value && item.type === type
          ? { ...item, color }
          : item
      )
    );
  };

  // Count update columns mapped
  const updateColumnsCount = useMemo(() => {
    return mappings.filter(m => m.systemField === 'updates').length;
  }, [mappings]);

  // Get mapped fields (excluding 'updates' which is handled separately)
  const mappedFields = useMemo(() => {
    return systemFields.filter(f => 
      f.key !== 'updates' && mappings.some(m => m.systemField === f.key)
    );
  }, [systemFields, mappings]);

  const previewData = useMemo(() => {
    if (rawData.length === 0) return [];
    
    return rawData.slice(0, 5).map(row => {
      const mapped: Record<string, any> = {};
      mappings.forEach(m => {
        if (m.systemField && m.systemField !== 'updates') {
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
    // lead_status enum values: new/contacted/follow_up/proposal_sent/meeting_scheduled/negotiation/closed/transferred_to_onboarding
    if (v.includes("closed") || v.includes("נסגר") || v.includes("won") || v.includes("lost") || v.includes("הפסד") || v.includes("לארלוונטי")) return "closed";
    if (v.includes("proposal") || v.includes("הצעה")) return "proposal_sent";
    if (v.includes("meeting") || v.includes("פגישה")) return "meeting_scheduled";
    if (v.includes("negotiation") || v.includes("משאומתן") || v.includes("משא ומתן")) return "negotiation";
    if (v.includes("contact") || v.includes("פניה")) return "contacted";
    if (v.includes("follow") || v.includes("פולואפ")) return "follow_up";
    if (v.includes("qualified")) return "contacted";
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

      // Create new statuses
      const newStatuses = newValues.filter(v => v.type === 'status');
      const statusKeyMap: Record<string, string> = {};
      
      if (newStatuses.length > 0) {
        // Get max sort_order for statuses
        const { data: maxSortData } = await supabase
          .from("lead_statuses")
          .select("sort_order")
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: false })
          .limit(1);
        
        let nextSortOrder = (typeof maxSortData?.[0]?.sort_order === 'number' ? maxSortData[0].sort_order : 0) + 1;
        
        for (const status of newStatuses) {
          const statusKey = status.value.toLowerCase().replace(/[^a-z0-9א-ת]/g, '_');
          const { data, error } = await supabase
            .from("lead_statuses")
            .insert({
              tenant_id: tenantId,
              status_key: statusKey,
              label: status.value,
              color: status.color,
              sort_order: nextSortOrder++,
              is_active: true
            })
            .select("status_key")
            .single();
          
          if (error) {
            console.error("Error creating status:", error);
          } else if (data) {
            statusKeyMap[status.value.toLowerCase()] = data.status_key;
          }
        }
      }
      
      // Add existing statuses to the map
      existingStatuses.forEach(s => {
        statusKeyMap[s.label.toLowerCase()] = s.status_key;
      });

      // Create new tags
      const newTagsList = newValues.filter(v => v.type === 'tag');
      const tagIdMap: Record<string, string> = {};
      
      if (newTagsList.length > 0) {
        // Get max sort_order for tags
        const { data: maxTagSortData } = await supabase
          .from("chat_tags")
          .select("sort_order")
          .eq("tenant_id", tenantId)
          .order("sort_order", { ascending: false })
          .limit(1);
        
        let nextTagSortOrder = (typeof maxTagSortData?.[0]?.sort_order === 'number' ? maxTagSortData[0].sort_order : 0) + 1;
        
        for (const tag of newTagsList) {
          const { data, error } = await supabase
            .from("chat_tags")
            .insert({
              tenant_id: tenantId,
              name: tag.value,
              color: tag.color,
              sort_order: nextTagSortOrder++
            })
            .select("id, name")
            .single();
          
          if (error) {
            console.error("Error creating tag:", error);
          } else if (data) {
            tagIdMap[tag.value.toLowerCase()] = data.id;
          }
        }
      }
      
      // Add existing tags to the map
      existingTags.forEach(t => {
        tagIdMap[t.name.toLowerCase()] = t.id;
      });

      // Build field map
      const fieldMap: Record<string, string> = {};
      mappings.forEach(m => {
        if (m.systemField) {
          fieldMap[m.csvColumn] = m.systemField;
        }
      });

      // Find tags column for later processing
      const tagsColumnName = Object.entries(fieldMap).find(([_, v]) => v === 'tags')?.[0];

      // Find update columns mapped to 'updates'
      const updateColumns = Object.entries(fieldMap)
        .filter(([_, v]) => v === 'updates')
        .map(([k, _]) => k)
        .sort((a, b) => {
          // Sort by number in column name (עדכון 1, עדכון 2, etc.)
          const numA = parseInt(a.match(/\d+/)?.[0] || '0');
          const numB = parseInt(b.match(/\d+/)?.[0] || '0');
          return numA - numB;
        });

      const mapped = rawData.map((row, rowIdx) => {
        const lead: any = {
          tenant_id: tenantId,
          agency_id: defaultAgencyId,
        };

        if (defaultSalesPersonId) {
          lead.sales_person_id = defaultSalesPersonId;
        }

        // Store tags for later processing (not a lead field)
        let rowTags: string[] = [];
        
        // Collect updates from update columns
        const rowUpdates: string[] = [];
        updateColumns.forEach(col => {
          const val = row[col];
          if (val && String(val).trim()) {
            rowUpdates.push(String(val).trim());
          }
        });

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
            case 'response_status':
              // Map to status_key from lead_statuses
              const statusKey = statusKeyMap[strValue.toLowerCase()];
              if (statusKey) {
                lead.response_status = statusKey;
              }
              break;
            case 'tags':
              // Parse tags and store for later
              rowTags = strValue.split(',').map(t => t.trim()).filter(t => t);
              break;
            case 'updates':
              // Already handled separately
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

        return { lead, tags: rowTags, updates: rowUpdates };
      });

      // Filter valid leads - must have company_name (or can generate one)
      const validLeads = mapped.filter(({ lead }) => {
        const name = (lead.company_name || '').trim();
        const contact = (lead.contact_name || '').trim();
        const email = (lead.email || '').trim();
        const phone = (lead.phone || '').trim();
        
        // If no company_name, try to generate one from available fields
        if (!name) {
          if (contact) {
            lead.company_name = contact;
          } else if (email) {
            lead.company_name = email.split('@')[0];
          } else if (phone) {
            lead.company_name = `ליד ${phone}`;
          } else {
            return false; // No valid identifier at all
          }
        }
        
        return true;
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
      const leadUpdates: { lead: any; tags: string[]; updates: string[]; existingId: string }[] = [];
      const leadInserts: { lead: any; tags: string[]; updates: string[] }[] = [];

      for (const { lead, tags, updates: rowUpdates } of validLeads) {
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
          leadUpdates.push({ lead: { ...lead, id: existing.id }, tags, updates: rowUpdates, existingId: existing.id });
        } else {
          leadInserts.push({ lead, tags, updates: rowUpdates });
        }
      }

      // Execute updates
      if (leadUpdates.length > 0) {
        const { error } = await supabase.from("leads").upsert(leadUpdates.map(u => u.lead));
        if (error) throw error;
      }

      // Execute inserts and get new IDs
      const insertedIds: string[] = [];
      if (leadInserts.length > 0) {
        const { data: insertedData, error } = await supabase
          .from("leads")
          .insert(leadInserts.map(i => i.lead))
          .select("id");
        if (error) throw error;
        if (insertedData) {
          insertedIds.push(...insertedData.map(d => d.id));
        }
      }

      // Create chat_contact_tags for tags
      const tagRecords: { tag_id: string; lead_id: string; tenant_id: string; user_id: string }[] = [];
      
      // For updates
      for (const { tags, existingId } of leadUpdates) {
        for (const tagName of tags) {
          const tagId = tagIdMap[tagName.toLowerCase()];
          if (tagId) {
            tagRecords.push({
              tag_id: tagId,
              lead_id: existingId,
              tenant_id: tenantId,
              user_id: user.id
            });
          }
        }
      }
      
      // For inserts
      leadInserts.forEach(({ tags }, idx) => {
        const leadId = insertedIds[idx];
        if (leadId) {
          for (const tagName of tags) {
            const tagId = tagIdMap[tagName.toLowerCase()];
            if (tagId) {
              tagRecords.push({
                tag_id: tagId,
                lead_id: leadId,
                tenant_id: tenantId,
                user_id: user.id
              });
            }
          }
        }
      });

      // Insert tag records
      if (tagRecords.length > 0) {
        const { error: tagError } = await supabase
          .from("chat_contact_tags")
          .upsert(tagRecords, { onConflict: 'tag_id,lead_id,tenant_id,user_id' });
        if (tagError) {
          console.error("Error inserting tags:", tagError);
        }
      }

      // Create lead_updates records from update columns
      const leadUpdateRecords: { lead_id: string; user_id: string; content: string }[] = [];
      
      // For updated leads
      for (const { updates: rowUpdates, existingId } of leadUpdates) {
        for (const content of rowUpdates) {
          leadUpdateRecords.push({
            lead_id: existingId,
            user_id: user.id,
            content
          });
        }
      }
      
      // For inserted leads
      leadInserts.forEach(({ updates: rowUpdates }, idx) => {
        const leadId = insertedIds[idx];
        if (leadId) {
          for (const content of rowUpdates) {
            leadUpdateRecords.push({
              lead_id: leadId,
              user_id: user.id,
              content
            });
          }
        }
      });

      // Insert lead_updates records
      if (leadUpdateRecords.length > 0) {
        const { error: updateError } = await supabase
          .from("lead_updates")
          .insert(leadUpdateRecords);
        if (updateError) {
          console.error("Error inserting lead updates:", updateError);
        }
      }

      setImportResult({ updates: leadUpdates.length, inserts: leadInserts.length, leadUpdates: leadUpdateRecords.length });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["lead-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["chat-tags"] });
      queryClient.invalidateQueries({ queryKey: ["lead-updates"] });
      
      toast({
        title: "הצלחה!",
        description: `${leadUpdates.length} לידים עודכנו, ${leadInserts.length} לידים חדשים נוספו${leadUpdateRecords.length > 0 ? `, ${leadUpdateRecords.length} עדכונים נוספו` : ''}`,
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
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="leads-upload"
            disabled={isLoading}
          />
          <Button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? "טוען..." : "בחר קובץ"}
          </Button>
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
      <div className="flex-1 min-h-[200px] max-h-[300px] overflow-auto border rounded-lg p-3">
        <div className="space-y-2 pe-4">
          {mappings.map((mapping, idx) => {
            const sampleValue = rawData[0]?.[mapping.csvColumn];
            const displaySample = sampleValue !== undefined && sampleValue !== null && sampleValue !== '' 
              ? String(sampleValue) 
              : "(ריק)";
            return (
              <div key={idx} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm truncate" title={mapping.csvColumn}>
                    {mapping.csvColumn}
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={displaySample}>
                    דוגמה: {displaySample}
                  </div>
                </div>
                <ArrowLeft className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select
                  value={mapping.systemField || "skip"}
                  onValueChange={(value) => updateMapping(mapping.csvColumn, value)}
                >
                  <SelectTrigger className="w-[180px] shrink-0">
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
      </div>

      {missingRequiredFields.length > 0 && (
        <p className="text-sm text-destructive">* חובה למפות: {missingRequiredFields.map(f => f.label).join(', ')}</p>
      )}

      {!defaultAgencyId && (
        <p className="text-sm text-amber-600">⚠️ יש לבחור סוכנות ברירת מחדל כדי להמשיך</p>
      )}

      <div className="flex justify-between pt-4 border-t mt-4 sticky bottom-0 bg-background pb-1">
        <Button variant="outline" onClick={resetState}>
          <ArrowRight className="h-4 w-4 ml-2" />
          חזור
        </Button>
        <Button 
          onClick={handleProceedToPreview} 
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
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{rawData.length} שורות לייבוא</Badge>
        <Badge variant="outline">
          סוכנות: {agencies.find(a => a.id === defaultAgencyId)?.name}
        </Badge>
        {updateColumnsCount > 0 && (
          <Badge variant="default" className="bg-blue-600">
            {updateColumnsCount} עמודות עדכונים
          </Badge>
        )}
      </div>

      {/* Update columns info */}
      {updateColumnsCount > 0 && (
        <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950/30 text-sm">
          <p className="text-blue-700 dark:text-blue-300">
            🔄 זוהו {updateColumnsCount} עמודות עדכונים (עדכון 1-{updateColumnsCount}). 
            התוכן מכל עמודה יתווסף לעדכונים של הליד.
          </p>
        </div>
      )}

      {/* New values to be created */}
      {newValues.length > 0 && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Plus className="h-4 w-4 text-green-600" />
            <span>ערכים חדשים שייווצרו:</span>
          </div>
          
          {/* New Statuses */}
          {newValues.filter(v => v.type === 'status').length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">סטטוסים חדשים:</div>
              <div className="flex flex-wrap gap-2">
                {newValues.filter(v => v.type === 'status').map(status => (
                  <div key={status.value} className="flex items-center gap-2 bg-background p-2 rounded border">
                    <input
                      type="color"
                      value={status.color}
                      onChange={(e) => updateNewValueColor(status.value, 'status', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0"
                    />
                    <span className="text-sm">{status.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* New Tags */}
          {newValues.filter(v => v.type === 'tag').length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" />
                תגיות חדשות:
              </div>
              <div className="flex flex-wrap gap-2">
                {newValues.filter(v => v.type === 'tag').map(tag => (
                  <div key={tag.value} className="flex items-center gap-2 bg-background p-2 rounded border">
                    <input
                      type="color"
                      value={tag.color}
                      onChange={(e) => updateNewValueColor(tag.value, 'tag', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0"
                    />
                    <span className="text-sm">{tag.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-sm font-medium">תצוגה מקדימה (5 שורות ראשונות):</div>
      <div className="h-[200px] overflow-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {mappedFields.map(field => (
                <TableHead key={field.key} className="whitespace-nowrap">
                  {field.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewData.map((row, idx) => (
              <TableRow key={idx}>
                {mappedFields.map(field => (
                  <TableCell key={field.key} className="max-w-[150px] truncate">
                    {row[field.key] ?? "-"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
            {(importResult.leadUpdates ?? 0) > 0 && (
              <p className="text-sm text-blue-600 mt-1">
                נוספו {importResult.leadUpdates} עדכונים ללידים
              </p>
            )}
            {newValues.length > 0 && (
              <p className="text-sm text-green-600 mt-1">
                נוצרו {newValues.filter(v => v.type === 'status').length} סטטוסים ו-{newValues.filter(v => v.type === 'tag').length} תגיות חדשות
              </p>
            )}
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
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {step === "upload" && "ייבוא לידים מקובץ"}
            {step === "mapping" && "מיפוי שדות"}
            {step === "preview" && "תצוגה מקדימה"}
            {step === "importing" && "מייבא..."}
          </DialogTitle>
          <DialogDescription className="sr-only">
            ייבוא לידים מקובץ CSV או Excel
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {step === "upload" && renderUploadStep()}
          {step === "mapping" && renderMappingStep()}
          {step === "preview" && renderPreviewStep()}
          {step === "importing" && renderImportingStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
