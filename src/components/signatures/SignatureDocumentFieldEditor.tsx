import { useState } from "react";
import { Button } from "@/components/ui/button";
import SignatureFieldPlacer, { getRecipientColor } from "@/components/signatures/SignatureFieldPlacer";
import { type DocumentField } from "@/components/signatures/signatureFieldTypes";
import { useSignatureDocumentUrl } from "@/hooks/useSignatureDocumentUrl";

interface SignatureDocumentFieldEditorProps {
  title: string;
  fileUrl: string;
  initialFields: DocumentField[];
  saving?: boolean;
  onSave: (fields: DocumentField[]) => void | Promise<void>;
  onClose: () => void;
}

export function SignatureDocumentFieldEditor({
  title,
  fileUrl,
  initialFields,
  saving,
  onSave,
  onClose,
}: SignatureDocumentFieldEditorProps) {
  const [fields, setFields] = useState<DocumentField[]>(initialFields);
  const { resolvedUrl, loading, error } = useSignatureDocumentUrl(fileUrl);

  const recipients = [{ index: 0, name: "חותם", color: getRecipientColor(0) }];

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border bg-background">
        <div>
          <h2 className="text-lg font-bold text-foreground">עריכת שדות — {title}</h2>
          <p className="text-sm text-muted-foreground">הוסף, הסר, הזז והגדל שדות על המסמך</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
          <Button onClick={() => onSave(fields)} disabled={saving}>
            {saving ? "שומר..." : "שמור שדות"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <p className="text-center text-muted-foreground py-12">טוען מסמך...</p>
        )}
        {error && !loading && (
          <div className="text-center py-12 space-y-2">
            <p className="text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">נסה להעלות את המסמך מחדש</p>
          </div>
        )}
        {resolvedUrl && !loading && (
          <SignatureFieldPlacer
            fileUrl={resolvedUrl}
            fullScreen
            recipients={recipients}
            fields={fields}
            onFieldsChange={setFields}
          />
        )}
      </div>
    </div>
  );
}
