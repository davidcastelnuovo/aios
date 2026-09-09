export type SignatureMediaKind = "pdf" | "image" | "other";

export function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export function detectMediaKind(
  url: string | null | undefined,
  hint?: SignatureMediaKind | null,
): SignatureMediaKind {
  if (hint === "pdf" || hint === "image" || hint === "other") return hint;
  if (!url) return "other";
  if (isPdfUrl(url)) return "pdf";
  if (isImageUrl(url)) return "image";
  // Signed storage URLs sometimes omit a clear extension after query rewriting
  if (/signature-documents/i.test(url) && !isImageUrl(url)) return "pdf";
  return "other";
}

export function mediaKindFromFile(file: File | null | undefined): SignatureMediaKind {
  if (!file) return "other";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp)$/i.test(file.name)) return "image";
  return "other";
}
