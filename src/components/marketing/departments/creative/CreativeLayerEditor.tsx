import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { cn } from "@/lib/utils";
import { Loader2, Move, Save, Type } from "lucide-react";
import type { CreativeFormat, CreativeLayer, CreativeVariation } from "./types";
import { aspectRatioClass } from "./utils";

interface Props {
  variation: CreativeVariation;
  onChange: (next: CreativeVariation) => void;
  onSave: () => Promise<void>;
  saving?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

const FONT_OPTIONS = ["Rubik", "Assistant", "Heebo", "Arial", "Georgia"];

type DragMode = "move" | "resize-se";

export function CreativeLayerEditor({
  variation,
  onChange,
  onSave,
  saving,
  editing,
  onEditingChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [internalEditing, setInternalEditing] = useState(false);
  const dragRef = useRef<{
    mode: DragMode;
    layerId: string;
    startX: number;
    startY: number;
    origin: CreativeLayer;
  } | null>(null);

  const isEditing = editing ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;

  useEffect(() => {
    if (!isEditing) setSelectedLayerId(null);
  }, [isEditing]);

  const selectedLayer = variation.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const textLayers = variation.layers.filter((layer) => layer.type === "text");

  const updateLayer = useCallback((layerId: string, patch: Partial<CreativeLayer>) => {
    onChange({
      ...variation,
      layers: variation.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer),
    });
  }, [onChange, variation]);

  const addTextLayer = () => {
    const layer: CreativeLayer = {
      id: crypto.randomUUID(),
      type: "text",
      x: 12,
      y: 40,
      width: 76,
      height: 14,
      text: "טקסט חדש",
      fontFamily: "Rubik",
      fontSize: 24,
      fontWeight: "600",
      color: "#ffffff",
      textAlign: "right",
    };
    onChange({ ...variation, layers: [...variation.layers, layer] });
    setSelectedLayerId(layer.id);
    setEditing(true);
  };

  const removeSelectedLayer = () => {
    if (!selectedLayerId) return;
    onChange({
      ...variation,
      layers: variation.layers.filter((layer) => layer.id !== selectedLayerId),
    });
    setSelectedLayerId(null);
  };

  const beginDrag = (event: React.MouseEvent, layer: CreativeLayer, mode: DragMode) => {
    if (!isEditing) return;
    event.stopPropagation();
    setSelectedLayerId(layer.id);
    dragRef.current = {
      mode,
      layerId: layer.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...layer },
    };
  };

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      const canvas = canvasRef.current;
      if (!drag || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dx = ((event.clientX - drag.startX) / rect.width) * 100;
      const dy = ((event.clientY - drag.startY) / rect.height) * 100;

      if (drag.mode === "move") {
        updateLayer(drag.layerId, {
          x: clamp(drag.origin.x + dx, 0, 100 - drag.origin.width),
          y: clamp(drag.origin.y + dy, 0, 100 - drag.origin.height),
        });
        return;
      }

      updateLayer(drag.layerId, {
        width: clamp(drag.origin.width + dx, 8, 100 - drag.origin.x),
        height: clamp(drag.origin.height + dy, 6, 100 - drag.origin.y),
      });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateLayer]);

  const canvasClass = useMemo(() => aspectRatioClass(variation.format), [variation.format]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-muted/10">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">
          {isEditing ? "מצב עריכה — גרור שכבות, שנה טקסט ופונטים" : "לחץ על הקריאייטיב כדי לערוך"}
        </span>
        <div className="flex items-center gap-2">
          {isEditing && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={addTextLayer}>
                <Type className="h-3.5 w-3.5" />שכבת טקסט
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                שמור גרסה
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>סיום עריכה</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        <div
          className={cn(
            "relative w-full max-w-3xl overflow-hidden rounded-2xl border bg-muted shadow-xl",
            !isEditing && "cursor-zoom-in ring-offset-background hover:ring-2 hover:ring-pink-400/40",
            canvasClass,
          )}
          onClick={() => {
            if (!isEditing) setEditing(true);
            else setSelectedLayerId(null);
          }}
        >
          <div ref={canvasRef} className="absolute inset-0">
            <CreativeImage src={variation.imageUrl} alt={variation.name} className="absolute inset-0 h-full w-full object-cover" />
            {isEditing && variation.layers.filter((layer) => layer.type === "text").map((layer) => (
              <div
                key={layer.id}
                className={cn(
                  "absolute cursor-move rounded-md border border-transparent px-1 py-0.5",
                  selectedLayerId === layer.id && "border-pink-400 ring-2 ring-pink-400/30",
                )}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.width}%`,
                  height: `${layer.height}%`,
                  color: layer.color ?? "#fff",
                  fontFamily: layer.fontFamily ?? "Rubik",
                  fontSize: `${layer.fontSize ?? 24}px`,
                  fontWeight: layer.fontWeight ?? "600",
                  textAlign: layer.textAlign ?? "right",
                  lineHeight: 1.15,
                  textShadow: "0 2px 10px rgba(0,0,0,0.45)",
                }}
                onMouseDown={(event) => beginDrag(event, layer, "move")}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedLayerId(layer.id);
                }}
              >
                <span className="block h-full overflow-hidden whitespace-pre-wrap break-words">{layer.text}</span>
                {selectedLayerId === layer.id && (
                  <span
                    className="absolute -bottom-1 -left-1 h-3 w-3 cursor-se-resize rounded-full border border-white bg-pink-500"
                    onMouseDown={(event) => beginDrag(event, layer, "resize-se")}
                  />
                )}
              </div>
            ))}
            {!isEditing && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 text-right text-xs text-white">
                לחץ לעריכת שכבות
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditing && (
        <aside className="absolute inset-y-0 left-0 z-20 flex w-[320px] max-w-[90vw] flex-col border-r bg-background shadow-xl" dir="rtl">
          <div className="border-b px-4 py-3">
            <div className="text-sm font-semibold">עריכת קריאייטיב</div>
            <p className="text-[11px] text-muted-foreground">התמונה נשארת במסך — עורכים רק שכבות</p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <Label className="text-[11px] text-muted-foreground">שכבות</Label>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border bg-muted/40 px-2 py-2 text-right text-xs"
                disabled
              >
                <Move className="h-3.5 w-3.5" />רקע (תמונה)
              </button>
              {textLayers.map((layer, index) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={cn(
                    "w-full rounded-lg border px-2 py-2 text-right text-xs transition-colors",
                    selectedLayerId === layer.id ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20" : "hover:bg-muted/50",
                  )}
                >
                  <div className="font-semibold">טקסט {index + 1}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{layer.text || "ריק"}</div>
                </button>
              ))}
              <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={addTextLayer}>
                <Type className="h-3.5 w-3.5" />הוסף שכבת טקסט
              </Button>

              {selectedLayer?.type === "text" && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <Label>תוכן</Label>
                    <Textarea
                      className="mt-1 min-h-20 text-sm"
                      value={selectedLayer.text ?? ""}
                      onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label>פונט</Label>
                    <Select
                      value={selectedLayer.fontFamily ?? "Rubik"}
                      onValueChange={(value) => updateLayer(selectedLayer.id, { fontFamily: value })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{FONT_OPTIONS.map((font) => <SelectItem key={font} value={font}>{font}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>גודל ({selectedLayer.fontSize ?? 24}px)</Label>
                    <Slider
                      className="mt-3"
                      min={12}
                      max={72}
                      step={1}
                      value={[selectedLayer.fontSize ?? 24]}
                      onValueChange={([value]) => updateLayer(selectedLayer.id, { fontSize: value })}
                    />
                  </div>
                  <div>
                    <Label>משקל</Label>
                    <Select
                      value={selectedLayer.fontWeight ?? "600"}
                      onValueChange={(value) => updateLayer(selectedLayer.id, { fontWeight: value })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="400">רגיל</SelectItem>
                        <SelectItem value="600">מודגש</SelectItem>
                        <SelectItem value="700">כהה</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>צבע</Label>
                    <Input
                      className="mt-1 h-9"
                      type="color"
                      value={selectedLayer.color ?? "#ffffff"}
                      onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })}
                    />
                  </div>
                  <div>
                    <Label>יישור</Label>
                    <Select
                      value={selectedLayer.textAlign ?? "right"}
                      onValueChange={(value: "right" | "center" | "left") => updateLayer(selectedLayer.id, { textAlign: value })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">ימין</SelectItem>
                        <SelectItem value="center">מרכז</SelectItem>
                        <SelectItem value="left">שמאל</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-destructive" onClick={removeSelectedLayer}>
                    מחק שכבת טקסט
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      )}
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const formatLabel = (format: CreativeFormat) => ({
  "9:16": "סטורי / רילס 9:16",
  "1:1": "פוסט מרובע 1:1",
  "4:5": "פיד 4:5",
  "16:9": "וידאו רחב 16:9",
}[format]);
