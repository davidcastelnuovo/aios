import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Crosshair } from "lucide-react";
import {
  type DocumentField,
  type SignatureFieldType,
  SIGNATURE_FIELD_OPTIONS,
  createDocumentField,
  getFieldLabel,
  getFieldFontSizePx,
} from "./signatureFieldTypes";

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
  recipients: RecipientInfo[];
  fields: DocumentField[];
  onFieldsChange: (fields: DocumentField[]) => void;
  fullScreen?: boolean;
}

const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];
const DRAG_THRESHOLD_PX = 4;
const MIN_FIELD_WIDTH = 8;
const MIN_FIELD_HEIGHT = 2.5;

export function getRecipientColor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function SignatureFieldPlacer({
  fileUrl,
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

  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const activeDragIdRef = useRef<string | null>(null);
  const activeResizeIdRef = useRef<string | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number; fieldX: number; fieldY: number } | null>(null);
  const placePointerRef = useRef<{ x: number; y: number } | null>(null);

  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileUrl);
  const isPlacing = selectedType !== null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerHeight(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fileUrl, fullScreen]);

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
          page: 1,
        },
        selectedRecipient,
      );

      onFieldsChange([...fieldsRef.current, field]);
      setSelectedFieldId(field.id);
    },
    [selectedType, selectedRecipient, onFieldsChange],
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

    const el = (e.currentTarget as HTMLElement);
    el.setPointerCapture(e.pointerId);
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

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
        const dx = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
        const dy = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;
        const newW = Math.max(
          MIN_FIELD_WIDTH,
          Math.min(95 - resizeStartRef.current.fieldX, resizeStartRef.current.w + dx),
        );
        const newH = Math.max(
          MIN_FIELD_HEIGHT,
          Math.min(50 - resizeStartRef.current.fieldY, resizeStartRef.current.h + dy),
        );

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

  const docHeight = fullScreen ? "min(1200px, 150vh)" : "600px";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/40">
        {isPlacing ? (
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            <Crosshair className="h-4 w-4" />
            מצב הצבה: {getFieldLabel(selectedType!)} — לחץ על מקום ריק להוספה, או גרור שדה קיים
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">בחר סוג שדה להוספה, או גרור שדה קיים לשינוי מיקום</span>
        )}
        <span className="text-xs text-muted-foreground mr-auto">
          גרור שדה להזזה · פינה ימנית-תחתונה לשינוי גודל
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {SIGNATURE_FIELD_OPTIONS.map((opt) => (
          <Button
            key={opt.type}
            type="button"
            size="sm"
            variant={selectedType === opt.type ? "default" : "outline"}
            onClick={() => toggleFieldType(opt.type)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {recipients.length > 1 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground">שייך לחותם:</span>
          {recipients.map((r) => (
            <Button
              key={r.index}
              type="button"
              size="sm"
              variant={selectedRecipient === r.index ? "default" : "outline"}
              onClick={() => setSelectedRecipient(r.index)}
            >
              <span className="w-2 h-2 rounded-full ml-1" style={{ backgroundColor: r.color }} />
              {r.name}
            </Button>
          ))}
        </div>
      )}

      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`flex items-center gap-1 text-xs border rounded px-2 py-1 transition-colors ${
                selectedFieldId === f.id ? "border-primary bg-primary/10" : ""
              }`}
              onClick={() => setSelectedFieldId(f.id)}
            >
              <div className="w-2 h-2 rounded" style={{ backgroundColor: getRecipientColorForField(f.recipient_index) }} />
              <span>{f.label}</span>
              <X
                className="h-3 w-3 text-destructive hover:opacity-80"
                onClick={(e) => { e.stopPropagation(); removeField(f.id); }}
              />
            </button>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className={`relative border-2 border-dashed border-border rounded-lg bg-white select-none touch-none ${
          isPlacing ? "cursor-crosshair" : ""
        }`}
        onPointerDown={handleContainerPointerDown}
        onPointerUp={handleContainerPointerUp}
      >
        {isImage ? (
          <img src={fileUrl} alt="Document" className="w-full h-auto block pointer-events-none" draggable={false} />
        ) : (
          <iframe
            src={fileUrl}
            className="w-full border-0 block pointer-events-none"
            style={{ height: docHeight }}
            title="Document preview"
          />
        )}

        {fields.map((f) => {
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
                {f.type === "signature" ? "✍ " : ""}{getFieldLabel(f.type)}
              </span>

              {showResize && (
                <div
                  data-resize-handle
                  role="button"
                  aria-label="שינוי גודל"
                  className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-white border-2 rounded-sm cursor-se-resize z-40 shadow-sm hover:scale-110 transition-transform"
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
      </div>
    </div>
  );
}
