import { useState, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";

export interface SignaturePosition {
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage
  height: number; // percentage
  page: number;
}

interface RecipientField {
  index: number;
  name: string;
  color: string;
  position: SignaturePosition | null;
}

interface SignatureFieldPlacerProps {
  fileUrl: string;
  recipients: RecipientField[];
  onPositionChange: (index: number, position: SignaturePosition) => void;
  fullScreen?: boolean;
}

const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

export function getRecipientColor(index: number) {
  return COLORS[index % COLORS.length];
}

export default function SignatureFieldPlacer({ fileUrl, recipients, onPositionChange }: SignatureFieldPlacerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const isImage = /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(fileUrl);
  const isPdf = /\.pdf(\?|$)/i.test(fileUrl);

  const handleContainerClick = useCallback((e: React.MouseEvent, recipientIndex: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    // Default size: 25% width, 8% height
    onPositionChange(recipientIndex, {
      x: Math.max(0, Math.min(75, xPct - 12.5)),
      y: Math.max(0, Math.min(92, yPct - 4)),
      width: 25,
      height: 8,
      page: 1,
    });
  }, [onPositionChange]);

  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const field = recipients[idx];
    if (!field.position) return;
    setDragging(idx);
    setDragOffset({
      x: e.clientX - rect.left - (field.position.x / 100) * rect.width,
      y: e.clientY - rect.top - (field.position.y / 100) * rect.height,
    });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const field = recipients[dragging];
    if (!field.position) return;

    const xPct = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;

    onPositionChange(dragging, {
      ...field.position,
      x: Math.max(0, Math.min(100 - field.position.width, xPct)),
      y: Math.max(0, Math.min(100 - field.position.height, yPct)),
    });
  }, [dragging, dragOffset, recipients, onPositionChange]);

  const handleMouseUp = () => setDragging(null);

  // Find first recipient without position to auto-place on click
  const pendingRecipient = recipients.findIndex(r => !r.position);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {pendingRecipient >= 0
          ? `לחץ על המסמך כדי למקם את שדה החתימה של "${recipients[pendingRecipient].name}"`
          : "גרור את שדות החתימה למיקום הרצוי"}
      </p>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {recipients.map((r, i) => (
          <div key={i} className="flex items-center gap-1 text-xs">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: r.color }} />
            <span>{r.name}</span>
            {r.position ? " ✓" : " —"}
          </div>
        ))}
      </div>

      <div
        ref={containerRef}
        className="relative border-2 border-dashed border-border rounded-lg overflow-hidden bg-white select-none"
        style={{ minHeight: 400 }}
        onClick={(e) => {
          if (pendingRecipient >= 0) handleContainerClick(e, pendingRecipient);
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Document preview */}
        {isImage && (
          <img src={fileUrl} alt="Document" className="w-full h-auto" draggable={false} />
        )}
        {isPdf && (
          <iframe src={fileUrl} className="w-full border-0" style={{ height: 600 }} title="Document preview" />
        )}
        {!isImage && !isPdf && (
          <iframe src={fileUrl} className="w-full border-0" style={{ height: 600 }} title="Document preview" />
        )}

        {/* Signature fields overlay */}
        {recipients.map((r, i) => r.position && (
          <div
            key={i}
            className="absolute border-2 rounded cursor-move flex items-center justify-center text-xs font-medium text-white"
            style={{
              left: `${r.position.x}%`,
              top: `${r.position.y}%`,
              width: `${r.position.width}%`,
              height: `${r.position.height}%`,
              borderColor: r.color,
              backgroundColor: `${r.color}33`,
              zIndex: dragging === i ? 20 : 10,
            }}
            onMouseDown={(e) => handleMouseDown(e, i)}
          >
            <span style={{ color: r.color }} className="pointer-events-none font-semibold text-[11px]">
              ✍ {r.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
