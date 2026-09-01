import { supabase } from "@/integrations/supabase/client";

export type CommandCenterAttachment = {
  name: string;
  url: string;
  type: "image" | "file";
  size?: number;
  path?: string;
};

const BUCKET = "command-center-files";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES = 6;
const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.webp,.png,.jpg,.jpeg,.gif";

export const COMMAND_CENTER_FILE_ACCEPT = ACCEPT;
export const COMMAND_CENTER_MAX_FILES = MAX_FILES;

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}

export function formatAttachmentsForPrompt(
  attachments: CommandCenterAttachment[],
  userText?: string,
): string {
  const lines = attachments.map((a) => {
    const label = a.type === "image" ? "תמונה" : "קובץ";
    return `- ${label}: ${a.name} → ${a.url}`;
  });
  const body = lines.join("\n");
  const prefix = userText?.trim() ? `${userText.trim()}\n\n` : "";
  return `${prefix}📎 קבצים מצורפים (${attachments.length}):\n${body}`;
}

export async function uploadCommandCenterAttachments(
  files: FileList | File[],
  userId: string,
): Promise<CommandCenterAttachment[]> {
  const list = Array.from(files).slice(0, MAX_FILES);
  const out: CommandCenterAttachment[] = [];

  for (const file of list) {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`הקובץ ${file.name} גדול מ-15MB`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    if (urlError || !urlData?.signedUrl) {
      throw urlError ?? new Error("Failed to sign attachment URL");
    }

    out.push({
      name: file.name,
      url: urlData.signedUrl,
      type: isImageFile(file) ? "image" : "file",
      size: file.size,
      path,
    });
  }

  return out;
}
