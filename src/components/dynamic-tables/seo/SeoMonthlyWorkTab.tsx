import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, subMonths } from "date-fns";
import { he } from "date-fns/locale";
import { FileText, Link2, Loader2, Plus, Save, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ONSITE_KIND_LABELS,
  SeoArticleItem,
  SeoLinkItem,
  SeoMonthlyWork,
  SeoOnsiteItem,
  SeoOnsiteKind,
  createArticleItem,
  createLinkItem,
  createOnsiteItem,
  emptySeoMonthlyWork,
  parseSeoMonthlyWork,
  sanitizeSeoMonthlyWork,
} from "@/lib/seoMonthlyWork";

type Props = {
  clientId: string;
  /** Prefer the SEO report tenant (shared-agency aware). Falls back to current tenant. */
  tenantId?: string;
};

export function SeoMonthlyWorkTab({ clientId, tenantId: tenantIdProp }: Props) {
  const { tenantId: currentTenantId } = useCurrentTenant();
  const { user } = useCurrentUser();
  const tenantId = tenantIdProp || currentTenantId || "";
  const queryClient = useQueryClient();

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const d = startOfMonth(subMonths(new Date(), i));
        return {
          value: format(d, "yyyy-MM-dd"),
          label: format(d, "MMMM yyyy", { locale: he }),
        };
      }),
    [],
  );

  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [status, setStatus] = useState<"up" | "stable" | "down">("stable");
  const [work, setWork] = useState<SeoMonthlyWork>(emptySeoMonthlyWork());
  const [dirty, setDirty] = useState(false);

  const { data: row, isLoading, isFetching } = useQuery({
    queryKey: ["seo-monthly-work", clientId, tenantId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("seo_monthly_updates")
        .select("id, month, status, notes, work")
        .eq("client_id", clientId)
        .eq("tenant_id", tenantId)
        .eq("month", selectedMonth)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        month: string;
        status: "up" | "stable" | "down";
        notes: string | null;
        work: unknown;
      } | null;
    },
    enabled: !!clientId && !!tenantId && !!selectedMonth,
  });

  useEffect(() => {
    if (isFetching) return;
    if (!row) {
      setStatus("stable");
      setWork(emptySeoMonthlyWork());
      setDirty(false);
      return;
    }
    setStatus(row.status || "stable");
    const parsed = parseSeoMonthlyWork(row.work);
    // Backfill summary from legacy free-text notes when work.summary is empty
    if (!parsed.summary && row.notes) parsed.summary = row.notes;
    setWork(parsed);
    setDirty(false);
  }, [row, isFetching, selectedMonth]);

  const patchWork = (updater: (prev: SeoMonthlyWork) => SeoMonthlyWork) => {
    setWork((prev) => updater(prev));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !user?.id) throw new Error("חסר משתמש או טננט");
      const cleaned = sanitizeSeoMonthlyWork(work);
      const { error } = await (supabase as any)
        .from("seo_monthly_updates")
        .upsert(
          {
            client_id: clientId,
            tenant_id: tenantId,
            month: selectedMonth,
            status,
            notes: cleaned.summary || null,
            work: cleaned,
            updated_by: user.id,
          },
          { onConflict: "client_id,month" },
        );
      if (error) throw error;
      return cleaned;
    },
    onSuccess: (cleaned) => {
      setWork(cleaned);
      setDirty(false);
      toast.success("סיכום העבודה החודשית נשמר");
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-work", clientId, tenantId, selectedMonth] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-history", clientId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-latest", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["seo-monthly-single", clientId] });
    },
    onError: (err: any) => {
      const msg = String(err?.message || "");
      if (msg.includes("work") && (msg.includes("column") || msg.includes("schema"))) {
        toast.error("עמודת העבודה עדיין לא קיימת בפרודקשן — צריך להריץ את המיגרציה seo_monthly_work_jsonb");
        return;
      }
      toast.error(msg || "שגיאה בשמירה");
    },
  });

  const monthLabel = monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              עבודה שבוצעה החודש
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v)}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v as any); setDirty(true); }}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">עלייה ↑</SelectItem>
                  <SelectItem value="stable">יציב →</SelectItem>
                  <SelectItem value="down">ירידה ↓</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                disabled={!dirty || saveMutation.isPending || isLoading}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                שמור
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            סיכום העבודה ל־{monthLabel}: באתר (מטא/כותרות), מאמרים שכתבנו, וקישורים.
            {dirty && <Badge variant="outline" className="mr-2 text-[10px]">יש שינויים שלא נשמרו</Badge>}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-sm">סיכום כללי</Label>
            <Textarea
              value={work.summary || ""}
              onChange={(e) => patchWork((p) => ({ ...p, summary: e.target.value }))}
              placeholder="מה עשינו החודש במשפט־שניים..."
              rows={2}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {(isLoading || isFetching) && !row ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground text-sm gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          טוען...
        </div>
      ) : (
        <>
          <OnsiteSection
            items={work.onsite}
            onChange={(onsite) => patchWork((p) => ({ ...p, onsite }))}
          />
          <ArticlesSection
            items={work.articles}
            onChange={(articles) => patchWork((p) => ({ ...p, articles }))}
          />
          <LinksSection
            items={work.links}
            onChange={(links) => patchWork((p) => ({ ...p, links }))}
          />
        </>
      )}
    </div>
  );
}

function OnsiteSection({
  items,
  onChange,
}: {
  items: SeoOnsiteItem[];
  onChange: (next: SeoOnsiteItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            עבודה באתר
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createOnsiteItem({ kind: "meta" })])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">מטא־תיאורים, כותרות (H1/כותרות מאמרים באתר), ותיקוני תוכן פנימיים.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין פריטי עבודה באתר לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[140px_1fr_1fr_auto]">
              <Select
                value={item.kind}
                onValueChange={(v) => {
                  const next = [...items];
                  next[idx] = { ...item, kind: v as SeoOnsiteKind };
                  onChange(next);
                }}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ONSITE_KIND_LABELS) as SeoOnsiteKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {ONSITE_KIND_LABELS[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-8 text-sm"
                placeholder="מה שונה (למשל: כותרת עמוד שירותים)"
                value={item.title}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, title: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://... (אופציונלי)"
                value={item.url || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ArticlesSection({
  items,
  onChange,
}: {
  items: SeoArticleItem[];
  onChange: (next: SeoArticleItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            מאמרים שכתבנו
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createArticleItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף מאמר
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">כותרת המאמר, נושא, וקישור לפרסום אם יש.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין מאמרים רשומים לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.2fr_1fr_1.2fr_auto]">
              <Input
                className="h-8 text-sm"
                placeholder="כותרת המאמר"
                value={item.title}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, title: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="נושא / פוקוס"
                value={item.topic}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, topic: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://... קישור למאמר"
                value={item.url || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function LinksSection({
  items,
  onChange,
}: {
  items: SeoLinkItem[];
  onChange: (next: SeoLinkItem[]) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            קישורים
            <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange([...items, createLinkItem()])}
          >
            <Plus className="h-3.5 w-3.5" />
            הוסף קישור
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">קישורים שנבנו/הושגו החודש — כתובת, עוגן והערה.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <EmptyHint text="עדיין אין קישורים לחודש הזה" />
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="grid gap-2 rounded-md border p-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
              <Input
                className="h-8 text-sm"
                dir="ltr"
                placeholder="https://..."
                value={item.url}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, url: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="טקסט עוגן"
                value={item.anchor || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, anchor: e.target.value };
                  onChange(next);
                }}
              />
              <Input
                className="h-8 text-sm"
                placeholder="הערה (אופציונלי)"
                value={item.notes || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = { ...item, notes: e.target.value };
                  onChange(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-md">{text}</p>;
}
