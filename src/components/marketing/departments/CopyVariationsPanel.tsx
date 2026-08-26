import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, PenLine } from "lucide-react";
import { copyBlockLabel, type StoredCopyVariation } from "@/components/marketing/departments/creative/copyVariations";

interface Props {
  variations: StoredCopyVariation[];
  onToggleApprove: (id: string) => void;
}

const previewLines = (text: string) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const withoutHeader = /^(?:וריאציה|variation)\s*\d+/i.test(lines[0] ?? "") ? lines.slice(1) : lines;
  return withoutHeader
    .filter((line) => !/^(כותרת|CTA|רציונל|גוף|הצעה)\s*:?\s*$/i.test(line))
    .slice(0, 6)
    .join("\n");
};

export function CopyVariationsPanel({ variations, onToggleApprove }: Props) {
  const approvedCount = variations.filter((item) => item.approved).length;
  if (variations.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm" dir="rtl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <PenLine className="h-3.5 w-3.5" />
            <span>וריאציות קופי</span>
            {approvedCount > 0 && (
              <Badge variant="secondary" className="font-normal">{approvedCount} אושרו</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            אשרו קופי אחד־אחד, ואז שייכו כל קונספט לוריאציה מאושרת
          </p>
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {variations.map((item) => {
          const preview = previewLines(item.text);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggleApprove(item.id)}
              className={cn(
                "rounded-xl border p-3 text-right transition-colors",
                item.approved
                  ? "border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300"
                  : "bg-muted/20 hover:bg-muted/40",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto">
                    {copyBlockLabel(item)}
                  </div>
                </div>
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  item.approved ? "border-emerald-600 bg-emerald-600 text-white" : "text-muted-foreground",
                )}>
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
              {item.headline && (
                <p className="text-xs font-medium leading-relaxed [unicode-bidi:plaintext]" dir="auto">{item.headline}</p>
              )}
              {preview && preview !== item.headline && (
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground [unicode-bidi:plaintext]" dir="auto">
                  {preview}
                </p>
              )}
              {item.cta && item.cta !== item.headline && (
                <p className="mt-1 text-[11px] text-muted-foreground [unicode-bidi:plaintext]" dir="auto">CTA: {item.cta}</p>
              )}
              <div className="mt-2 text-[10px] font-medium text-muted-foreground">
                {item.approved ? "מאושר לשיוך לקונספט" : "לחצו לאישור"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
