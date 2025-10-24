import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";

export function UpdateLeadsCompanyName() {
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
      const parsed = Papa.parse<any>(text, { header: true, skipEmptyLines: true });
      const rows = (parsed.data || []) as any[];

      if (rows.length === 0) {
        throw new Error("לא נמצאו נתונים בקובץ");
      }

      const normalize = (s: string | null | undefined) =>
        (s || "")
          .toString()
          .replace(/\*/g, "")
          .replace(/[\s_\-\/=\\()\[\]"'.,]/g, "")
          .toLowerCase();

      // מיפוי נתוני CSV
      const mapped = rows.map((row) => {
        const data: any = {};
        Object.entries(row).forEach(([key, raw]) => {
          const value = (raw as string)?.toString().trim();
          if (!value) return;
          const k = normalize(key);
          const rawKey = (key as string)?.toString().trim();

          // שם עסק
          if (
            rawKey === "שם העסק" ||
            k.includes("שמהעסק") ||
            k.includes("שםהחברה") ||
            k.includes("שחברה") ||
            k.includes("שםעסק") ||
            k.includes("שםלקוח") ||
            k.includes("עסק") ||
            k.includes("חברה")
          ) {
            data.company_name = value;
          }
          // מזהים לחיפוש
          else if (
            k.includes("מייל") ||
            k.includes("אימייל") ||
            k.includes("email") ||
            k.includes("דואל")
          ) {
            data.email = value;
          } else if (
            k.includes("טלפון") ||
            k.includes("טל") ||
            k.includes("פלאפון") ||
            k.includes("phone") ||
            k.includes("נייד") ||
            k.includes("פרוק")
          ) {
            data.phone = value;
          } else if (
            k === "שם" ||
            k.includes("שםמלא") ||
            k.includes("שמקשר") ||
            k.includes("אישקשר")
          ) {
            data.contact_name = value;
          }
        });
        return data;
      });

      // סינון - רק שורות עם שם עסק ומזהה (אימייל או טלפון)
      const validRows = mapped.filter(
        (row) => row.company_name && (row.email || row.phone)
      );

      if (validRows.length === 0) {
        throw new Error("לא נמצאו שורות עם שם עסק ומזהה (אימייל/טלפון)");
      }

      // עדכון כל ליד לפי אימייל או טלפון
      let updated = 0;
      let notFound = 0;

      for (const row of validRows) {
        let query = supabase.from("leads").select("id, company_name");

        if (row.email) {
          query = query.eq("email", row.email);
        } else if (row.phone) {
          query = query.eq("phone", row.phone);
        } else {
          continue;
        }

        const { data: existingLeads, error: fetchError } = await query;

        if (fetchError) {
          console.error("Error fetching lead:", fetchError);
          continue;
        }

        if (existingLeads && existingLeads.length > 0) {
          // עדכון רק אם שם העסק שונה
          for (const lead of existingLeads) {
            if (lead.company_name !== row.company_name) {
              const { error: updateError } = await supabase
                .from("leads")
                .update({ company_name: row.company_name })
                .eq("id", lead.id);

              if (updateError) {
                console.error("Error updating lead:", updateError);
              } else {
                updated++;
              }
            }
          }
        } else {
          notFound++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });

      toast({
        title: "עדכון הושלם",
        description: `עודכנו ${updated} לידים. ${notFound} לא נמצאו במערכת.`,
      });

      setOpen(false);
    } catch (error: any) {
      console.error("Error updating leads:", error);
      toast({
        title: "שגיאה בעדכון",
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
          <RefreshCw className="h-4 w-4" />
          עדכון שמות עסקים
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עדכון שמות עסקים מ-CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                בחר קובץ CSV לעדכון שמות עסקים
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                המערכת תעדכן רק לידים קיימים לפי אימייל או טלפון
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-update"
                disabled={isLoading}
              />
              <label htmlFor="csv-update">
                <Button asChild disabled={isLoading}>
                  <span className="cursor-pointer">
                    {isLoading ? "מעדכן..." : "בחר קובץ"}
                  </span>
                </Button>
              </label>
            </div>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">שדות נדרשים בקובץ:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>שם העסק (חובה)</li>
              <li>אימייל או טלפון (למזהה, חובה)</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
