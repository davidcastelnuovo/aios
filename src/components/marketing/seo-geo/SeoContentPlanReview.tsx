import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

export type ContentPlanItem = {
  title?: string;
  contentType?: string;
  primaryKeyword?: string;
  cluster?: string;
  intent?: string;
  angle?: string;
  geoQuestions?: string[];
  priority?: string;
  status?: string;
};

type SeoPlan = { contentPlan?: ContentPlanItem[]; clusters?: unknown[]; strategy?: Record<string, string> };

interface Props {
  workItemId: string;
  payload: Record<string, unknown> | null;
  onUpdated: () => void;
  onApproved?: () => void;
}

export function SeoContentPlanReview({ workItemId, payload, onUpdated, onApproved }: Props) {
  const plan = (payload?.seo_plan ?? null) as SeoPlan | null;
  const planStatus = String(payload?.seo_plan_status ?? "pending");
  const [items, setItems] = useState<ContentPlanItem[]>([]);
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [revising, setRevising] = useState(false);

  useEffect(() => {
    setItems([...(plan?.contentPlan ?? [])]);
  }, [plan?.contentPlan, workItemId]);

  const approved = planStatus === "approved";

  const savePlan = async (nextItems: ContentPlanItem[], extraPayload?: Record<string, unknown>) => {
    setSaving(true);
    try {
      const nextPlan = { ...(plan ?? {}), contentPlan: nextItems };
      const { error } = await supabase.from("marketing_work_items").update({
        payload: {
          ...(payload ?? {}),
          seo_plan: nextPlan,
          ...extraPayload,
        },
      }).eq("id", workItemId);
      if (error) throw error;
      toast.success("תוכנית התוכן נשמרה");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const approve = () => savePlan(items, { seo_plan_status: "approved" }).then(() => onApproved?.());

  const reviseWithCarmen = async () => {
    if (!feedback.trim()) {
      toast.error("כתוב הערות לכרמן לפני שליחה");
      return;
    }
    setRevising(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-seo-plan", {
        body: {
          item_id: workItemId,
          mode: "fill",
          prompt: feedback.trim(),
          horizon_months: Number(payload?.seo_horizon_months ?? 3),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      await supabase.from("marketing_work_items").update({
        payload: {
          ...(payload ?? {}),
          seo_plan_status: "pending",
          seo_plan_feedback: feedback.trim(),
        },
      }).eq("id", workItemId);
      toast.success("כרמן עדכנה את התוכנית — בדוק ואשר");
      setFeedback("");
      onUpdated();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "עדכון תוכנית נכשל");
    } finally {
      setRevising(false);
    }
  };

  const research = useMemo(() => {
    const r = payload?.seo_research;
    if (!r || typeof r !== "object") return null;
    const o = r as Record<string, unknown>;
    return {
      seeds: Array.isArray(o.keyword_seeds) ? (o.keyword_seeds as string[]) : [],
      competitors: Array.isArray(o.competitors) ? (o.competitors as string[]) : [],
    };
  }, [payload]);

  if (!plan?.contentPlan?.length) {
    return (
      <Card className="m-4 p-6 text-center text-sm text-muted-foreground">
        אין תוכנית תוכן עדיין — השלימי intake ומחקר, ואז כרמן תציע תוכנית כאן.
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">תוכנית תוכן — אישור לפני גאנט</h3>
          <p className="text-[11px] text-muted-foreground">עריכה ידנית, הערות לכרמן, או אישור והמשך לגאנט וכתיבה</p>
        </div>
        <Badge variant="outline" className={approved ? "border-emerald-500 text-emerald-800" : "border-amber-400 text-amber-800"}>
          {approved ? "אושרה" : "ממתינה לאישור"}
        </Badge>
      </div>

      {research && (research.seeds.length > 0 || research.competitors.length > 0) && (
        <Card className="p-3 text-xs">
          <div className="font-semibold text-emerald-800">מחקר intake</div>
          {research.seeds.length > 0 && <p className="mt-1">ביטויים: {research.seeds.slice(0, 12).join(" · ")}</p>}
          {research.competitors.length > 0 && <p className="mt-1 text-muted-foreground">מתחרים: {research.competitors.join(", ")}</p>}
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <Card key={index} className="grid gap-2 p-3 md:grid-cols-[1fr_120px]">
            <div className="space-y-2">
              <Input value={item.title ?? ""} placeholder="כותרת מאמר" onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], title: e.target.value };
                setItems(next);
              }} />
              <div className="grid grid-cols-2 gap-2">
                <Input value={item.primaryKeyword ?? ""} placeholder="ביטוי ראשי" dir="rtl" onChange={(e) => {
                  const next = [...items];
                  next[index] = { ...next[index], primaryKeyword: e.target.value };
                  setItems(next);
                }} />
                <Input value={item.contentType ?? ""} placeholder="סוג (pillar/article…)" onChange={(e) => {
                  const next = [...items];
                  next[index] = { ...next[index], contentType: e.target.value };
                  setItems(next);
                }} />
              </div>
              <Textarea className="min-h-14 text-xs" value={item.angle ?? ""} placeholder="זווית / GEO" onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], angle: e.target.value };
                setItems(next);
              }} />
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="ghost" size="icon" className="self-end" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <Badge variant="secondary">{item.priority ?? "medium"}</Badge>
            </div>
          </Card>
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setItems([...items, { title: "", primaryKeyword: "", contentType: "article", priority: "medium" }])}>
          <Plus className="h-3.5 w-3.5" />הוסף פריט
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={saving} variant="secondary" className="gap-1" onClick={() => savePlan(items)}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}שמור עריכה ידנית
        </Button>
        {!approved && (
          <Button disabled={saving} className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={approve}>
            <CheckCircle2 className="h-4 w-4" />אשר תוכנית תוכן
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-muted/20 p-3">
        <Label className="text-xs">הערות לכרמן — תיקון תוכנית</Label>
        <Textarea className="mt-1 min-h-20 text-sm" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="לדוגמה: פחות מאמרים informational, יותר commercial, הוסף cluster ל…" />
        <Button className="mt-2 gap-1" variant="outline" disabled={revising} onClick={reviseWithCarmen}>
          {revising ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}כרמן — עדכן לפי ההערות
        </Button>
      </div>
    </div>
  );
}
