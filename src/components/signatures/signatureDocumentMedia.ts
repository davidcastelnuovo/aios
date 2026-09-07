export function isImageUrl(url: string): boolean {
  return /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url);
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}
