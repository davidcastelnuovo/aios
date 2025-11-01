import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";

export function ImportLeadsCSV() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "שגיאה",
        description: "יש להעלות קובץ CSV בלבד",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const text = await file.text();
      
      // Get current user and tenant for backup
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("משתמש לא מחובר");
      
      const { data: tenantData } = await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      
      if (!tenantData) throw new Error("לא נמצא tenant למשתמש");

      // Parse CSV
      const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length) {
        console.warn("CSV parse warnings:", parsed.errors);
      }
      const rows = (parsed.data || []) as any[];

      if (rows.length === 0) {
        throw new Error("לא נמצאו נתונים בקובץ");
      }

      // Get agency and salesperson
      const { data: promoAgency, error: agencyErr } = await supabase
        .from("agencies")
        .select("id, name")
        .ilike("name", "%promo%")
        .maybeSingle();
      if (agencyErr) throw agencyErr;
      if (!promoAgency) throw new Error('סוכנות "promo" לא נמצאה');

      const { data: zivPerson, error: spErr } = await supabase
        .from("sales_people")
        .select("id, full_name")
        .eq("agency_id", promoAgency.id)
        .ilike("full_name", "%זיו%")
        .maybeSingle();
      if (spErr) throw spErr;
      if (!zivPerson) throw new Error('איש מכירות "זיו" לא נמצא');

      const normalize = (s: string | null | undefined) =>
        (s || "").toString().trim().replace(/[\s_\-\/'"]/g, "").toLowerCase();

      const parseDate = (val: string) => {
        if (!val) return null;
        // Try DD/MM/YY format
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
        const v = normalize(val);
        if (v.includes("אתר") || v.includes("website")) return "website";
        if (v.includes("לינקדאין") || v.includes("linkedin")) return "linkedin";
        if (v.includes("שיחה") || v.includes("טלפון") || v.includes("איתי") || v.includes("המלצה")) return "referral";
        // Default to 'other' for all social media and unrecognized sources
        return "other";
      };

      const mapStatus = (val: string) => {
        const v = normalize(val);
        if (v.includes("איןמענה") || v.includes("אינומענה")) return "contacted";
        if (v.includes("לאמעוניין") || v.includes("לאמעניין")) return "closed";
        if (v.includes("לארלוונטי")) return "closed";
        if (v.includes("פולואפ") || v.includes("פולאפ")) return "follow_up";
        if (v.includes("הצעתמחיר") || v.includes("הצעה") || v.includes("נקבעהפגישה") || v.includes("נקבעהשיחה")) return "proposal_sent";
        if (v.includes("נסגר") || v.includes("מכירה")) return "closed";
        if (v.includes("פגישהעםאיתי") || v.includes("ממתיןלשיחה")) return "follow_up";
        return "new";
      };

      const mapResponseStatus = (val: string) => {
        const v = normalize(val);
        if (v.includes("איןמענה4")) return "no_answer_4";
        if (v.includes("איןמענה3")) return "no_answer_3";
        if (v.includes("איןמענה2")) return "no_answer_2";
        if (v.includes("איןמענה") || v.includes("אינומענה")) return "no_answer_1";
        if (v.includes("מכחישפניה")) return "denies_contact";
        if (v.includes("לארלוונטי")) return "not_relevant";
        return null;
      };

      const mapped = rows.map((row) => {
        const lead: any = {
          agency_id: promoAgency.id,
          sales_person_id: zivPerson.id,
        };

        // שם - contact name
        if (row['שם']) lead.contact_name = row['שם'].toString().trim();
        
        // נייד - phone
        if (row['נייד']) lead.phone = row['נייד'].toString().trim();
        
        // מייל - email
        if (row['מייל']) lead.email = row['מייל'].toString().trim();
        
        // שם העסק - company name
        if (row['שם העסק']) {
          lead.company_name = row['שם העסק'].toString().trim();
        } else if (lead.contact_name) {
          lead.company_name = lead.contact_name;
        }
        
        // פרסום - industry/notes
        if (row['פרסום']) lead.industry = row['פרסום'].toString().trim();
        
        // מקור הגעה - source
        if (row['מקור הגעה']) lead.source = mapSource(row['מקור הגעה'].toString());
        
        // סטטוס + סיבת הפסד (אם רלוונטי)
        if (row['סטטוס']) {
          const statusText = row['סטטוס'].toString();
          lead.status = mapStatus(statusText);
          const vstat = normalize(statusText);
          if (vstat.includes('לאמעוניין') || vstat.includes('לאמעניין') || vstat.includes('לארלוונטי')) {
            lead.lost_reason = statusText.trim();
          }
          const resp = mapResponseStatus(statusText);
          if (resp) lead.response_status = resp;
        }
        
        // הערות - notes
        if (row['הערות']) lead.notes = row['הערות'].toString().trim();
        
        // מוצרים - products
        if (row['מוצרים']) lead.products = row['מוצרים'].toString().trim();
        
        // תאריך הצעה
        if (row['תאריך הצעה']) {
          const d = parseDate(row['תאריך הצעה'].toString());
          if (d) {
            lead.proposal_date = d;
            if (lead.status === 'new') lead.status = 'proposal_sent';
          }
        }
        
        // תאריך מכירה
        if (row['תאריך מכירה']) {
          const d = parseDate(row['תאריך מכירה'].toString());
          if (d) {
            lead.sale_date = d;
            lead.won_date = d;
            lead.closing_date = d;
            lead.status = 'won';
          }
        }
        
        // תאריך קליטת ליד - created_at
        if (row['תאריך קליטת ליד']) {
          const d = parseDate(row['תאריך קליטת ליד'].toString());
          if (d) {
            lead.created_at = d + 'T00:00:00Z';
          }
        }
        
        // הצעה חד"פ - monthly budget
        const monthlyKey = row['הצעה חד"פ'] ? 'הצעה חד"פ' : row['הצעה חד״פ'] ? 'הצעה חד״פ' : null;
        if (monthlyKey && row[monthlyKey]) {
          const val = row[monthlyKey].toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) lead.monthly_budget = n;
        }
        
        // הצעה 3 חודשים
        if (row['הצעה 3 חודשים']) {
          const val = row['הצעה 3 חודשים'].toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) lead.three_month_budget = n;
        }
        
        // שווי הצעות/הסכמים
        if (row['שווי הצעות/הסכמים']) {
          const val = row['שווי הצעות/הסכמים'].toString().replace(/[^\d.-]/g, '');
          const n = parseFloat(val);
          if (!isNaN(n) && n > 0) lead.estimated_deal_value = n;
        }

        if (!lead.status) lead.status = "new";
        
        return lead;
      });

      const validLeads = mapped.filter((l) => {
        const name = (l.company_name || '').trim();
        const contact = (l.contact_name || '').trim();
        const email = (l.email || '').trim();
        const phone = (l.phone || '').trim();
        if (!name && !contact && !email && !phone) return false;
        return true;
      });

      if (validLeads.length === 0) {
        throw new Error("לא נמצאו לידים תקינים בקובץ");
      }

      // Save backup to import_history before inserting
      const { error: backupError } = await supabase
        .from("import_history")
        .insert({
          tenant_id: tenantData.tenant_id,
          import_type: "leads",
          file_name: file.name,
          file_content: text,
          imported_by: user.id,
          records_count: validLeads.length,
        });
      
      if (backupError) {
        console.error("Failed to save backup:", backupError);
        // Continue with import even if backup fails
      }

      // Use upsert to update existing leads or insert new ones
      // Match by company_name and email (or phone if email is missing)
      const { error, data: upsertedData } = await supabase
        .from("leads")
        .upsert(validLeads, { 
          onConflict: 'company_name,email',
          ignoreDuplicates: false 
        })
        .select();
      
      if (error) {
        // If onConflict doesn't work (no unique constraint), do manual check
        console.warn("Upsert with conflict failed, doing manual merge:", error);
        
        // Get existing leads for comparison
        const { data: existingLeads } = await supabase
          .from("leads")
          .select("id, company_name, email, phone");
        
        const updates = [];
        const inserts = [];
        
        for (const lead of validLeads) {
          // Find matching lead by company_name + email/phone
          const existing = existingLeads?.find(e => 
            e.company_name === lead.company_name && 
            (e.email === lead.email || (lead.email && e.email === lead.email) || 
             (!lead.email && e.phone === lead.phone))
          );
          
          if (existing) {
            updates.push({ ...lead, id: existing.id });
          } else {
            inserts.push(lead);
          }
        }
        
        // Perform updates
        if (updates.length > 0) {
          const { error: updateError } = await supabase
            .from("leads")
            .upsert(updates);
          if (updateError) throw updateError;
        }
        
        // Perform inserts
        if (inserts.length > 0) {
          const { error: insertError } = await supabase
            .from("leads")
            .insert(inserts);
          if (insertError) throw insertError;
        }
        
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "הצלחה!",
          description: `${updates.length} לידים עודכנו, ${inserts.length} לידים חדשים נוספו.`,
        });
        
        setOpen(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "הצלחה!",
        description: `${validLeads.length} לידים יובאו/עודכנו בהצלחה.`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error("Error importing CSV:", error);
      toast({
        title: "שגיאה בייבוא",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          ייבוא מ-CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ייבוא לידים מקובץ CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                בחר קובץ CSV להעלאה
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={isLoading}
              />
              <label htmlFor="csv-upload">
                <Button asChild disabled={isLoading}>
                  <span className="cursor-pointer">
                    {isLoading ? "מעלה..." : "בחר קובץ"}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">שדות נתמכים:</p>
            <ul className="list-disc list-inside space-y-0.5 grid grid-cols-2 gap-x-4">
              <li>שם (איש קשר)</li>
              <li>שם העסק</li>
              <li>מייל</li>
              <li>נייד</li>
              <li>פרסום</li>
              <li>סטטוס</li>
              <li>הערות</li>
              <li>הצעה חד"פ</li>
              <li>הצעה 3 חודשים</li>
              <li>תאריך הצעה</li>
              <li>תאריך מכירה</li>
              <li>מוצרים</li>
              <li>שווי הצעות/הסכמים</li>
              <li>מקור הגעה</li>
              <li>תאריך קליטת ליד</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}