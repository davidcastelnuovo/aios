import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Lightbulb, Loader2, Sparkles, Trash2 } from "lucide-react";
import type { CopyConcept } from "@/components/marketing/copyConcepts";
import { copyBlockLabel, type StoredCopyVariation } from "@/components/marketing/departments/creative/copyVariations";

interface Props {
  concepts: CopyConcept[];
  copies: StoredCopyVariation[];
  generating: boolean;
  canGenerate: boolean;
  blockReason?: "need_context";
  lockGenerate?: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onToggleApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onAssignCopy: (conceptId: string, copyId: string) => void;
}

export function CopyConceptsPanel({
  concepts,
  copies,
  generating,
  canGenerate,
  blockReason,
  lockGenerate,
  onGenerate,
  onCancel,
  onToggleApprove,
  onDelete,
  onAssignCopy,
}: Props) {
  const approvedCount = concepts.filter((concept) => concept.approved).length;
  const approvedCopies = copies.filter((item) => item.approved);

  return (
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm" dir="rtl">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>קונספטים לקריאייטיב</span>
            {approvedCount > 0 && (
              <Badge variant="secondary" className="font-normal">{approvedCount} אושרו</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            קודם כיוון ויזואלי. אשרו, ואז כתבו קופי לכל קונספט
          </p>
        </div>
        {generating ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onCancel}
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
            onClick={onGenerate}
            disabled={!canGenerate || lockGenerate}
            title={blockReason === "need_context" ? "הוסיפו שם פרויקט או בריף בהגדרות" : lockGenerate ? "כרמן כותבת קופי" : undefined}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {concepts.length ? "עוד קונספטים" : "צור קונספטים"}
          </Button>
        )}
      </div>

      {concepts.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Lightbulb className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {generating
              ? "כרמן בונה קונספטים ויזואליים"
              : canGenerate
                ? "כרמן תציע 3 כיוונים ויזואליים. אחר כך תכתבו קופי רק למאושרים"
                : "הוסיפו שם פרויקט או בריף בהגדרות, ואז צרו קונספטים"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {concepts.map((concept) => {
            const linked = approvedCopies.find((item) => item.id === concept.copyId)
              ?? copies.find((item) => item.id === concept.copyId || item.key === concept.copyKey);
            const options = [
              ...approvedCopies,
              ...copies.filter((item) => item.id === linked?.id && !item.approved),
            ];
            const uniqueOptions = options.filter((item, index, list) => list.findIndex((row) => row.id === item.id) === index);
            return (
              <div
                key={concept.id}
                className={cn(
                  "rounded-xl border p-3 text-right transition-colors",
                  concept.approved
                    ? "border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300"
                    : "bg-muted/20",
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleApprove(concept.id)}
                    className="min-w-0 flex-1 text-right"
                  >
                    <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto">{concept.name}</div>
                    {concept.reference && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">רפרנס: {concept.reference}</div>
                    )}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDelete(concept.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`מחק קונספט ${concept.name}`}
                      title="מחק קונספט"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleApprove(concept.id)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                        concept.approved
                          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                      aria-label={concept.approved ? "בטל אישור קונספט" : "אשר קונספט"}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleApprove(concept.id)}
                  className="w-full text-right"
                >
                  {concept.bigIdea && <p className="text-xs leading-relaxed [unicode-bidi:plaintext]" dir="auto">{concept.bigIdea}</p>}
                  {concept.visualLanguage && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground [unicode-bidi:plaintext]" dir="auto">
                      ויזואל: {concept.visualLanguage}
                    </p>
                  )}
                  {concept.hook && (
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground [unicode-bidi:plaintext]" dir="auto">
                      הוק: {concept.hook}
                    </p>
                  )}
                </button>
                {copies.length > 0 && (
                  <label className="mt-3 block text-[10px] font-medium text-muted-foreground" onClick={(event) => event.stopPropagation()}>
                    קופי משויך
                    <select
                      className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-xs"
                      value={linked?.id ?? ""}
                      onChange={(event) => onAssignCopy(concept.id, event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <option value="">בחרו וריאציית קופי</option>
                      {uniqueOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {copyBlockLabel(item)}{item.headline ? ` · ${item.headline}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {linked?.headline && (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground [unicode-bidi:plaintext]" dir="auto">
                    {linked.headline}
                  </p>
                )}
                <div className="mt-2 text-[10px] font-medium text-muted-foreground">
                  {concept.approved ? "מאושר — אפשר לכתוב לו קופי" : "לחצו לאישור"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
