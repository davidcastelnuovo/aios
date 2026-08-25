import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { splitCopyVariations } from "@/components/marketing/departments/creative/copyVariations";
import {
  costSourceLabel,
  formatTokens,
  formatUsd,
  type CostTotals,
  type ImageGenerationCost,
} from "@/components/marketing/departments/creative/imageCost";
import type { CreativeItem } from "@/components/marketing/departments/creative/types";
import { defaultFormat, getBriefText, getLinkedCopyText, getProjectType, getStoryboard, isLiveTextLayers } from "@/components/marketing/departments/creative/utils";
import { imageSizeForFormat } from "@/components/marketing/departments/creative/visualStyles";
import { estimateCreativeImageCall } from "@/components/marketing/lib/generateCreativeImage";

export interface ProjectCostRow {
  item: CreativeItem;
  spent: CostTotals;
  next: ImageGenerationCost;
  nextCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ProjectCostRow[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function buildNextGenerateEstimate(item: CreativeItem): { cost: ImageGenerationCost; count: number } {
  const format = defaultFormat(item.payload);
  const size = imageSizeForFormat(format);
  const isVideo = getProjectType(item.payload) === "video";
  const copyBlocks = splitCopyVariations(getLinkedCopyText(item));
  const missingFrames = getStoryboard(item.payload).filter((frame) => !frame.imageUrl).length;
  const count = isVideo
    ? Math.max(missingFrames, 1)
    : Math.max(copyBlocks.length, 1);
  const sample = [
    copyBlocks[0]?.text || getLinkedCopyText(item),
    getBriefText(item),
    String(item.title ?? ""),
    "IRON RULE style lock composition constraints reserved logo pad RTL",
  ].filter(Boolean).join("\n");
  return {
    count,
    cost: estimateCreativeImageCall({
      prompt: sample,
      quality: isVideo ? "medium" : "high",
      size,
      liveTextLayers: isVideo || isLiveTextLayers(item.payload),
    }),
  };
}

export function CreativeCostDialog({ open, onOpenChange, rows, selectedId, onSelect }: Props) {
  const spent = rows.reduce((sum, row) => sum + row.spent.costUsd, 0);
  const tokens = rows.reduce((sum, row) => sum + row.spent.tokens, 0);
  const images = rows.reduce((sum, row) => sum + row.spent.images, 0);
  const selected = rows.find((row) => row.item.id === selectedId) ?? rows[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0" dir="rtl">
        <DialogHeader className="border-b px-5 py-4 text-right">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Coins className="h-4 w-4 text-amber-600" />
            עלות טוקנים לפי פרויקט
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground">
            gpt-image-1 לפי מחירון רשמי. כשה־API מחזיר usage זה מדויק; אחרת הערכה לפי איכות, גודל ואורך הפרומפט.
          </p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 border-b px-5 py-3 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground">תמונות שנוצרו</div>
            <div className="text-lg font-semibold">{images}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">טוקנים</div>
            <div className="text-lg font-semibold">{formatTokens(tokens)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">עלות מצטברת</div>
            <div className="text-lg font-semibold">{formatUsd(spent)}</div>
          </div>
        </div>

        <ScrollArea className="max-h-[52vh]">
          <div className="divide-y">
            {rows.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">אין פרויקטים בתצוגה</p>
            ) : rows.map((row) => {
              const nextUsd = row.next.costUsd * row.nextCount;
              const nextTokens = row.next.totalTokens * row.nextCount;
              const active = row.item.id === selected?.item.id;
              return (
                <button
                  key={row.item.id}
                  type="button"
                  onClick={() => onSelect?.(row.item.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 px-5 py-3 text-right transition-colors hover:bg-muted/40",
                    active && "bg-amber-50 dark:bg-amber-950/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{row.item.title || "ללא כותרת"}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.spent.images} תמונות · {costSourceLabel(row.spent)}
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-sm font-semibold">{formatUsd(row.spent.costUsd)}</div>
                      <div className="text-[10px] text-muted-foreground">{formatTokens(row.spent.tokens)} tok</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    הג׳נרציה הבאה ({row.nextCount}×): {formatUsd(nextUsd)} · {formatTokens(nextTokens)} tok
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {selected && (
          <div className="border-t bg-muted/20 px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-5 text-[10px]">{selected.item.title || "פרויקט"}</Badge>
              <span>
                high 1:1 = {formatUsd(0.1664)} פלט · 9:16/4:5 = {formatUsd(0.2496)} פלט · פרומפט ורפרנס מתווספים
              </span>
            </div>
            קריאייטיב סטטי רץ ב־high. סטוריבורד רץ ב־medium אלא אם נשמר אחרת.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
