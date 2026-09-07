import { forwardRef, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import {
  detectMediaKind,
  type SignatureMediaKind,
} from "./signatureDocumentMedia";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface SignatureDocumentViewerProps {
  fileUrl: string | null;
  mediaKind?: SignatureMediaKind | null;
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
  mediaKind,
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
  const [pdfReady, setPdfReady] = useState(false);
  const kind = detectMediaKind(fileUrl, mediaKind);

  useEffect(() => {
    const el = internalRef.current;
    if (!el || !onHeightChange) return;
    const update = () => onHeightChange(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, fileUrl, pdfReady, kind]);

  useEffect(() => {
    if (!fileUrl || kind !== "pdf") {
      setPdfReady(false);
      return;
    }

    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    setPdfReady(false);

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
        if (!cancelled) {
          setPdfReady(true);
          if (onHeightChange && internalRef.current) {
            onHeightChange(internalRef.current.getBoundingClientRect().height);
          }
        }
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
  }, [fileUrl, kind, onHeightChange]);

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">טוען מסמך...</p>;
  }

  if (error) {
    return <p className="text-center text-destructive py-12">{error}</p>;
  }

  if (!fileUrl) {
    return <p className="text-center text-destructive py-12">לא ניתן לטעון את המסמך</p>;
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {kind === "pdf" ? (
        <>
          <canvas
            ref={canvasRef}
            className="w-full h-auto block rounded"
            style={{ visibility: pdfReady ? "visible" : "hidden", minHeight: rendering ? 400 : undefined }}
          />
          {(rendering || renderError) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 pointer-events-none z-[5]">
              <p className="text-muted-foreground text-sm">{renderError || "מעבד PDF..."}</p>
            </div>
          )}
        </>
      ) : kind === "image" ? (
        <img src={fileUrl} alt="Document" className="w-full h-auto block rounded" draggable={false} />
      ) : (
        <iframe
          src={fileUrl}
          className="w-full border-0 rounded block"
          style={{ height: "min(1200px, 150vh)" }}
          title="Document"
        />
      )}
      {/* Overlay fields only after PDF page metrics are stable */}
      {(kind !== "pdf" || pdfReady) && children}
    </div>
  );
});
