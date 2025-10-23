import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileSpreadsheet } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      // Parse CSV rows
      const leads = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const lead: any = {};

        headers.forEach((header, index) => {
          const value = values[index] || null;
          
          // Map CSV headers to database columns
          switch (header) {
            case 'שם':
              lead.contact_name = value;
              break;
            case 'שם העסק':
            case 'שם החברה':
              lead.company_name = value;
              break;
            case 'מייל':
            case 'אימייל':
              lead.email = value;
              break;
            case 'פרוק':
            case 'טלפון':
              lead.phone = value;
              break;
            case 'סטטוס':
              // Map to response status
              const responseStatusMap: Record<string, string> = {
                'ללא מענה 1': 'no_answer_1',
                'אין מענה 1': 'no_answer_1',
                'ללא מענה 2': 'no_answer_2',
                'אין מענה 2': 'no_answer_2',
                'ללא מענה 3': 'no_answer_3',
                'אין מענה 3': 'no_answer_3',
                'ללא מענה 4': 'no_answer_4',
                'אין מענה 4': 'no_answer_4',
                'מכחיש פניה': 'denies_contact',
                'לא רלוונטי': 'not_relevant',
              };
              lead.response_status = responseStatusMap[value] || null;
              // Keep general_status for backward compatibility
              lead.general_status = value;
              break;
            case 'שלב העסקה':
            case 'שלב במשפך':
            case 'שלב':
              // Map to pipeline stage
              const stageMap: Record<string, string> = {
                'ליד חדש': 'new',
                'נוצר קשר': 'contacted',
                'פולואפ': 'follow_up',
                'follow_up': 'follow_up',
                'תהליך פולואפ': 'follow_up',
                'הצעה': 'proposal_sent',
                'נשלחה הצעה': 'proposal_sent',
                'נסגר': 'closed',
              };
              lead.status = stageMap[value] || 'new';
              break;
            case 'הערות/הסכמים/פרטים':
            case 'הצעות/הסכמים':
            case 'פרטים':
            case 'הערות':
              lead.notes = value;
              break;
            case 'תחום':
            case 'תחום עיסוק':
            case 'ארגון קליינט לפי':
              lead.industry = value;
              break;
            case 'שווי משוער העסקה':
            case 'שווי עסקה':
              lead.estimated_deal_value = value ? parseFloat(value.replace(/[^\d.-]/g, '')) : null;
              break;
            case 'המעת חד"פ':
            case 'הצעת חד"פ':
            case 'הצעת חודשית':
              lead.monthly_budget = value ? parseFloat(value.replace(/[^\d.-]/g, '')) : null;
              break;
            case 'המעת 3 חודשים':
            case 'הצעת 3 חודשים':
            case 'הצעת 3 חודשית':
              lead.three_month_budget = value ? parseFloat(value.replace(/[^\d.-]/g, '')) : null;
              break;
            case 'תאריך הצעה':
              lead.proposal_date = value ? new Date(value).toISOString().split('T')[0] : null;
              break;
            case 'תאריך מכירה':
            case 'תאריך חתימה':
            case 'תאריך סגירה':
              lead.sale_date = value ? new Date(value).toISOString().split('T')[0] : null;
              lead.closing_date = value ? new Date(value).toISOString().split('T')[0] : null;
              break;
            case 'מוצרים':
              lead.products = value;
              break;
            case 'המלצה':
            case 'הפניה':
            case 'מקור':
            case 'מקורות':
              // Map source
              const sourceMap: Record<string, string> = {
                'אתר': 'website',
                'הפניה': 'referral',
                'המלצה': 'referral',
                'פייסבוק': 'social_media',
                'גוגל': 'paid_ads',
                'אחר': 'other',
              };
              lead.source = sourceMap[value] || 'other';
              break;
            case 'שיחה עם איתי':
            case 'איש מכירות':
              // Store the sales person name, will need to map it later
              lead.sales_person_name = value;
              break;
          }
        });

        // Set default status if not provided
        if (!lead.status) {
          lead.status = 'new';
        }

        // If there's a proposal date, set status to proposal_sent
        if (lead.proposal_date && lead.status === 'new') {
          lead.status = 'proposal_sent';
        }

        // Ensure company_name exists
        if (!lead.company_name) {
          lead.company_name = lead.contact_name || 'לא צוין';
        }

        return lead;
      });

      // Filter out invalid leads
      const validLeads = leads.filter(lead => lead.company_name);

      if (validLeads.length === 0) {
        toast({
          title: "שגיאה",
          description: "לא נמצאו לידים תקינים בקובץ",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Insert leads
      const { error } = await supabase.from("leads").insert(validLeads);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["leads"] });

      toast({
        title: "הצלחה!",
        description: `${validLeads.length} לידים יובאו בהצלחה`,
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