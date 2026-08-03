import { toPng } from "html-to-image";

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read slide image"));
    reader.readAsDataURL(blob);
  });
}

function normalizeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return null;
  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return null;
  }
}

/**
 * Capture each `.seo-monthly-slideshow` child of the stack and write a
 * landscape PDF (one slide per page). Anchor tags become clickable PDF links.
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

    // Map visible <a href> boxes onto the placed image so PDF links work.
    const slideRect = node.getBoundingClientRect();
    if (slideRect.width > 0 && slideRect.height > 0) {
      const anchors = Array.from(node.querySelectorAll<HTMLAnchorElement>("a[href]"));
      for (const anchor of anchors) {
        const href = normalizeHref(anchor.getAttribute("href") || anchor.href);
        if (!href) continue;
        const rect = anchor.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const linkX = x + ((rect.left - slideRect.left) / slideRect.width) * w;
        const linkY = y + ((rect.top - slideRect.top) / slideRect.height) * h;
        const linkW = (rect.width / slideRect.width) * w;
        const linkH = (rect.height / slideRect.height) * h;
        pdf.link(linkX, linkY, linkW, linkH, { url: href });
      }
    }
  }

  const safe = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  pdf.save(safe);
}
