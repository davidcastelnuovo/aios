import { supabase } from "@/integrations/supabase/client";
import type { DocumentField } from "@/components/signatures/signatureFieldTypes";

/** Update signature_documents.document_fields with graceful fallback for older schemas. */
export async function updateSignatureDocumentFields(
  docId: string,
  fields: DocumentField[],
): Promise<void> {
  const withFields = {
    document_fields: fields as unknown as import("@/integrations/supabase/types").Json,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase
    .from("signature_documents")
    .update(withFields)
    .eq("id", docId);

  if (error?.message?.includes("document_fields")) {
    throw new Error("עמודת שדות לא זמינה — יש להריץ migration");
  }

  if (error) throw error;
}

/** Best-effort sync of signature field position onto existing recipients. */
export async function syncSignatureRecipientPosition(
  docId: string,
  fields: DocumentField[],
): Promise<void> {
  const sigField = fields.find((f) => f.type === "signature");
  if (!sigField) return;

  const { error } = await supabase
    .from("signature_recipients")
    .update({ signature_position: sigField.position as unknown as Record<string, unknown> })
    .eq("document_id", docId);

  if (error?.message?.includes("signature_position")) return;
  if (error) throw error;
}
