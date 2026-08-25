import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Lightbulb, Loader2, Sparkles } from "lucide-react";
import type { CopyConcept } from "@/components/marketing/copyConcepts";

interface Props {
  concepts: CopyConcept[];
  generating: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onToggleApprove: (id: string) => void;
}

export function CopyConceptsPanel({
  concepts,
  generating,
  canGenerate,
  onGenerate,
  onToggleApprove,
}: Props) {
  const approvedCount = concepts.filter((concept) => concept.approved).length;

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
            אשרו קונספט ולחצו לקריאייטיב — אפשר לשייך לפרויקט קיים של הלקוח או לפתוח חדש
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={onGenerate}
          disabled={generating || !canGenerate}
        >
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {concepts.length ? "צור קונספטים מחדש" : "צור קונספטים"}
        </Button>
      </div>

      {concepts.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <Lightbulb className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {canGenerate
              ? "כרמן תציע 3 כיוונים ויזואליים שונים מהקופי והבריף"
              : "כתבו קופי או בריף, ואז צרו קונספטים"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 md:grid-cols-3">
          {concepts.map((concept) => (
            <button
              key={concept.id}
              type="button"
              onClick={() => onToggleApprove(concept.id)}
              className={cn(
                "rounded-xl border p-3 text-right transition-colors",
                concept.approved
                  ? "border-emerald-400 bg-emerald-50/70 ring-1 ring-emerald-300"
                  : "bg-muted/20 hover:bg-muted/40",
              )}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto">{concept.name}</div>
                  {concept.reference && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">רפרנס: {concept.reference}</div>
                  )}
                </div>
                <span className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  concept.approved ? "border-emerald-600 bg-emerald-600 text-white" : "text-muted-foreground",
                )}>
                  <Check className="h-3.5 w-3.5" />
                </span>
              </div>
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
              <div className="mt-2 text-[10px] font-medium text-muted-foreground">
                {concept.approved ? "מאושר להעברה" : "לחצו לאישור"}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
