import { useState } from "react";
import { Button } from "@/components/ui/button";
import SignatureFieldPlacer, { getRecipientColor } from "@/components/signatures/SignatureFieldPlacer";
import { type DocumentField } from "@/components/signatures/signatureFieldTypes";

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
        <SignatureFieldPlacer
          fileUrl={fileUrl}
          fullScreen
          recipients={recipients}
          fields={fields}
          onFieldsChange={setFields}
        />
      </div>
    </div>
  );
}
