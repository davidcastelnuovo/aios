import { toPng } from "html-to-image";

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read slide image"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Capture each `.seo-monthly-slideshow` child of the stack and write a
 * landscape PDF (one slide per page).
 */
export async function downloadSeoMonthlySlideshowPdf(
  stackEl: HTMLElement,
  filename: string,
): Promise<void> {
  const slides = Array.from(
    stackEl.querySelectorAll<HTMLElement>(".seo-monthly-slideshow"),
  );
  if (slides.length === 0) throw new Error("No slides to export");

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < slides.length; i++) {
    const node = slides[i];
    // Ensure fonts/layout are settled before capture
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#071820",
      width: 1280,
      height: 720,
      style: {
        transform: "none",
        width: "1280px",
        height: "720px",
      },
    });

    // Convert data URL → keep as PNG for jsPDF
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const pngDataUrl = await readBlobAsDataUrl(blob);

    if (i > 0) pdf.addPage();
    // Fit 16:9 slide into landscape A4 with small margins
    const margin = 6;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const slideRatio = 1280 / 720;
    let w = maxW;
    let h = w / slideRatio;
    if (h > maxH) {
      h = maxH;
      w = h * slideRatio;
    }
    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;
    pdf.addImage(pngDataUrl, "PNG", x, y, w, h, undefined, "FAST");
  }

  const safe = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  pdf.save(safe);
}
