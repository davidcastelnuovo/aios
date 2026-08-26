import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Loader2, Pencil, PenLine, Sparkles, Trash2 } from "lucide-react";
import { copyBlockLabel, type StoredCopyVariation } from "@/components/marketing/departments/creative/copyVariations";

interface Props {
  variations: StoredCopyVariation[];
  generating?: boolean;
  canGenerateFromConcepts?: boolean;
  approvedConceptCount?: number;
  onToggleApprove: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onGenerateFromConcepts?: () => void;
  onCancelGenerate?: () => void;
}

const previewLines = (text: string) => {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const withoutHeader = /^(?:וריאציה|variation)\s*\d+/i.test(lines[0] ?? "") ? lines.slice(1) : lines;
  return withoutHeader
    .filter((line) => !/^(כותרת|CTA|רציונל|גוף|הצעה)\s*:?\s*$/i.test(line))
    .slice(0, 6)
    .join("\n");
};

export function CopyVariationsPanel({
  variations,
  generating,
  canGenerateFromConcepts,
  approvedConceptCount = 0,
  onToggleApprove,
  onEdit,
  onDelete,
  onGenerateFromConcepts,
  onCancelGenerate,
}: Props) {
  const approvedCount = variations.filter((item) => item.approved).length;

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
            קופי לפי הקונספטים שאושרו. עיפרון לעריכה, פח למחיקה
          </p>
        </div>
        {onGenerateFromConcepts && (
          generating ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={onCancelGenerate}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              בטל
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={onGenerateFromConcepts}
              disabled={!canGenerateFromConcepts}
              title={canGenerateFromConcepts ? undefined : "אשרו לפחות קונספט אחד"}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {variations.length ? "עוד קופי" : "כתבו קופי לקונספטים"}
            </Button>
          )
        )}
      </div>

      {variations.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <PenLine className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {generating
              ? "כרמן כותבת קופי לקונספטים שאושרו"
              : approvedConceptCount > 0
                ? `אשרו ${approvedConceptCount} קונספטים — כתבו להם קופי`
                : "אשרו קונספט, ואז כתבו לו קופי"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {variations.map((item) => {
            const preview = previewLines(item.text);
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border p-3 text-right transition-colors",
                  item.approved
                    ? "border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300"
                    : "bg-muted/20",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto">
                      {copyBlockLabel(item)}
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(item.id)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      aria-label={`ערוך וריאציה ${item.key}`}
                      title="ערוך וריאציה זו בלבד"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`מחק וריאציה ${item.key}`}
                      title="מחק וריאציה זו"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleApprove(item.id)}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                        item.approved
                          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-label={item.approved ? "בטל אישור וריאציה" : "אשר וריאציה"}
                      title={item.approved ? "מאושר — לחץ לביטול" : "לחץ לאישור"}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleApprove(item.id)}
                  className="w-full text-right"
                >
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
                    {item.approved ? "מאושר להעברה" : "לחצו לאישור"}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
