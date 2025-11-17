import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Field {
  key: string;
  label: string;
  description: string;
  required: boolean;
  exampleValue: string;
}

const availableFields: Field[] = [
  { key: "company_name", label: "שם החברה", description: "חובה", required: true, exampleValue: "שם החברה" },
  { key: "contact_name", label: "שם איש קשר", description: "אופציונלי", required: false, exampleValue: "שם איש הקשר" },
  { key: "email", label: "אימייל", description: "אופציונלי", required: false, exampleValue: "email@example.com" },
  { key: "phone", label: "מספר טלפון", description: "אופציונלי", required: false, exampleValue: "050-1234567" },
  { key: "source", label: "מקור הליד", description: "(website/referral/linkedin/facebook/other)", required: false, exampleValue: "website" },
  { key: "notes", label: "הערות", description: "אופציונלי", required: false, exampleValue: "הערות נוספות" },
  { key: "monthly_budget", label: "תקציב חודשי", description: "אופציונלי", required: false, exampleValue: "5000" },
  { key: "three_month_budget", label: "תקציב ל-3 חודשים", description: "אופציונלי", required: false, exampleValue: "15000" },
  { key: "products", label: "מוצרים מעניינים", description: "אופציונלי", required: false, exampleValue: "קמפיין פייסבוק, גוגל" },
  { key: "industry", label: "תעשייה", description: "אופציונלי", required: false, exampleValue: "טכנולוגיה" },
  { key: "agency_id", label: "ID של סוכנות", description: "אופציונלי", required: false, exampleValue: "uuid-של-סוכנות" },
  { key: "manychat_subscriber_id", label: "ManyChat Subscriber ID", description: "אופציונלי", required: false, exampleValue: "123456789" },
];

export default function JsonLeadBuilder() {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<string[]>(["company_name"]);

  const toggleField = (fieldKey: string) => {
    if (fieldKey === "company_name") return; // Can't uncheck required field
    
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
                disabled={field.required}
              />
              <div className="grid gap-1.5 leading-none flex-1">
                <Label
                  htmlFor={field.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.label}
                  {field.required && <span className="text-destructive mr-1">*</span>}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {field.description}
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
