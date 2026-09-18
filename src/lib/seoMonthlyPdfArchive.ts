import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/components/forms/AttachmentsField";
import { buildSeoMonthlyPdfArchivePath } from "@/lib/seoMonthlyPdfPath";

function parseAttachments(value: unknown): Attachment[] {
  if (Array.isArray(value)) return value as Attachment[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Store the latest generated report in the client's internal files list. */
export async function archiveSeoMonthlyPdf(input: {
  blob: Blob;
  tenantId: string;
  clientId: string;
  month: string;
  monthLabel: string;
}): Promise<void> {
  const path = buildSeoMonthlyPdfArchivePath(input);
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("attachments")
    .eq("id", input.clientId)
    .maybeSingle();
  if (clientError) throw clientError;
  if (!client) throw new Error("Client not found");

  // The bucket has INSERT/DELETE policies rather than UPDATE, so replace explicitly.
  await supabase.storage.from("entity-attachments").remove([path]);
  const { error: uploadError } = await supabase.storage
    .from("entity-attachments")
    .upload(path, input.blob, { contentType: "application/pdf" });
  if (uploadError) throw uploadError;

  const existing = parseAttachments(client.attachments);
  const attachment: Attachment = {
    name: `דוח SEO - ${input.monthLabel}.pdf`,
    path,
    size: input.blob.size,
    type: "application/pdf",
    uploaded_at: new Date().toISOString(),
  };
  const attachments = [...existing.filter((item) => item.path !== path), attachment];
  const { error: updateError } = await supabase
    .from("clients")
    .update({ attachments: attachments as never })
    .eq("id", input.clientId);
  if (updateError) throw updateError;
}
