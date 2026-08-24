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
import { ArrowRight, Layers2, Loader2, Move, Save, Trash2, Type, WandSparkles } from "lucide-react";
import type { CreativeFormat, CreativeLayer, CreativeVariation, LayerShadowStyle } from "./types";
import { inferLayerShadow, withLayerShadow } from "./layerShadow";
import { aspectRatioClass } from "./utils";

interface Props {
  variation: CreativeVariation;
  onChange: (next: CreativeVariation) => void;
  onSave: () => Promise<void>;
  saving?: boolean;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onExpandStyle?: () => void;
  expandStyleCount?: number;
  onBack?: () => void;
}

const FONT_OPTIONS = ["Suez One", "Heebo", "Rubik", "Assistant", "Arial", "Georgia"];

type DragMode = "move" | "resize-se";

export function CreativeLayerEditor({
  variation,
  onChange,
  onSave,
  saving,
  editing,
  onEditingChange,
  onRegenerate,
  regenerating,
  onExpandStyle,
  expandStyleCount,
  onBack,
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
    if (!isEditing) {
      setSelectedLayerId(null);
      return;
    }
    setSelectedLayerId((current) => {
      if (current && variation.layers.some((layer) => layer.id === current)) return current;
      return variation.layers.find((layer) => layer.type === "text")?.id
        ?? variation.layers.find((layer) => layer.type !== "background")?.id
        ?? null;
    });
  }, [isEditing, variation.id]);

  const selectedLayer = variation.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedShadow = selectedLayer?.type === "text" ? inferLayerShadow(selectedLayer) : null;
  const overlayLayers = variation.layers.filter((layer) => layer.type !== "background");

  const updateLayer = useCallback((layerId: string, patch: Partial<CreativeLayer>) => {
    onChange({
      ...variation,
      layers: variation.layers.map((layer) => layer.id === layerId ? { ...layer, ...patch } : layer),
    });
  }, [onChange, variation]);

  const removeLayer = useCallback((layerId: string) => {
    onChange({
      ...variation,
      layers: variation.layers.filter((layer) => layer.id !== layerId),
    });
    setSelectedLayerId((current) => current === layerId ? null : current);
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
    if (selectedLayerId) removeLayer(selectedLayerId);
  };

  const applyShadow = (layerId: string, patch: Partial<ReturnType<typeof inferLayerShadow>>) => {
    const layer = variation.layers.find((item) => item.id === layerId);
    if (!layer) return;
    updateLayer(layerId, withLayerShadow({ ...inferLayerShadow(layer), ...patch }));
  };

  const removeAllTextLayers = () => {
    onChange({
      ...variation,
      layers: variation.layers.filter((layer) => layer.type === "background" || layer.type === "image"),
    });
    setSelectedLayerId(null);
  };

  useEffect(() => {
    if (!isEditing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (selectedLayerId) {
        event.preventDefault();
        removeLayer(selectedLayerId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, selectedLayerId, removeLayer]);

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
        <div className="flex items-center gap-2">
          {onBack && (
            <Button size="sm" variant="ghost" className="gap-1" onClick={onBack}>
              <ArrowRight className="h-3.5 w-3.5" />חזרה לגריד
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {isEditing ? "מצב עריכה — הקלד על השכבה, גרור, ושלוט בהצללה" : "לחץ פעמיים על הקריאייטיב או על עריכה כדי לערוך שכבות"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRegenerate && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onRegenerate} disabled={regenerating}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              ג׳נרט מחדש
            </Button>
          )}
          {onExpandStyle && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onExpandStyle} disabled={regenerating || !expandStyleCount}>
              <Layers2 className="h-3.5 w-3.5" />
              עוד בסגנון הזה
              {!!expandStyleCount && <span className="text-[10px] text-muted-foreground">{expandStyleCount}</span>}
            </Button>
          )}
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
            !isEditing && "cursor-default",
            canvasClass,
          )}
          onClick={() => {
            if (isEditing) setSelectedLayerId(null);
          }}
          onDoubleClick={() => {
            if (!isEditing) setEditing(true);
          }}
        >
          <div ref={canvasRef} className="absolute inset-0">
            <CreativeImage src={variation.imageUrl} alt={variation.name} className="absolute inset-0 h-full w-full object-cover" />
            {overlayLayers.map((layer) => (
              <div
                key={layer.id}
                className={cn(
                  "absolute",
                  isEditing && "cursor-move",
                  !isEditing && "pointer-events-none",
                  isEditing && selectedLayerId === layer.id && "ring-2 ring-pink-400/40",
                )}
                style={{
                  left: `${layer.x}%`,
                  top: `${layer.y}%`,
                  width: `${layer.width}%`,
                  height: `${layer.height}%`,
                  display: layer.type === "text" ? "flex" : undefined,
                  alignItems: layer.type === "text" ? "center" : undefined,
                  justifyContent: layer.textAlign === "center" ? "center" : layer.textAlign === "left" ? "flex-start" : "flex-end",
                  background: layer.type === "shape" ? layer.fill ?? "#0f172acc" : undefined,
                  borderRadius: layer.type === "shape" ? layer.borderRadius : undefined,
                  transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                  transformOrigin: "center center",
                  boxShadow: layer.boxShadow,
                  opacity: layer.opacity,
                  color: layer.color ?? "#fff",
                  fontFamily: layer.fontFamily ?? "Rubik",
                  fontSize: `${layer.fontSize ?? 24}px`,
                  fontWeight: layer.fontWeight ?? "600",
                  textAlign: layer.textAlign ?? "right",
                  letterSpacing: layer.letterSpacing,
                  lineHeight: layer.lineHeight ?? 1.05,
                  textShadow: layer.type === "text" ? layer.textShadow ?? "0 2px 14px rgba(0,0,0,0.35)" : undefined,
                }}
                onMouseDown={(event) => {
                  if (!isEditing) return;
                  beginDrag(event, layer, "move");
                }}
                onClick={(event) => {
                  if (!isEditing) return;
                  event.stopPropagation();
                  setSelectedLayerId(layer.id);
                }}
              >
                {isEditing && selectedLayerId === layer.id && (
                  <button
                    type="button"
                    className="absolute -top-2 -left-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-destructive text-white shadow"
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    aria-label="מחק שכבה"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
                {layer.type === "image" && layer.src ? (
                  <CreativeImage src={layer.src} alt={layer.role === "logo" ? "לוגו" : "שכבת תמונה"} className="h-full w-full object-contain" />
                ) : layer.type === "text" && isEditing && selectedLayerId === layer.id ? (
                  <textarea
                    className="h-full w-full resize-none bg-transparent px-1 outline-none"
                    dir="auto"
                    value={layer.text ?? ""}
                    onChange={(event) => updateLayer(layer.id, { text: event.target.value })}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                    style={{
                      color: "inherit",
                      fontFamily: "inherit",
                      fontSize: "inherit",
                      fontWeight: "inherit",
                      textAlign: "inherit",
                      letterSpacing: "inherit",
                      lineHeight: "inherit",
                      textShadow: "inherit",
                    }}
                  />
                ) : layer.type === "text" ? (
                  <span className="block w-full overflow-hidden whitespace-pre-wrap break-words px-1">{layer.text}</span>
                ) : null}
                {isEditing && selectedLayerId === layer.id && (
                  <span
                    className="absolute -bottom-1 -left-1 h-3 w-3 cursor-se-resize rounded-full border border-white bg-pink-500"
                    onMouseDown={(event) => beginDrag(event, layer, "resize-se")}
                  />
                )}
              </div>
            ))}
            {!isEditing && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white">
                לחץ לעריכה
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
              {overlayLayers.map((layer, index) => (
                <div key={layer.id} className="flex items-stretch gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-lg border px-2 py-2 text-right text-xs transition-colors",
                      selectedLayerId === layer.id ? "border-pink-400 bg-pink-50 dark:bg-pink-950/20" : "hover:bg-muted/50",
                    )}
                  >
                    <div className="font-semibold">
                      {layer.type === "image" ? "לוגו" : layer.type === "shape" ? `פלטה ${index + 1}` : `טקסט ${index + 1}`}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {layer.type === "image" ? "מורכב מהקובץ שהועלה" : layer.text || (layer.type === "shape" ? "רקע לקופי" : "ריק")}
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-auto shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => removeLayer(layer.id)}
                    aria-label={`מחק שכבה ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={addTextLayer}>
                  <Type className="h-3.5 w-3.5" />הוסף
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive" onClick={removeAllTextLayers} disabled={overlayLayers.length === 0}>
                  <Trash2 className="h-3.5 w-3.5" />מחק הכל
                </Button>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                השכבות הן העיצוב — פלטה + כותרת + CTA כמו בפוטושופ. טקסט משובש בתוך התמונה עצמה דורש ג׳נרט מחדש.
              </p>

              {selectedLayer?.type === "image" && (
                <div className="space-y-3 border-t pt-4">
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    שכבת לוגו — מורכבת מהקובץ המקורי. אפשר לגרור ולשנות גודל, בלי לצייר מחדש.
                  </p>
                  <Button variant="outline" size="sm" className="w-full text-destructive" onClick={removeSelectedLayer}>
                    מחק שכבת לוגו
                  </Button>
                </div>
              )}

              {selectedLayer?.type === "text" && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <Label>הטקסט עצמו</Label>
                    <Textarea
                      className="mt-1 min-h-24 text-sm"
                      dir="auto"
                      value={selectedLayer.text ?? ""}
                      onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })}
                      placeholder="כתוב כאן את הכותרת, ההצעה או ה-CTA"
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">אפשר גם להקליד ישירות על השכבה בקנבס.</p>
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
                      max={120}
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
                        <SelectItem value="800">תצוגה</SelectItem>
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
                  {selectedShadow && (
                    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                      <Label>הצללה</Label>
                      <Select
                        value={selectedShadow.shadowStyle}
                        onValueChange={(value: LayerShadowStyle) => applyShadow(selectedLayer.id, { shadowStyle: value, shadowDepth: value === "none" ? 0 : Math.max(selectedShadow.shadowDepth, 4) })}
                      >
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">בלי הצללה</SelectItem>
                          <SelectItem value="soft">רכה</SelectItem>
                          <SelectItem value="extrude">תלת־ממד / עומק</SelectItem>
                          <SelectItem value="halo">הילה / קו מתאר</SelectItem>
                        </SelectContent>
                      </Select>
                      {selectedShadow.shadowStyle !== "none" && (
                        <>
                          <div>
                            <Label>עומק ({selectedShadow.shadowDepth})</Label>
                            <Slider
                              className="mt-3"
                              min={1}
                              max={24}
                              step={1}
                              value={[selectedShadow.shadowDepth]}
                              onValueChange={([value]) => applyShadow(selectedLayer.id, { shadowDepth: value })}
                            />
                          </div>
                          <div>
                            <Label>טשטוש ({selectedShadow.shadowBlur}px)</Label>
                            <Slider
                              className="mt-3"
                              min={0}
                              max={40}
                              step={1}
                              value={[selectedShadow.shadowBlur]}
                              onValueChange={([value]) => applyShadow(selectedLayer.id, { shadowBlur: value })}
                            />
                          </div>
                          <div>
                            <Label>צבע הצללה</Label>
                            <Input
                              className="mt-1 h-9"
                              type="color"
                              value={selectedShadow.shadowColor}
                              onChange={(event) => applyShadow(selectedLayer.id, { shadowColor: event.target.value })}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
