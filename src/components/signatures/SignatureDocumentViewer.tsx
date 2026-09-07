import { forwardRef, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import { isImageUrl, isPdfUrl } from "./signatureDocumentMedia";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface SignatureDocumentViewerProps {
  fileUrl: string | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
  onHeightChange?: (height: number) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

export const SignatureDocumentViewer = forwardRef<HTMLDivElement, SignatureDocumentViewerProps>(
function SignatureDocumentViewer({
  fileUrl,
  loading,
  error,
  className = "",
  onHeightChange,
  onPointerDown,
  onPointerUp,
  children,
}, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = (node: HTMLDivElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    const el = internalRef.current;
    if (!el || !onHeightChange) return;
    const update = () => onHeightChange(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, fileUrl, rendering]);

  useEffect(() => {
    if (!fileUrl || !isPdfUrl(fileUrl)) return;

    let cancelled = false;
    setRendering(true);
    setRenderError(null);

    (async () => {
      try {
        const pdf = await pdfjs.getDocument(fileUrl).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = internalRef.current?.clientWidth || viewport.width;
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;
        canvas.style.width = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";

        await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "שגיאה בטעינת PDF");
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">טוען מסמך...</p>;
  }

  if (error) {
    return <p className="text-center text-destructive py-12">{error}</p>;
  }

  if (!fileUrl) {
    return <p className="text-center text-destructive py-12">לא ניתן לטעון את המסמך</p>;
  }

  const showPdf = isPdfUrl(fileUrl);
  const showImage = isImageUrl(fileUrl);

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {showPdf ? (
        <>
          {(rendering || renderError) && (
            <p className="text-center text-muted-foreground py-8">
              {renderError || "מעבד PDF..."}
            </p>
          )}
          <canvas ref={canvasRef} className="w-full h-auto block rounded" />
        </>
      ) : showImage ? (
        <img src={fileUrl} alt="Document" className="w-full h-auto block rounded" draggable={false} />
      ) : (
        <iframe
          src={fileUrl}
          className="w-full border-0 rounded block"
          style={{ height: "min(1200px, 150vh)" }}
          title="Document"
        />
      )}
      {children}
    </div>
  );
});
