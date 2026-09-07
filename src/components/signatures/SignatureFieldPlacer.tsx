import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, MousePointer2, Crosshair } from "lucide-react";
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
const DRAG_THRESHOLD_PX = 6;
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
  const [containerHeight, setContainerHeight] = useState(600);
  const [selectedType, setSelectedType] = useState<SignatureFieldType | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
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
    setSelectedFieldId(null);
  };

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

      onFieldsChange([...fields, field]);
      setSelectedFieldId(field.id);
    },
    [selectedType, selectedRecipient, fields, onFieldsChange],
  );

  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (!isPlacing) return;
    placePointerRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleOverlayMouseUp = (e: React.MouseEvent) => {
    if (!isPlacing || draggingId) return;
    const start = placePointerRef.current;
    placePointerRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;
    placeFieldAt(e.clientX, e.clientY);
  };

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    if (isPlacing) return;
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    const container = containerRef.current;
    const field = fields.find((f) => f.id === fieldId);
    if (!container || !field) return;
    const rect = container.getBoundingClientRect();
    setDraggingId(fieldId);
    setDragOffset({
      x: e.clientX - rect.left - (field.position.x / 100) * rect.width,
      y: e.clientY - rect.top - (field.position.y / 100) * rect.height,
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setResizingId(fieldId);
    setSelectedFieldId(fieldId);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      w: field.position.width,
      h: field.position.height,
    };
  };

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      if (resizingId && resizeStartRef.current) {
        const field = fields.find((f) => f.id === resizingId);
        if (!field) return;
        const dx = ((e.clientX - resizeStartRef.current.x) / rect.width) * 100;
        const dy = ((e.clientY - resizeStartRef.current.y) / rect.height) * 100;
        const newW = Math.max(MIN_FIELD_WIDTH, Math.min(95 - field.position.x, resizeStartRef.current.w + dx));
        const newH = Math.max(MIN_FIELD_HEIGHT, Math.min(50 - field.position.y, resizeStartRef.current.h + dy));

        onFieldsChange(
          fields.map((f) =>
            f.id === resizingId
              ? { ...f, position: { ...f.position, width: newW, height: newH } }
              : f,
          ),
        );
        return;
      }

      if (!draggingId) return;
      const field = fields.find((f) => f.id === draggingId);
      if (!field) return;
      const xPct = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

      onFieldsChange(
        fields.map((f) =>
          f.id === draggingId
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
    },
    [draggingId, resizingId, dragOffset, fields, onFieldsChange],
  );

  const handleMouseUp = () => {
    setDraggingId(null);
    setResizingId(null);
    resizeStartRef.current = null;
  };

  const removeField = (id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const docHeight = fullScreen ? "min(1200px, 150vh)" : "600px";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/40">
        <Button
          type="button"
          size="sm"
          variant={!isPlacing ? "default" : "outline"}
          onClick={() => { setSelectedType(null); setSelectedFieldId(null); }}
        >
          <MousePointer2 className="h-4 w-4 ml-1" />
          גלילה / עכבר
        </Button>
        {isPlacing && (
          <span className="text-sm text-primary font-medium flex items-center gap-1">
            <Crosshair className="h-4 w-4" />
            מצב הצבה: {getFieldLabel(selectedType!)}
          </span>
        )}
        <span className="text-xs text-muted-foreground mr-auto">
          {isPlacing
            ? "לחץ על המסמך להוספת שדה."
            : "גרור שדות להזזה · גרור הפינה להגדלה/הקטנה · X להסרה"}
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
        className="relative border-2 border-dashed border-border rounded-lg bg-white select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => { if (!isPlacing) setSelectedFieldId(null); }}
      >
        {isImage ? (
          <img src={fileUrl} alt="Document" className="w-full h-auto block" draggable={false} />
        ) : (
          <iframe
            src={fileUrl}
            className="w-full border-0 block"
            style={{
              height: docHeight,
              pointerEvents: isPlacing ? "none" : "auto",
            }}
            title="Document preview"
          />
        )}

        {isPlacing && (
          <div
            className="absolute inset-0 z-[5]"
            style={{ cursor: "crosshair" }}
            onMouseDown={handleOverlayMouseDown}
            onMouseUp={handleOverlayMouseUp}
          />
        )}

        {fields.map((f) => {
          const color = getRecipientColorForField(f.recipient_index);
          const fontSize = getFieldFontSizePx(f.position, containerHeight);
          const isSelected = selectedFieldId === f.id;

          return (
            <div
              key={f.id}
              className={`absolute border-2 rounded flex items-center justify-center font-medium group z-10 ${
                isPlacing ? "" : "cursor-move"
              } ${isSelected ? "ring-2 ring-offset-1" : ""}`}
              style={{
                left: `${f.position.x}%`,
                top: `${f.position.y}%`,
                width: `${f.position.width}%`,
                height: `${f.position.height}%`,
                borderColor: color,
                backgroundColor: `${color}33`,
                boxShadow: isSelected ? `0 0 0 2px ${color}` : undefined,
                zIndex: draggingId === f.id || resizingId === f.id ? 20 : isSelected ? 15 : 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, f.id)}
            >
              <span
                style={{ color, fontSize }}
                className="pointer-events-none font-semibold px-1 truncate leading-tight"
              >
                {f.type === "signature" ? "✍ " : ""}{getFieldLabel(f.type)}
              </span>
              {!isPlacing && isSelected && (
                <div
                  className="absolute bottom-0 left-0 w-3.5 h-3.5 bg-white border-2 rounded-sm cursor-se-resize z-30"
                  style={{ borderColor: color, transform: "translate(-30%, 30%)" }}
                  onMouseDown={(e) => handleResizeMouseDown(e, f.id)}
                  title="גרור לשינוי גודל"
                />
              )}
              <button
                type="button"
                className="absolute -top-2 -left-2 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30"
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
