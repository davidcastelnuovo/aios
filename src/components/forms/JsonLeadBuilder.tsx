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
import { getLeadJsonIntakeFields, LEAD_JSON_INTAKE_ALWAYS_SHOWN } from "@/lib/leadJsonFields";

export default function JsonLeadBuilder() {
  const { toast } = useToast();
  const { tenant } = useCurrentTenant();
  const [selectedFields, setSelectedFields] = useState<string[]>(["tenant_slug", "company_name"]);

  const baseFields = useMemo(
    () => getLeadJsonIntakeFields(tenant?.slug || ""),
    [tenant?.slug],
  );

  const { data: customFields } = useQuery({
    queryKey: ["custom-fields-leads", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from("custom_fields")
        .select("field_key, field_label, is_visible")
        .eq("tenant_id", tenant.id)
        .eq("entity_type", "lead");

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const customByKey = useMemo(() => {
    const map: Record<string, { label: string; visible: boolean }> = {};
    customFields?.forEach((cf) => {
      map[cf.field_key] = {
        label: cf.field_label,
        visible: cf.is_visible !== false,
      };
    });
    return map;
  }, [customFields]);

  const availableFields = useMemo(() => {
    return baseFields
      .filter((field) => {
        if (LEAD_JSON_INTAKE_ALWAYS_SHOWN.has(field.key) || field.required) return true;
        const override = customByKey[field.key];
        return override ? override.visible : true;
      })
      .map((field) => ({
        ...field,
        label: customByKey[field.key]?.label || field.label,
      }));
  }, [baseFields, customByKey]);

  const toggleField = (fieldKey: string) => {
    if (fieldKey === "tenant_slug") return;
    setSelectedFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey],
    );
  };

  const generateJson = () => {
    const json: Record<string, string> = {};

    selectedFields.forEach((fieldKey) => {
      const field = availableFields.find((f) => f.key === fieldKey);
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
          בחר את השדות שאתה רוצה לכלול ב-JSON שלך. התוויות מתעדכנות לפי ניהול השדות של הארגון.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableFields.map((field) => (
            <div key={field.key} className="flex items-start space-x-3 space-x-reverse">
              <Checkbox
                id={field.key}
                checked={selectedFields.includes(field.key)}
                onCheckedChange={() => toggleField(field.key)}
                disabled={field.key === "tenant_slug"}
              />
              <div className="grid gap-1.5 leading-none flex-1">
                <Label
                  htmlFor={field.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {field.required ? "חובה" : "אופציונלי"}
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
