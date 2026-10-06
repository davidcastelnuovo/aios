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

/** Build a portrait PDF from the continuous report, one landing-page section per page. */
export async function createSeoMonthlyReportPdf(reportEl: HTMLElement): Promise<Blob> {
  const sections = Array.from(
    reportEl.querySelectorAll<HTMLElement>(".seo-report-section"),
  );
  if (sections.length === 0) throw new Error("No report sections to export");

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < sections.length; i++) {
    const node = sections[i];
    // Ensure fonts/layout are settled before capture
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: i % 2 === 0 ? "#f6f8f5" : "#ffffff",
      width: 1120,
      height: node.scrollHeight,
      style: {
        transform: "none",
        width: "1120px",
        height: `${node.scrollHeight}px`,
      },
    });

    // Convert data URL → keep as PNG for jsPDF
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const pngDataUrl = await readBlobAsDataUrl(blob);

    if (i > 0) pdf.addPage();
    const margin = 8;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2;
    const slideRatio = 1120 / node.scrollHeight;
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
    const sectionRect = node.getBoundingClientRect();
    if (sectionRect.width > 0 && sectionRect.height > 0) {
      const anchors = Array.from(node.querySelectorAll<HTMLAnchorElement>("a[href]"));
      for (const anchor of anchors) {
        const href = normalizeHref(anchor.getAttribute("href") || anchor.href);
        if (!href) continue;
        const rect = anchor.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) continue;
        const linkX = x + ((rect.left - sectionRect.left) / sectionRect.width) * w;
        const linkY = y + ((rect.top - sectionRect.top) / sectionRect.height) * h;
        const linkW = (rect.width / sectionRect.width) * w;
        const linkH = (rect.height / sectionRect.height) * h;
        pdf.link(linkX, linkY, linkW, linkH, { url: href });
      }
    }
  }

  return pdf.output("blob");
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const safe = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safe;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export async function downloadSeoMonthlySlideshowPdf(
  reportEl: HTMLElement,
  filename: string,
): Promise<void> {
  const blob = await createSeoMonthlyReportPdf(reportEl);
  downloadPdfBlob(blob, filename);
}
