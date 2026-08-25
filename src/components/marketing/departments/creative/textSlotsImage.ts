import { resolveCreativeImageUrl } from "@/components/marketing/lib/resolveCreativeImageUrl";
import type { PixelBuffer } from "./textSlots";

const ANALYSIS_SIZE = 96;

export async function loadImagePixels(url: string): Promise<PixelBuffer | null> {
  const resolved = await resolveCreativeImageUrl(url);
  if (!resolved || typeof document === "undefined") return null;
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = ANALYSIS_SIZE;
        canvas.height = ANALYSIS_SIZE;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(image, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        const { data, width, height } = ctx.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
        resolve({ data, width, height });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = resolved;
  });
}
