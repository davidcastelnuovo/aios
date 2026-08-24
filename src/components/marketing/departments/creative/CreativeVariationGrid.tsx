import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import { cn } from "@/lib/utils";
import { Loader2, PenLine, RotateCcw, ThumbsDown, Trash2, WandSparkles } from "lucide-react";
import type { CreativeVariation } from "./types";
import { aspectRatioClass } from "./utils";
import { styleLabelForId } from "./designedLayers";

interface Props {
  variations: CreativeVariation[];
  generatingId?: string | null;
  progressLabel?: string;
  disabled?: boolean;
  onEdit: (variation: CreativeVariation) => void;
  onDelete: (variation: CreativeVariation) => void;
  onRegenerate: (variation: CreativeVariation) => void;
  onReject: (variation: CreativeVariation) => void;
}

export function CreativeVariationGrid({
  variations,
  generatingId,
  progressLabel,
  disabled,
  onEdit,
  onDelete,
  onRegenerate,
  onReject,
}: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-4" dir="rtl">
      {progressLabel && (
        <p className="mb-3 text-center text-xs text-muted-foreground">{progressLabel}</p>
      )}
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {variations.map((variation) => {
          const busy = generatingId === variation.id;
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
                onClick={() => onEdit(variation)}
              >
                <CreativeImage src={variation.imageUrl} alt={variation.name} className="absolute inset-0 h-full w-full object-cover" />
                {variation.rejected && (
                  <span className="absolute inset-x-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[10px] text-white">נדחה</span>
                )}
              </button>
              <div className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{variation.copyLabel || variation.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{variation.name}</div>
                  </div>
                  {variation.visualStyle && <Badge variant="outline">{styleLabelForId(variation.visualStyle)}</Badge>}
                </div>
                {variation.rejectNote && (
                  <p className="line-clamp-2 text-[11px] text-destructive">רג׳קט: {variation.rejectNote}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onEdit(variation)} disabled={disabled}>
                    <PenLine className="h-3.5 w-3.5" />ערוך
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onRegenerate(variation)} disabled={disabled}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    ג׳נרט
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => onReject(variation)} disabled={disabled}>
                    <ThumbsDown className="h-3.5 w-3.5" />רג׳קט
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive" onClick={() => onDelete(variation)} disabled={disabled}>
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
