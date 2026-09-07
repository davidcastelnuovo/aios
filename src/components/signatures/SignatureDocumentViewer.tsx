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
  /** Prefer PDF rendering even when URL has no .pdf suffix (e.g. signed URLs). */
  forcePdf?: boolean;
  loading?: boolean;
  error?: string | null;
  className?: string;
  onHeightChange?: (height: number) => void;
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
  loading,
  error,
  className = "",
  onHeightChange,
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

  useEffect(() => {
    const el = pageStageRef.current;
    if (!el || !onHeightChange) return;
    const update = () => onHeightChange(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onHeightChange, fileUrl, pdfReady, kind]);

  useEffect(() => {
    if (!fileUrl || kind !== "pdf") {
      setPdfReady(kind === "image");
      return;
    }

    let cancelled = false;
    let renderTask: { cancel?: () => void } | null = null;
    setRendering(true);
    setRenderError(null);
    setPdfReady(false);

    (async () => {
      try {
        const pdf = await pdfjs.getDocument({ url: fileUrl, withCredentials: false }).promise;
        if (cancelled) return;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const unscaled = page.getViewport({ scale: 1 });
        // Use page-stage width if available; otherwise parent width
        const stage = pageStageRef.current;
        const parentWidth =
          stage?.clientWidth ||
          stage?.parentElement?.clientWidth ||
          unscaled.width;
        const scale = parentWidth / unscaled.width;
        const viewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // Exact pixel match — no CSS stretching mismatch
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        canvas.style.maxWidth = "100%";
        canvas.style.height = "auto";
        canvas.style.display = "block";

        const task = page.render({ canvasContext: context, viewport });
        renderTask = task;
        await task.promise;
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
      try {
        renderTask?.cancel?.();
      } catch {
        /* ignore */
      }
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

  const showOverlays = kind === "image" || (kind === "pdf" && pdfReady);

  return (
    <div
      className={`w-full max-w-full overflow-hidden ${className}`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Page stage = sole coordinate space for field % positions */}
      <div
        ref={setPageStageRef}
        data-sig-page-stage
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
