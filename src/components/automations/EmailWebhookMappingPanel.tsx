import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Copy, Braces } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buildSampleWebhookJson,
  buildSampleWebhookJsonFromAvailableFields,
  collectEmailMappedFields,
  usageLabel,
} from "@/lib/emailWebhookMapping";

interface Props {
  configuration: Record<string, any>;
  availableFields: { key: string; label: string }[];
  triggerType?: string;
  automationId?: string;
}

export function EmailWebhookMappingPanel({
  configuration,
  availableFields,
  triggerType,
  automationId,
}: Props) {
  const { toast } = useToast();

  const mappedFields = useMemo(
    () => collectEmailMappedFields(configuration, availableFields),
    [configuration, availableFields],
  );

  const sampleJson = useMemo(
    () => JSON.stringify(buildSampleWebhookJson(mappedFields), null, 2),
    [mappedFields],
  );

  const webhookUrl =
    triggerType === "inbound_webhook_task" && automationId
      ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/automation-flow-webhook?automation_id=${automationId}`
      : null;

  const copy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "הועתק", description: label });
  };

  if (mappedFields.length === 0) {
    const allFieldsJson = JSON.stringify(
      buildSampleWebhookJsonFromAvailableFields(availableFields),
      null,
      2,
    );
    return (
      <div className="space-y-2 rounded-lg border border-dashed p-3">
        <p className="text-right text-xs text-muted-foreground">
          הוסף {'{{שדות}}'} לנושא / גוף / נמען — או השתמש בשדות הזמינים מהטריגר:
        </p>
        <pre dir="ltr" className="max-h-40 overflow-auto rounded-md border bg-background p-2 text-left text-[10px]">
          {allFieldsJson}
        </pre>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => copy(allFieldsJson, "JSON שדות הטריגר הועתק")}
        >
          <Copy className="ml-1 h-3 w-3" />
          העתק JSON שדות זמינים
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
      <div className="flex items-center gap-2">
        <Braces className="h-4 w-4 text-violet-700" />
        <p className="text-xs font-semibold text-violet-800">מיפוי JSON ל-webhook</p>
      </div>
      <p className="text-right text-[11px] text-muted-foreground">
        כל מפתח ב-JSON שתשלח ב-webhook זמין כ-<span dir="ltr">{'{{field_name}}'}</span> בנושא, בגוף ובנמענים.
        שם המפתח חייב להיות זהה.
      </p>

      <div className="overflow-hidden rounded-md border bg-background/80">
        <table className="w-full text-right text-[11px]">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 font-medium">שימוש בפלו</th>
              <th className="px-2 py-1 font-medium">בפלו</th>
              <th className="px-2 py-1 font-medium" dir="ltr">JSON key</th>
            </tr>
          </thead>
          <tbody>
            {mappedFields.map((field) => (
              <tr key={field.key} className="border-t">
                <td className="px-2 py-1 text-muted-foreground">{usageLabel(field.usedIn)}</td>
                <td className="px-2 py-1">{field.label}</td>
                <td className="px-2 py-1 font-mono" dir="ltr">{field.key}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-right text-xs">JSON לדוגמה לשליחה</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => copy(sampleJson, "JSON לדוגמה הועתק")}
          >
            <Copy className="ml-1 h-3 w-3" />
            העתק JSON
          </Button>
        </div>
        <pre dir="ltr" className="max-h-48 overflow-auto rounded-md border bg-background p-2 text-left text-[10px]">
          {sampleJson}
        </pre>
      </div>

      {webhookUrl && (
        <details className="rounded-md border bg-background/70 p-2">
          <summary className="cursor-pointer text-right text-xs font-medium">דוגמת curl</summary>
          <pre dir="ltr" className="mt-2 overflow-x-auto whitespace-pre-wrap text-left text-[10px]">
{`curl -X POST '${webhookUrl}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-webhook-secret: YOUR_SECRET' \\
  --data-binary @payload.json`}
          </pre>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            שמור את ה-JSON למעלה בקובץ payload.json ושלח.
          </p>
        </details>
      )}
    </div>
  );
}
