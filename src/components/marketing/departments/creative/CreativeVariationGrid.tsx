import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { OfferIconMark, isIconLayer } from "./layerMarks";
import { hebrewTextDir, hebrewTextStyle, overlayBoxDir, overlayBoxStyle } from "./rtlText";
import { cn } from "@/lib/utils";
import { Layers, Layers2, Loader2, RotateCcw, Sparkles, ThumbsDown, Trash2, WandSparkles } from "lucide-react";
import type { CreativeVariation } from "./types";
import { aspectRatioClass } from "./utils";
import { isLogoLayer, styleLabelForId } from "./designedLayers";

interface Props {
  variations: CreativeVariation[];
  generatingIds?: string[];
  progressLabel?: string;
  agentUrl?: string | null;
  liveTextLayers?: boolean;
  onRevise: (variation: CreativeVariation) => void;
  onEditLayers?: (variation: CreativeVariation) => void;
  onDelete: (variation: CreativeVariation) => void;
  onRegenerate: (variation: CreativeVariation) => void;
  onReject: (variation: CreativeVariation) => void;
  onExpandStyle?: (variation: CreativeVariation) => void;
  remainingCopyCount?: (variation: CreativeVariation) => number;
}

export function CreativeVariationGrid({
  variations,
  generatingIds,
  progressLabel,
  agentUrl,
  liveTextLayers,
  onRevise,
  onEditLayers,
  onDelete,
  onRegenerate,
  onReject,
  onExpandStyle,
  remainingCopyCount,
}: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4" dir="rtl">
      {(progressLabel || agentUrl) && (
        <p className="mb-3 text-center text-xs text-muted-foreground">
          {progressLabel}
          {agentUrl && (
            <>
              {progressLabel ? " · " : null}
              <a href={agentUrl} target="_blank" rel="noreferrer" className="underline">
                פתח את קריאייטיב דיירקט
              </a>
            </>
          )}
        </p>
      )}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {variations.map((variation) => {
          const busy = generatingIds?.includes(variation.id) ?? false;
          const overlayLayers = (variation.layers ?? []).filter((layer) => {
            if (layer.type === "background") return false;
            if (isLogoLayer(layer) || layer.role === "logo") return false;
            if (liveTextLayers) return true;
            return layer.type === "image";
          });
          return (
            <article
              key={variation.id}
              className={cn(
                "overflow-hidden rounded-2xl border bg-card shadow-sm",
                variation.rejected && "opacity-60",
              )}
            >
              <button
                type="button"
                className={cn("relative block w-full overflow-hidden bg-muted", aspectRatioClass(variation.format))}
                onClick={() => onRevise(variation)}
              >
                <CreativeImage src={variation.imageUrl} alt={variation.name} className="absolute inset-0 h-full w-full object-cover" />
                {overlayLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className="pointer-events-none absolute"
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      width: `${layer.width}%`,
                      height: `${layer.height}%`,
                      display: layer.type === "text" || isIconLayer(layer) ? "flex" : undefined,
                      alignItems: layer.type === "text" || isIconLayer(layer) ? "center" : undefined,
                      ...overlayBoxStyle(layer.textAlign),
                      background: layer.type === "shape" ? layer.fill : undefined,
                      borderRadius: layer.borderRadius,
                      transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                      transformOrigin: "center center",
                      color: layer.color,
                      fontFamily: layer.fontFamily,
                      fontSize: `${Math.max(11, (layer.fontSize ?? 18) * 0.52)}px`,
                      fontWeight: layer.fontWeight,
                      letterSpacing: layer.letterSpacing,
                      lineHeight: layer.lineHeight ?? 0.9,
                      textShadow: layer.textShadow,
                      boxShadow: layer.boxShadow,
                      opacity: layer.opacity,
                    }}
                    dir={layer.type === "text" ? overlayBoxDir : undefined}
                  >
                    {layer.type === "image" && layer.src ? (
                      <CreativeImage src={layer.src} alt="לוגו" className="h-full w-full object-contain" />
                    ) : isIconLayer(layer) ? (
                      <span className="flex h-full w-full items-center justify-center rounded-full border-2" style={{ borderColor: layer.color || layer.fill || "#dc2626" }}>
                        <OfferIconMark name={layer.icon} color={layer.color || layer.fill} className="h-[62%] w-[62%]" />
                      </span>
                    ) : layer.type === "text" ? (
                      <span dir={hebrewTextDir} className="block w-full overflow-hidden whitespace-pre-wrap break-words px-0.5" style={hebrewTextStyle(layer.textAlign)}>{layer.text}</span>
                    ) : null}
                  </div>
                ))}
                {busy && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </span>
                )}
                {variation.rejected && (
                  <span className="absolute inset-x-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">נדחה</span>
                )}
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{variation.copyLabel || variation.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{variation.name}</div>
                    {variation.conceptName && (
                      <div className="mt-0.5 truncate text-[11px] text-emerald-700">{variation.conceptName}</div>
                    )}
                  </div>
                  {variation.visualStyle && <Badge variant="outline">{styleLabelForId(variation.visualStyle)}</Badge>}
                </div>
                {variation.rejectNote && (
                  <p className="line-clamp-2 text-[11px] text-destructive">רג׳קט: {variation.rejectNote}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onRevise(variation)}>
                    <Sparkles className="h-3.5 w-3.5" />תקן עם Cursor
                  </Button>
                  {liveTextLayers && onEditLayers && (
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onEditLayers(variation)}>
                      <Layers className="h-3.5 w-3.5" />שכבות
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onRegenerate(variation)} disabled={busy}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    ג׳נרט
                  </Button>
                  {onExpandStyle && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      onClick={() => onExpandStyle(variation)}
                      disabled={(remainingCopyCount?.(variation) ?? 0) === 0}
                      title={(remainingCopyCount?.(variation) ?? 0) === 0 ? "כל וריאציות הקופי כבר בגריד" : "צור את שאר הקופי באותו סגנון"}
                    >
                      <Layers2 className="h-3.5 w-3.5" />
                      עוד בסגנון הזה
                      {(remainingCopyCount?.(variation) ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground">{remainingCopyCount?.(variation)}</span>
                      )}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onReject(variation)}>
                    <ThumbsDown className="h-3.5 w-3.5" />רג׳קט
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive" onClick={() => onDelete(variation)}>
                    <Trash2 className="h-3.5 w-3.5" />מחק
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {variations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <WandSparkles className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">עדיין אין וריאציות בגריד</p>
        </div>
      )}
    </div>
  );
}
