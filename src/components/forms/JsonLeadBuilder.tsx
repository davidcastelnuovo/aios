import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Field {
  key: string;
  label: string;
  exampleValue: string;
}

// Base fields with default labels
const baseFields: Field[] = [
  { key: "tenant_slug", label: "🔑 מזהה ארגון (חובה)", exampleValue: "your-tenant-slug" },
  { key: "company_name", label: "שם החברה", exampleValue: "שם החברה" },
  { key: "contact_name", label: "שם איש קשר", exampleValue: "שם איש הקשר" },
  { key: "email", label: "אימייל", exampleValue: "email@example.com" },
  { key: "phone", label: "מספר טלפון", exampleValue: "050-1234567" },
  { key: "source", label: "מקור הליד", exampleValue: "website" },
  { key: "notes", label: "הערות", exampleValue: "הערות נוספות" },
  { key: "monthly_budget", label: "תקציב חודשי", exampleValue: "5000" },
  { key: "three_month_budget", label: "תקציב ל-3 חודשים", exampleValue: "15000" },
  { key: "products", label: "מוצרים מעניינים", exampleValue: "קמפיין פייסבוק, גוגל" },
  { key: "industry", label: "תעשייה", exampleValue: "טכנולוגיה" },
  { key: "agency_id", label: "ID של סוכנות (אם לא תספק - ישתמש בסוכנות ברירת מחדל)", exampleValue: "uuid-של-סוכנות" },
  { key: "manychat_subscriber_id", label: "ManyChat Subscriber ID", exampleValue: "123456789" },
  { key: "tag_name", label: "שם תגית (יצירה אוטומטית)", exampleValue: "ליד מהאתר" },
];

export default function JsonLeadBuilder() {
  const { toast } = useToast();
  const { tenant } = useCurrentTenant();
  const [selectedFields, setSelectedFields] = useState<string[]>(["tenant_slug", "company_name"]);

  // Fetch custom field labels for leads
  const { data: customFields } = useQuery({
    queryKey: ['custom-fields-leads', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('custom_fields')
        .select('field_key, field_label')
        .eq('tenant_id', tenant.id)
        .eq('entity_type', 'lead');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Create a map of custom labels
  const customLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    customFields?.forEach(cf => {
      map[cf.field_key] = cf.field_label;
    });
    return map;
  }, [customFields]);

  // Apply custom labels to base fields
  const availableFields = useMemo(() => {
    return baseFields.map(field => ({
      ...field,
      label: customLabelsMap[field.key] || field.label,
    }));
  }, [customLabelsMap]);

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev =>
      prev.includes(fieldKey)
        ? prev.filter(k => k !== fieldKey)
        : [...prev, fieldKey]
    );
  };

  const generateJson = () => {
    const json: Record<string, any> = {};
    
    selectedFields.forEach(fieldKey => {
      const field = availableFields.find(f => f.key === fieldKey);
      if (field) {
        json[fieldKey] = field.exampleValue;
      }
    });

    return JSON.stringify(json, null, 2);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateJson());
    toast({
      title: "הועתק ללוח",
      description: "JSON הועתק בהצלחה",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>בונה JSON מותאם אישית</CardTitle>
        <CardDescription>
          בחר את השדות שאתה רוצה לכלול ב-JSON שלך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableFields.map(field => (
            <div key={field.key} className="flex items-start space-x-3 space-x-reverse">
              <Checkbox
                id={field.key}
                checked={selectedFields.includes(field.key)}
                onCheckedChange={() => toggleField(field.key)}
              />
              <div className="grid gap-1.5 leading-none flex-1">
                <Label
                  htmlFor={field.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  אופציונלי
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>ה-JSON שנוצר:</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
            >
              <Copy className="h-4 w-4 ml-2" />
              העתק
            </Button>
          </div>
          <pre className="relative rounded bg-muted p-4 font-mono text-sm overflow-x-auto">
            {generateJson()}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
