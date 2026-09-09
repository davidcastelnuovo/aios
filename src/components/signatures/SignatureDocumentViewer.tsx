import { forwardRef, useEffect, useRef, useState } from "react";
import {
  detectMediaKind,
  type SignatureMediaKind,
} from "./signatureDocumentMedia";
import { renderPdfPageToCanvas, usePdfDocument } from "./usePdfDocument";

interface SignatureDocumentViewerProps {
  fileUrl: string | null;
  mediaKind?: SignatureMediaKind | null;
  /** Prefer PDF rendering even when URL has no .pdf suffix (e.g. signed URLs). */
  forcePdf?: boolean;
  /** 1-based page index for PDFs. */
  page?: number;
  loading?: boolean;
  error?: string | null;
  className?: string;
  onHeightChange?: (height: number) => void;
  onNumPagesChange?: (numPages: number) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

/**
 * Renders a document page and overlays children inside the exact page box.
 * Field % coordinates are relative to this page box (forwarded ref).
 */
export const SignatureDocumentViewer = forwardRef<HTMLDivElement, SignatureDocumentViewerProps>(
function SignatureDocumentViewer({
  fileUrl,
  mediaKind,
  forcePdf,
  page = 1,
  loading,
  error,
  className = "",
  onHeightChange,
  onNumPagesChange,
  onPointerDown,
  onPointerUp,
  children,
}, ref) {
  const pageStageRef = useRef<HTMLDivElement>(null);
  const setPageStageRef = (node: HTMLDivElement | null) => {
    pageStageRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  const kind = forcePdf ? "pdf" : detectMediaKind(fileUrl, mediaKind);
  const { pdf, numPages, loading: pdfLoading, error: pdfError } = usePdfDocument(
    fileUrl,
    kind === "pdf",
  );

  useEffect(() => {
    onNumPagesChange?.(kind === "pdf" ? numPages : 1);
  }, [kind, numPages, onNumPagesChange]);

  useEffect(() => {
    const el = pageStageRef.current;
    if (!el || !onHeightChange) return;
    const update = () => onHeightChange(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, fileUrl, pdfReady, kind, page]);

  useEffect(() => {
    if (!fileUrl || kind !== "pdf" || !pdf) {
      setPdfReady(kind === "image");
      return;
    }

    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    setPdfReady(false);

    (async () => {
      try {
        const canvas = canvasRef.current;
        const stage = pageStageRef.current;
        if (!canvas || cancelled) return;

        const parentWidth =
          stage?.clientWidth ||
          stage?.parentElement?.clientWidth ||
          800;
        const safePage = Math.min(Math.max(1, page), pdf.numPages || 1);
        await renderPdfPageToCanvas(pdf, safePage, canvas, parentWidth);
        if (cancelled) return;

        setPdfReady(true);
        if (onHeightChange && pageStageRef.current) {
          onHeightChange(pageStageRef.current.getBoundingClientRect().height);
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
  }, [fileUrl, kind, pdf, page, onHeightChange]);

  if (loading || (kind === "pdf" && pdfLoading && !pdf)) {
    return <p className="text-center text-muted-foreground py-12">טוען מסמך...</p>;
  }

  if (error || pdfError) {
    return <p className="text-center text-destructive py-12">{error || pdfError}</p>;
  }

  if (!fileUrl) {
    return <p className="text-center text-destructive py-12">לא ניתן לטעון את המסמך</p>;
  }

  const showOverlays = kind === "image" || (kind === "pdf" && pdfReady);

  return (
    <div
      className={`w-full max-w-full overflow-hidden ${className}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div
        ref={setPageStageRef}
        data-sig-page-stage
        data-sig-page={page}
        className="relative w-full mx-auto leading-none"
      >
        {kind === "pdf" && (
          <>
            <canvas
              ref={canvasRef}
              className="block w-full h-auto select-none pointer-events-none"
              style={{ visibility: pdfReady ? "visible" : "hidden" }}
            />
            {(rendering || renderError) && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/40 pointer-events-none z-[5] min-h-[320px]">
                <p className="text-muted-foreground text-sm px-4 text-center">
                  {renderError || "מעבד PDF..."}
                </p>
              </div>
            )}
          </>
        )}

        {kind === "image" && (
          <img
            src={fileUrl}
            alt="Document"
            className="w-full h-auto block select-none pointer-events-none"
            draggable={false}
            onLoad={() => {
              if (onHeightChange && pageStageRef.current) {
                onHeightChange(pageStageRef.current.getBoundingClientRect().height);
              }
            }}
          />
        )}

        {kind === "other" && (
          <div className="w-full bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            תצוגת PDF לא זמינה לקובץ זה — העלה PDF או תמונה להצבת שדות מדויקת.
          </div>
        )}

        {showOverlays && children}
      </div>
    </div>
  );
});
