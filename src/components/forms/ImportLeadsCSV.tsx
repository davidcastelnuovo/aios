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

      // Parse robustly with Papa Parse
      const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
      if (parsed.errors && parsed.errors.length) {
        console.warn("CSV parse warnings:", parsed.errors);
      }
      const rows = (parsed.data || []) as any[];

      if (rows.length === 0) {
        throw new Error("לא נמצאו נתונים בקובץ");
      }

      // Resolve defaults: agency 'promo' and salesperson 'זיו'
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
      if (!zivPerson) throw new Error('איש מכירות "זיו" לא נמצא בסוכנות promo');

      const normalize = (s: string | null | undefined) =>
        (s || "")
          .toString()
          .replace(/\*/g, "")
          .replace(/[\s_\-\/=\\()\[\]"'.,]/g, "")
          .toLowerCase();

      const mapResponse = (val: string) => {
        const v = normalize(val);
        if (v.includes("איןמענה1") || v.includes("ללאמענה1")) return "no_answer_1";
        if (v.includes("איןמענה2") || v.includes("ללאמענה2")) return "no_answer_2";
        if (v.includes("איןמענה3") || v.includes("ללאמענה3")) return "no_answer_3";
        if (v.includes("איןמענה4") || v.includes("ללאמענה4")) return "no_answer_4";
        if (v.includes("מכחישפניה")) return "denies_contact";
        if (v.includes("לארלוונטי")) return "not_relevant";
        return null;
      };

      const mapStage = (val: string) => {
        const v = normalize(val);
        if (v.includes("לידחדש")) return "new";
        if (v.includes("נוצרקשר")) return "contacted";
        if (v.includes("פולואפ")) return "follow_up";
        if (v.includes("נשלחההצעה") || v === "הצעה") return "proposal_sent";
        if (v.includes("נסגר")) return "closed";
        return "new";
      };

      const mapped = rows.map((row) => {
        const lead: any = {};
        Object.entries(row).forEach(([key, raw]) => {
          const value = (raw as string)?.toString().trim();
          if (!value) return;
          const k = normalize(key);

          // Company / contact names
          if (
            k.includes("שמהעסק") ||
            k.includes("שםהחברה") ||
            k.includes("שחברה") ||
            k.includes("שםעסק") ||
            k.includes("שםלקוח") ||
            k.includes("עסק") ||
            k.includes("חברה") ||
            k.includes("לקוח") ||
            k.includes("ארגון") ||
            k.includes("ארגונקליינט") ||
            k === "ארגון"
          ) {
            lead.company_name = value;
          } else if (
            k === "שם" ||
            k.includes("שםמלא") ||
            k.includes("שםפרטי") ||
            k.includes("שמקשר") ||
            k.includes("אישקשר")
          ) {
            // Only set contact_name when it's not clearly business name
            lead.contact_name = value;
          }
          // Email
          else if (
            k.includes("מייל") ||
            k.includes("אימייל") ||
            k.includes("email") ||
            k.includes("דואל") ||
            k.includes("דוא")
          ) {
            lead.email = value;
          }
          // Phone
          else if (
            k.includes("טלפון") ||
            k.includes("טל") ||
            k.includes("פלאפון") ||
            k.includes("phone") ||
            k.includes("נייד") ||
            k.includes("סלולרי") ||
            k.includes("פרוק")
          ) {
            lead.phone = value;
          }
          // Status fields
          else if (k.includes("סטטוס")) {
            lead.response_status = mapResponse(value);
            lead.general_status = value;
          } else if (k.includes("שלב")) {
            lead.status = mapStage(value);
          }
          // Numeric budgets / values
          else if (
            k.includes("שווייעסקה") ||
            k.includes("שוויםשוער") ||
            k.includes("שוי")
          ) {
            const n = parseFloat(value.replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(n)) lead.estimated_deal_value = n;
          } else if (k.includes("חדפ") || k.includes("חודשית")) {
            const n = parseFloat(value.replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(n)) lead.monthly_budget = n;
          } else if (k.includes("3חודש") || k.includes("שלושהחודש")) {
            const n = parseFloat(value.replace(/[^\d.-]/g, ""));
            if (!Number.isNaN(n)) lead.three_month_budget = n;
          }
          // Dates
          else if (k.includes("תאריך") && k.includes("הצעה")) {
            const d = new Date(value);
            if (!isNaN(d as any)) lead.proposal_date = d.toISOString().split("T")[0];
          } else if (
            k.includes("תאריך") &&
            (k.includes("מכירה") || k.includes("חתימה") || k.includes("סגירה"))
          ) {
            const d = new Date(value);
            if (!isNaN(d as any)) {
              const ds = d.toISOString().split("T")[0];
              lead.sale_date = ds;
              lead.closing_date = ds;
            }
          }
          // Products / source
          else if (k.includes("מוצרים") || k.includes("מוצר")) {
            lead.products = value;
          } else if (k.includes("מקור") || k.includes("הפניה") || k.includes("המלצה")) {
            // Free text source per user request
            lead.source = value;
          }
        });

        if (!lead.status) lead.status = "new";
        if (lead.proposal_date && lead.status === "new") lead.status = "proposal_sent";
        if (!lead.company_name && lead.contact_name) lead.company_name = lead.contact_name;

        // Force assignment per user request
        lead.agency_id = promoAgency.id;
        lead.sales_person_id = zivPerson.id;
        return lead;
      });

      const validLeads = mapped.filter((l) => {
        const name = (l.company_name || '').trim();
        const contact = (l.contact_name || '').trim();
        const email = (l.email || '').trim();
        const phone = (l.phone || '').trim();
        // Require at least one identifying/contact field
        if (!name && !contact && !email && !phone) return false;
        // Skip placeholder-only rows
        if ((name === 'לא צוין' || name === 'לא צויין') && !contact && !email && !phone) return false;
        return true;
      });
      const skipped = mapped.length - validLeads.length;
      if (validLeads.length === 0) {
        throw new Error("לא נמצאו לידים תקינים בקובץ");
      }

      const { error } = await supabase.from("leads").insert(validLeads);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "הצלחה!",
        description: `${validLeads.length} לידים יובאו והוקצו לסוכנות promo ולאיש מכירות זיו${skipped > 0 ? ` (דילגנו על ${skipped} שורות ריקות)` : ""}`,
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
              <li>פרוק / טלפון</li>
              <li>סטטוס (תגובה)</li>
              <li>שלב העסקה / שלב במשפך</li>
              <li>הערות / הצעות/הסכמים</li>
              <li>המעת חד"פ / הצעת חד"פ</li>
              <li>המעת 3 חודשים</li>
              <li>תאריך הצעה</li>
              <li>תאריך מכירה / תאריך חתימה</li>
              <li>מוצרים</li>
              <li>שיחה עם איתי (איש מכירות)</li>
              <li>המלצה / הפניה (מקור)</li>
              <li>ארגון קליינט לפי (תחום)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}