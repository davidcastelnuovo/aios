import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Props {
  itemId: string | null;
  onClose: () => void;
}

export function WorkItemSidePanel({ itemId, onClose }: Props) {
  const [item, setItem] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("*")
        .eq("id", itemId)
        .single();
      setItem(data);
      if (data?.pipeline_id) {
        const { data: st } = await supabase
          .from("marketing_pipeline_stages")
          .select("id, name, stage_type, sort_order")
          .eq("pipeline_id", data.pipeline_id)
          .order("sort_order");
        setStages(st ?? []);
      }
    })();
  }, [itemId]);

  if (!itemId) return null;

  const save = async (patch: Partial<any>) => {
    setSaving(true);
    const { error } = await supabase.from("marketing_work_items").update(patch).eq("id", itemId);
    if (error) {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    } else {
      setItem({ ...item, ...patch });
    }
    setSaving(false);
  };

  return (
    <Sheet open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-[480px] sm:max-w-none" dir="rtl">
        <SheetHeader>
          <SheetTitle>פריט תוכן</SheetTitle>
        </SheetHeader>
        {!item ? (
          <div className="py-8 text-center text-sm text-muted-foreground">טוען...</div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <Label>כותרת</Label>
              <Input
                defaultValue={item.title ?? ""}
                onBlur={(e) => save({ title: e.target.value })}
              />
            </div>
            <div>
              <Label>שלב נוכחי</Label>
              <Select
                value={item.current_stage_id ?? ""}
                onValueChange={(v) => save({ current_stage_id: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>ערוץ יעד</Label>
              <Select
                value={item.target_channel ?? ""}
                onValueChange={(v) => save({ target_channel: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר ערוץ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid_ads">קמפיין ממומן</SelectItem>
                  <SelectItem value="seo_geo">SEO / GEO</SelectItem>
                  <SelectItem value="organic_social">סושיאל אורגני</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>קופי</Label>
              <Textarea
                rows={5}
                defaultValue={item.payload?.copy_text ?? ""}
                onBlur={(e) =>
                  save({ payload: { ...(item.payload ?? {}), copy_text: e.target.value } })
                }
              />
            </div>
            <div>
              <Label>הערות</Label>
              <Textarea
                rows={3}
                defaultValue={item.payload?.notes ?? ""}
                onBlur={(e) =>
                  save({ payload: { ...(item.payload ?? {}), notes: e.target.value } })
                }
              />
            </div>
            <div className="pt-2 text-xs text-muted-foreground">
              {saving ? "שומר..." : "שינויים נשמרים אוטומטית"}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
