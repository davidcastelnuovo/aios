import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import {
  type DocumentField,
  type SignatureFieldType,
  SIGNATURE_FIELD_OPTIONS,
  createDocumentField,
  getFieldLabel,
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
  const [selectedType, setSelectedType] = useState<SignatureFieldType | null>("signature");
  const [selectedRecipient, setSelectedRecipient] = useState(0);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileUrl);
  const containerHeight = fullScreen ? "80vh" : "400px";

  const getRecipientColorForField = (recipientIndex = 0) =>
    recipients.find((r) => r.index === recipientIndex)?.color ?? getRecipientColor(recipientIndex);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!selectedType || draggingId) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
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
    },
    [selectedType, selectedRecipient, fields, onFieldsChange, draggingId],
  );

  const handleMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
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

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingId) return;
      const container = containerRef.current;
      const field = fields.find((f) => f.id === draggingId);
      if (!container || !field) return;
      const rect = container.getBoundingClientRect();
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
    [draggingId, dragOffset, fields, onFieldsChange],
  );

  const handleMouseUp = () => setDraggingId(null);

  const removeField = (id: string) => {
    onFieldsChange(fields.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        בחר סוג שדה ולחץ על המסמך כדי למקם. גרור שדות קיימים לשינוי מיקום.
      </p>

      {/* Field type picker */}
      <div className="flex flex-wrap gap-2">
        {SIGNATURE_FIELD_OPTIONS.map((opt) => (
          <Button
            key={opt.type}
            type="button"
            size="sm"
            variant={selectedType === opt.type ? "default" : "outline"}
            onClick={() => setSelectedType(opt.type)}
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

      {/* Legend */}
      {fields.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center gap-1 text-xs border rounded px-2 py-1">
              <div className="w-2 h-2 rounded" style={{ backgroundColor: getRecipientColorForField(f.recipient_index) }} />
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-border rounded-lg overflow-hidden bg-white select-none"
        style={{ minHeight: containerHeight }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isImage ? (
          <img src={fileUrl} alt="Document" className="w-full h-auto" draggable={false} />
        ) : (
          <iframe
            src={fileUrl}
            className="w-full border-0 pointer-events-none"
            style={{ height: fullScreen ? "80vh" : "600px" }}
            title="Document preview"
          />
        )}

        <div
          className="absolute inset-0 z-[5]"
          style={{ cursor: selectedType ? "crosshair" : draggingId ? "grabbing" : "default" }}
          onClick={handleContainerClick}
        />

        {fields.map((f) => {
          const color = getRecipientColorForField(f.recipient_index);
          return (
            <div
              key={f.id}
              className="absolute border-2 rounded cursor-move flex items-center justify-center text-xs font-medium group"
              style={{
                left: `${f.position.x}%`,
                top: `${f.position.y}%`,
                width: `${f.position.width}%`,
                height: `${f.position.height}%`,
                borderColor: color,
                backgroundColor: `${color}33`,
                zIndex: draggingId === f.id ? 20 : 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, f.id)}
            >
              <span style={{ color }} className="pointer-events-none font-semibold text-[10px] px-1 truncate">
                {f.type === "signature" ? "✍" : ""} {getFieldLabel(f.type)}
              </span>
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
