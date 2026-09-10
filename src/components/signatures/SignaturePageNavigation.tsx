import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SignaturePageNavigation({ page, count, onChange }: {
  page: number; count: number; onChange: (page: number) => void;
}) {
  if (count <= 1) return null;
  return (
    <nav aria-label="ניווט בין עמודי המסמך" className="flex items-center justify-center gap-2 py-3" dir="rtl">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronRight className="h-4 w-4" /> הקודם
      </Button>
      <span className="text-sm text-muted-foreground" aria-live="polite">עמוד {page} מתוך {count}</span>
      <Button type="button" size="sm" variant="outline" disabled={page >= count} onClick={() => onChange(page + 1)}>
        הבא <ChevronLeft className="h-4 w-4" />
      </Button>
    </nav>
  );
}
