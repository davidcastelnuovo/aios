function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read report image"));
    reader.readAsDataURL(blob);
  });
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Failed to load report image"));
    image.src = dataUrl;
  });
}

export async function downloadReportPdf(image: Blob, filename: string): Promise<void> {
  const [{ jsPDF }, dataUrl] = await Promise.all([
    import("jspdf"),
    readBlobAsDataUrl(image),
  ]);
  const size = await getImageSize(dataUrl);
  if (!size.width || !size.height) throw new Error("Invalid report image");

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const renderedHeight = size.height * (contentWidth / size.width);
  const pageCount = Math.max(1, Math.ceil(renderedHeight / contentHeight));
  const format = image.type.includes("png") ? "PNG" : "JPEG";
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  for (let page = 0; page < pageCount; page += 1) {
    if (page > 0) pdf.addPage();
    pdf.addImage(
      dataUrl,
      format,
      margin,
      margin - page * contentHeight,
      contentWidth,
      renderedHeight,
      undefined,
      "FAST",
    );
  }

  pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
}
