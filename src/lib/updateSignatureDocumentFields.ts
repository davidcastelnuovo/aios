import { supabase } from "@/integrations/supabase/client";
import type { DocumentField } from "@/components/signatures/signatureFieldTypes";

export type UpdateFieldsResult = {
  savedDocumentFields: boolean;
  savedRecipientPosition: boolean;
};

/** Update signature_documents.document_fields with graceful fallback for older schemas. */
export async function updateSignatureDocumentFields(
  docId: string,
  fields: DocumentField[],
): Promise<UpdateFieldsResult> {
  const withFields = {
    document_fields: fields as unknown as import("@/integrations/supabase/types").Json,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("signature_documents")
    .update(withFields)
    .eq("id", docId);

  if (error?.message?.includes("document_fields")) {
    // Column missing — still try recipient signature_position so send/sign works
    const savedRecipientPosition = await syncSignatureRecipientPosition(docId, fields);
    if (!savedRecipientPosition) {
      throw new Error("עמודת שדות לא זמינה — יש להריץ migration על Staging");
    }
    return { savedDocumentFields: false, savedRecipientPosition: true };
  }

  if (error) throw error;

  const savedRecipientPosition = await syncSignatureRecipientPosition(docId, fields);
  return { savedDocumentFields: true, savedRecipientPosition };
}

/** Best-effort sync of signature field position onto existing recipients. */
export async function syncSignatureRecipientPosition(
  docId: string,
  fields: DocumentField[],
): Promise<boolean> {
  const sigField = fields.find((f) => f.type === "signature" || f.type === "signature_stamp");
  if (!sigField) return false;

  const { error } = await supabase
    .from("signature_recipients")
    .update({ signature_position: sigField.position as unknown as Record<string, unknown> })
    .eq("document_id", docId);

  if (error?.message?.includes("signature_position")) return false;
  if (error) throw error;
  return true;
}
