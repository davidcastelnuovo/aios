import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface SendSignatureActionConfigProps {
  tenantId: string;
  configuration: Record<string, any>;
  onConfigChange: (key: string, value: any) => void;
}

export default function SendSignatureActionConfig({
  tenantId,
  configuration,
  onConfigChange,
}: SendSignatureActionConfigProps) {
  const { data: templates = [] } = useQuery({
    queryKey: ["signature-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("id, title, template_name, document_type")
        .eq("tenant_id", tenantId)
        .eq("is_template", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-right">
        <p className="text-xs text-blue-700">
          יוצר מסמך חתימה חדש מתבנית ושולח אותו במייל לליד/לקוח מהטריגר.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-right block">תבנית חתימה *</Label>
        <Select
          value={configuration?.template_document_id || ""}
          onValueChange={(v) => onConfigChange("template_document_id", v)}
        >
          <SelectTrigger className="text-right">
            <SelectValue placeholder="בחר תבנית..." />
          </SelectTrigger>
          <SelectContent>
            {templates.length === 0 ? (
              <SelectItem value="__none" disabled>אין תבניות — שמור מסמך כתבנית בחתימות דיגיטליות</SelectItem>
            ) : (
              templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.template_name || t.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-right block">שם החותם (שדה מהטריגר)</Label>
        <Input
          value={configuration?.recipient_name_field || "contact_name"}
          onChange={(e) => onConfigChange("recipient_name_field", e.target.value)}
          placeholder="contact_name"
          className="text-right font-mono text-sm"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">אימייל החותם (שדה מהטריגר)</Label>
        <Input
          value={configuration?.recipient_email_field || "email"}
          onChange={(e) => onConfigChange("recipient_email_field", e.target.value)}
          placeholder="email"
          className="text-right font-mono text-sm"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-right block">שם המסמך (אופציונלי)</Label>
        <Input
          value={configuration?.document_title_template || ""}
          onChange={(e) => onConfigChange("document_title_template", e.target.value)}
          placeholder="חוזה - {{company_name}}"
          className="text-right"
        />
      </div>
    </div>
  );
}
