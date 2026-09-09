import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function usePdfDocument(fileUrl: string | null | undefined, enabled = true) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !fileUrl) {
      setPdf(null);
      setNumPages(1);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const doc = await pdfjs.getDocument({ url: fileUrl, withCredentials: false }).promise;
        if (cancelled || requestId !== requestIdRef.current) {
          doc.destroy().catch(() => undefined);
          return;
        }
        loaded = doc;
        setPdf(doc);
        setNumPages(Math.max(1, doc.numPages || 1));
      } catch (err) {
        if (!cancelled && requestId === requestIdRef.current) {
          setPdf(null);
          setNumPages(1);
          setError(err instanceof Error ? err.message : "שגיאה בטעינת PDF");
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy().catch(() => undefined);
    };
  }, [fileUrl, enabled]);

  return { pdf, numPages, loading, error };
}

export async function renderPdfPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetWidth: number,
): Promise<{ width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const unscaled = page.getViewport({ scale: 1 });
  const scale = Math.max(0.1, targetWidth / unscaled.width);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no_canvas_context");

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${canvas.width}px`;
  canvas.style.height = "auto";
  canvas.style.maxWidth = "100%";
  canvas.style.display = "block";

  await page.render({ canvasContext: context, viewport }).promise;
  return { width: canvas.width, height: canvas.height };
}
