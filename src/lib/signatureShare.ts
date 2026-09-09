export function toWhatsAppPhone(phone: string | null | undefined): string | null {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.length >= 9) return digits;
  return null;
}

export function buildSignatureWhatsAppMessage(opts: {
  signingUrl: string;
  recipientName?: string;
  documentTitle?: string;
}): string {
  const greeting = opts.recipientName ? `שלום ${opts.recipientName},\n` : "";
  const docLine = opts.documentTitle
    ? `נשלח לך קישור לחתימה על המסמך "${opts.documentTitle}":\n`
    : "נשלח לך קישור לחתימה על מסמך:\n";
  return `${greeting}${docLine}${opts.signingUrl}`;
}

export function buildWhatsAppSignUrl(opts: {
  phone: string | null | undefined;
  signingUrl: string;
  recipientName?: string;
  documentTitle?: string;
}): string | null {
  const waPhone = toWhatsAppPhone(opts.phone);
  if (!waPhone) return null;
  const text = buildSignatureWhatsAppMessage(opts);
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

export async function copySigningUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url);
}
