import { supabase } from "@/integrations/supabase/client";

type InsertPayload = Record<string, unknown>;

function stripKeys(payload: InsertPayload, keys: string[]): InsertPayload {
  const next = { ...payload };
  for (const key of keys) delete next[key];
  return next;
}

/** Insert signature_documents with graceful fallbacks for older DB schemas. */
export async function insertSignatureDocument(payload: InsertPayload): Promise<{ id: string }> {
  const wantsTemplate = payload.is_template === true;
  const attempts: InsertPayload[] = [payload];

  if ("document_fields" in payload) {
    attempts.push(stripKeys(payload, ["document_fields"]));
  }

  // Never strip template columns when the caller asked to save a template —
  // that used to succeed as a plain draft and toast "התבנית נשמרה" falsely.
  if (!wantsTemplate) {
    attempts.push(stripKeys(payload, ["document_fields", "is_template", "template_name", "lead_id", "client_id"]));
  } else {
    attempts.push(stripKeys(payload, ["document_fields", "lead_id", "client_id"]));
  }

  let lastError: { message: string } | null = null;
  const seen = new Set<string>();

  for (const attempt of attempts) {
    const key = JSON.stringify(attempt);
    if (seen.has(key)) continue;
    seen.add(key);

    const res = await supabase.from("signature_documents").insert(attempt).select("id").single();
    if (!res.error && res.data) {
      if (wantsTemplate && attempt.is_template !== true) {
        throw new Error("שמירת תבנית נכשלה — עמודת is_template חסרה ב־DB");
      }
      return res.data;
    }
    lastError = res.error;
    const msg = res.error?.message ?? "";
    const retryable =
      msg.includes("document_fields") ||
      msg.includes("is_template") ||
      msg.includes("template_name") ||
      msg.includes("lead_id") ||
      msg.includes("client_id");
    if (!retryable) break;
  }

  if (wantsTemplate && lastError?.message?.includes("is_template")) {
    throw new Error("שמירת תבנית נכשלה — חסרות עמודות תבנית ב־DB (is_template). יש להריץ migration.");
  }

  throw lastError ?? new Error("שמירת המסמך נכשלה");
}
