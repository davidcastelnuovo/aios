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

export async function copySigningUrl(url: string | Promise<string>): Promise<void> {
  // Safari requires the clipboard call itself to happen inside the click gesture.
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/plain": Promise.resolve(url).then((text) => new Blob([text], { type: "text/plain" })),
      })]);
      return;
    } catch { /* Try the compatible text API, then a selectable textarea. */ }
  }
  const text = await url;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;opacity:0";
    const focused = document.activeElement as HTMLElement | null;
    (focused?.closest('[role="dialog"]') || document.body).appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    focused?.focus();
    if (!copied) throw new Error("לא ניתן להעתיק אוטומטית");
  }
}
