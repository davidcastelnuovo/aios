import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Plus, X, Crosshair, ChevronLeft, ChevronRight } from "lucide-react";
import {
  type DocumentField,
  type SignatureFieldType,
  SIGNATURE_FIELD_OPTIONS,
  createDocumentField,
  getFieldLabel,
  getFieldPlacerLabel,
  getFieldFontSizePx,
  isSignatureFieldType,
} from "./signatureFieldTypes";
import { SignatureDocumentViewer } from "./SignatureDocumentViewer";
import { SignaturePageThumbnails } from "./SignaturePageThumbnails";
import type { SignatureMediaKind } from "./signatureDocumentMedia";
import { detectMediaKind } from "./signatureDocumentMedia";

export interface SignaturePosition {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

interface RecipientInfo {
  index: number;
  name: string;
  color: string;
}

interface SignatureFieldPlacerProps {
  fileUrl: string;
  mediaKind?: SignatureMediaKind | null;
  forcePdf?: boolean;
  recipients: RecipientInfo[];
  fields: DocumentField[];
  onFieldsChange: (fields: DocumentField[]) => void;
  fullScreen?: boolean;
}

const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
const DRAG_THRESHOLD_PX = 4;
const MIN_FIELD_WIDTH = 12;
const MIN_FIELD_HEIGHT = 4;
const MAX_FIELD_WIDTH = 80;
const MAX_FIELD_HEIGHT = 40;

export function getRecipientColor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function SignatureFieldPlacer({
  fileUrl,
  mediaKind,
  forcePdf,
  recipients,
  fields,
  onFieldsChange,
  fullScreen,
}: SignatureFieldPlacerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const [containerHeight, setContainerHeight] = useState(600);
  const [selectedType, setSelectedType] = useState<SignatureFieldType | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const activeDragIdRef = useRef<string | null>(null);
  const activeResizeIdRef = useRef<string | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; fieldX: number; fieldY: number } | null>(null);
  const placePointerRef = useRef<{ x: number; y: number } | null>(null);

  const isPlacing = selectedType !== null;
  const isPdf = forcePdf || detectMediaKind(fileUrl, mediaKind) === "pdf";

  const pageFields = useMemo(
    () => fields.filter((f) => (f.position.page ?? 1) === currentPage),
    [fields, currentPage],
  );

  const fieldCountsByPage = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const f of fields) {
      const p = f.position.page ?? 1;
      counts[p] = (counts[p] ?? 0) + 1;
    }
    return counts;
  }, [fields]);

  // Auto-fix fields that were shrunk below usable size
  useEffect(() => {
    const needsFix = fields.some(
      (f) => f.position.width < MIN_FIELD_WIDTH || f.position.height < MIN_FIELD_HEIGHT,
    );
    if (!needsFix) return;
    onFieldsChange(
      fields.map((f) => ({
        ...f,
        position: {
          ...f.position,
          width: Math.max(MIN_FIELD_WIDTH, f.position.width),
          height: Math.max(MIN_FIELD_HEIGHT, f.position.height),
          page: f.position.page ?? 1,
        },
      })),
    );
  }, [fields, onFieldsChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fileUrl, fullScreen, currentPage]);

  const getRecipientColorForField = (recipientIndex = 0) =>
    recipients.find((r) => r.index === recipientIndex)?.color ?? getRecipientColor(recipientIndex);

  const toggleFieldType = (type: SignatureFieldType) => {
    setSelectedType((prev) => (prev === type ? null : type));
  };

  const isFieldTarget = (target: EventTarget | null) =>
    target instanceof HTMLElement && !!target.closest("[data-sig-field]");

  const placeFieldAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!selectedType) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const xPct = ((clientX - rect.left) / rect.width) * 100;
      const yPct = ((clientY - rect.top) / rect.height) * 100;
      const opt = SIGNATURE_FIELD_OPTIONS.find((o) => o.type === selectedType);
      const w = opt?.width ?? 20;
      const h = opt?.height ?? 4;

      const field = createDocumentField(
        selectedType,
        {
          x: Math.max(0, Math.min(100 - w, xPct - w / 2)),
          y: Math.max(0, Math.min(100 - h, yPct - h / 2)),
          width: w,
          height: h,
          page: currentPage,
        },
        selectedRecipient,
      );

      onFieldsChange([...fieldsRef.current, field]);
      setSelectedFieldId(field.id);
    },
    [selectedType, selectedRecipient, onFieldsChange, currentPage],
  );

  const startDrag = (e: React.PointerEvent, fieldId: string) => {
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;

    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(fieldId);

    const container = containerRef.current;
    const field = fieldsRef.current.find((f) => f.id === fieldId);
    if (!container || !field) return;

    const rect = container.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left - (field.position.x / 100) * rect.width,
      y: e.clientY - rect.top - (field.position.y / 100) * rect.height,
    };
    activeDragIdRef.current = fieldId;
    activeResizeIdRef.current = null;
    resizeStartRef.current = null;
  };

  const startResize = (e: React.PointerEvent, fieldId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(fieldId);

    const field = fieldsRef.current.find((f) => f.id === fieldId);
    if (!field) return;

    activeResizeIdRef.current = fieldId;
    activeDragIdRef.current = null;
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: field.position.width,
      h: field.position.height,
      fieldX: field.position.x,
      fieldY: field.position.y,
    };
  };

  const nudgeFieldSize = (fieldId: string, delta: number) => {
    onFieldsChange(
      fieldsRef.current.map((f) => {
        if (f.id !== fieldId) return f;
        const newW = Math.max(
          MIN_FIELD_WIDTH,
          Math.min(MAX_FIELD_WIDTH, Math.min(100 - f.position.x, f.position.width + delta)),
        );
        const newH = Math.max(
          MIN_FIELD_HEIGHT,
          Math.min(MAX_FIELD_HEIGHT, Math.min(100 - f.position.y, f.position.height + delta * 0.4)),
        );
        return { ...f, position: { ...f.position, width: newW, height: newH } };
      }),
    );
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    if (isFieldTarget(e.target)) return;
    if (!isPlacing) {
      setSelectedFieldId(null);
      return;
    }
    placePointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
    if (!isPlacing || isFieldTarget(e.target)) return;
    const start = placePointerRef.current;
    placePointerRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;
    placeFieldAt(e.clientX, e.clientY);
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (activeResizeIdRef.current && resizeStartRef.current) {
        const start = resizeStartRef.current;
        const dx = ((e.clientX - start.x) / rect.width) * 100;
        const dy = ((e.clientY - start.y) / rect.height) * 100;
        const maxW = Math.min(MAX_FIELD_WIDTH, Math.max(MIN_FIELD_WIDTH, 100 - start.fieldX));
        const maxH = Math.min(MAX_FIELD_HEIGHT, Math.max(MIN_FIELD_HEIGHT, 100 - start.fieldY));
        const newW = Math.max(MIN_FIELD_WIDTH, Math.min(maxW, start.w + dx));
        const newH = Math.max(MIN_FIELD_HEIGHT, Math.min(maxH, start.h + dy));

        onFieldsChange(
          fieldsRef.current.map((f) =>
            f.id === activeResizeIdRef.current
              ? { ...f, position: { ...f.position, width: newW, height: newH } }
              : f,
          ),
        );
        return;
      }

      if (!activeDragIdRef.current) return;
      const field = fieldsRef.current.find((f) => f.id === activeDragIdRef.current);
      if (!field) return;

      const xPct = ((e.clientX - rect.left - dragOffsetRef.current.x) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top - dragOffsetRef.current.y) / rect.height) * 100;

      onFieldsChange(
        fieldsRef.current.map((f) =>
          f.id === activeDragIdRef.current
            ? {
                ...f,
                position: {
                  ...f.position,
                  x: Math.max(0, Math.min(100 - f.position.width, xPct)),
                  y: Math.max(0, Math.min(100 - f.position.height, yPct)),
                },
              }
            : f,
        ),
      );
    };

    const onPointerUp = () => {
      activeDragIdRef.current = null;
      activeResizeIdRef.current = null;
      resizeStartRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onFieldsChange]);

  const removeField = (id: string) => {
    onFieldsChange(fieldsRef.current.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const selectField = (field: DocumentField) => {
    setSelectedFieldId(field.id);
    const page = field.position.page ?? 1;
    if (page !== currentPage) setCurrentPage(page);
  };

  const goToPage = (page: number) => {
    const next = Math.min(Math.max(1, page), Math.max(1, numPages));
    setCurrentPage(next);
    setSelectedFieldId(null);
  };

  return (
    <div className={`flex flex-col gap-3 ${fullScreen ? "h-full min-h-0" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/40 shrink-0">
        {isPlacing ? (
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            <Crosshair className="h-4 w-4" />
            מצב הצבה: {getFieldLabel(selectedType!)} בעמוד {currentPage} — לחץ על מקום ריק להוספה
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            בחר שדה מימין והצב על העמוד הפעיל, או גרור שדה קיים
          </span>
        )}
        {numPages > 1 && (
          <div className="flex items-center gap-1 mr-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={currentPage >= numPages}
              onClick={() => goToPage(currentPage + 1)}
              title="עמוד הבא"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[4.5rem] text-center">
              עמוד {currentPage} מתוך {numPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0"
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              title="עמוד קודם"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className={`flex gap-3 items-start min-h-0 ${fullScreen ? "flex-1" : ""}`}>
        {/* Right sidebar (RTL: first = right): fields + page thumbs */}
        <aside className="w-[11.5rem] sm:w-52 shrink-0 sticky top-2 self-start space-y-3 z-20">
          <div className="rounded-xl border bg-background/95 shadow-md backdrop-blur-sm p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">שדות להצבה</p>
            <div className="flex flex-col gap-1.5">
              {SIGNATURE_FIELD_OPTIONS.map((opt) => (
                <Button
                  key={opt.type}
                  type="button"
                  size="sm"
                  variant={selectedType === opt.type ? "default" : "outline"}
                  className="justify-start w-full"
                  onClick={() => toggleFieldType(opt.type)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {recipients.length > 1 && (
              <div className="pt-2 border-t space-y-1.5">
                <p className="text-xs text-muted-foreground">שייך לחותם</p>
                {recipients.map((r) => (
                  <Button
                    key={r.index}
                    type="button"
                    size="sm"
                    variant={selectedRecipient === r.index ? "default" : "outline"}
                    className="justify-start w-full"
                    onClick={() => setSelectedRecipient(r.index)}
                  >
                    <span className="w-2 h-2 rounded-full ml-1 shrink-0" style={{ backgroundColor: r.color }} />
                    <span className="truncate">{r.name}</span>
                  </Button>
                ))}
              </div>
            )}
          </div>

          {isPdf && (
            <div className="rounded-xl border bg-muted/30 p-2 shadow-sm">
              <SignaturePageThumbnails
                fileUrl={fileUrl}
                currentPage={currentPage}
                onPageChange={goToPage}
                fieldCountsByPage={fieldCountsByPage}
              />
            </div>
          )}
        </aside>

        {/* Center: active page */}
        <div className="flex-1 min-w-0 space-y-3">
          {fields.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {fields.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`flex items-center gap-1 text-xs border rounded px-2 py-1 transition-colors ${
                    selectedFieldId === f.id ? "border-primary bg-primary/10" : ""
                  }`}
                  onClick={() => selectField(f)}
                >
                  <div
                    className="w-2 h-2 rounded"
                    style={{ backgroundColor: getRecipientColorForField(f.recipient_index) }}
                  />
                  <span>{f.label || getFieldPlacerLabel(f.type)}</span>
                  <span className="text-muted-foreground">ע{f.position.page ?? 1}</span>
                  <X
                    className="h-3 w-3 text-destructive hover:opacity-80"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                  />
                </button>
              ))}
              {selectedFieldId && (
                <div className="flex items-center gap-1 mr-auto">
                  <span className="text-xs text-muted-foreground">גודל:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    title="הקטן"
                    onClick={() => nudgeFieldSize(selectedFieldId, -3)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-7 p-0"
                    title="הגדל"
                    onClick={() => nudgeFieldSize(selectedFieldId, 3)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <SignatureDocumentViewer
            ref={containerRef}
            fileUrl={fileUrl}
            mediaKind={mediaKind}
            forcePdf={forcePdf}
            page={currentPage}
            onNumPagesChange={(n) => {
              setNumPages(n);
              if (currentPage > n) setCurrentPage(n);
            }}
            onHeightChange={setContainerHeight}
            onPointerDown={handleContainerPointerDown}
            onPointerUp={handleContainerPointerUp}
            className={`border-2 border-dashed border-border rounded-lg bg-white select-none touch-none ${
              isPlacing ? "cursor-crosshair" : ""
            }`}
          >
            {pageFields.map((f) => {
              const color = getRecipientColorForField(f.recipient_index);
              const fontSize = getFieldFontSizePx(f.position, containerHeight);
              const isSelected = selectedFieldId === f.id;
              const isHovered = hoveredFieldId === f.id;
              const showResize = isSelected || isHovered;

              return (
                <div
                  key={f.id}
                  data-sig-field={f.id}
                  className={`absolute border-2 rounded flex items-center justify-center font-medium group z-10 cursor-move touch-none ${
                    isSelected ? "ring-2 ring-offset-1" : isHovered ? "ring-1 ring-offset-1" : ""
                  }`}
                  style={{
                    left: `${f.position.x}%`,
                    top: `${f.position.y}%`,
                    width: `${f.position.width}%`,
                    height: `${f.position.height}%`,
                    borderColor: color,
                    backgroundColor: `${color}44`,
                    boxShadow: isSelected ? `0 0 0 2px ${color}` : undefined,
                    zIndex: isSelected || isHovered ? 20 : 10,
                  }}
                  onPointerDown={(e) => startDrag(e, f.id)}
                  onPointerEnter={() => setHoveredFieldId(f.id)}
                  onPointerLeave={() => setHoveredFieldId((id) => (id === f.id ? null : id))}
                >
                  <span
                    style={{ color, fontSize }}
                    className="pointer-events-none font-semibold px-1 truncate leading-tight"
                  >
                    {isSignatureFieldType(f.type) ? "✍ " : ""}
                    {getFieldPlacerLabel(f.type)}
                  </span>

                  {showResize && (
                    <div
                      data-resize-handle
                      role="button"
                      aria-label="שינוי גודל"
                      className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 rounded-full cursor-se-resize z-40 shadow-md hover:scale-110 transition-transform"
                      style={{ borderColor: color }}
                      onPointerDown={(e) => startResize(e, f.id)}
                    />
                  )}

                  <button
                    type="button"
                    className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-40"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(f.id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </SignatureDocumentViewer>
        </div>
      </div>
    </div>
  );
}
