import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { renderPdfPageToCanvas, usePdfDocument } from "./usePdfDocument";

interface SignaturePageThumbnailsProps {
  fileUrl: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  fieldCountsByPage?: Record<number, number>;
  className?: string;
}

function Thumbnail({
  pdf,
  pageNumber,
  active,
  fieldCount,
  onSelect,
}: {
  pdf: NonNullable<ReturnType<typeof usePdfDocument>["pdf"]>;
  pageNumber: number;
  active: boolean;
  fieldCount: number;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        await renderPdfPageToCanvas(pdf, pageNumber, canvas, 140);
        if (cancelled) return;
      } catch {
        /* ignore thumbnail errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-md border bg-white p-1.5 text-right transition-colors",
        active
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
      )}
      aria-current={active ? "page" : undefined}
      aria-label={`עמוד ${pageNumber}`}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-auto rounded-sm pointer-events-none select-none bg-muted/20"
      />
      <div className="mt-1 flex items-center justify-between gap-1 text-[11px]">
        <span className={cn("font-medium", active ? "text-primary" : "text-muted-foreground")}>
          עמוד {pageNumber}
        </span>
        {fieldCount > 0 && (
          <span className="rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
            {fieldCount}
          </span>
        )}
      </div>
    </button>
  );
}

/** Vertical strip of PDF page thumbnails for picking the active page. */
export function SignaturePageThumbnails({
  fileUrl,
  currentPage,
  onPageChange,
  fieldCountsByPage = {},
  className,
}: SignaturePageThumbnailsProps) {
  const { pdf, numPages, loading, error } = usePdfDocument(fileUrl, true);

  if (loading && !pdf) {
    return (
      <div className={cn("text-xs text-muted-foreground p-2", className)}>
        טוען עמודים...
      </div>
    );
  }

  if (error || !pdf || numPages <= 1) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium text-muted-foreground px-0.5">עמודים</p>
      <div className="space-y-2 max-h-[min(52vh,520px)] overflow-y-auto pe-1">
        {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
          <Thumbnail
            key={pageNumber}
            pdf={pdf}
            pageNumber={pageNumber}
            active={currentPage === pageNumber}
            fieldCount={fieldCountsByPage[pageNumber] ?? 0}
            onSelect={() => onPageChange(pageNumber)}
          />
        ))}
      </div>
    </div>
  );
}
