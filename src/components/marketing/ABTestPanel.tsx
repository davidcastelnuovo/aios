import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Trophy, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// A/B Test Panel — shows copy variants for a work item and lets the user
// select the winning variant to advance the pipeline stage.

interface ABTestPanelProps {
  workItemId: string;
  tenantId: string;
  brief: string;
  channel: string;
  onVariantSelected: (variant: any) => void;
}

export function ABTestPanel({ workItemId, tenantId, brief, channel, onVariantSelected }: ABTestPanelProps) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);

  const { data: variants = [], isLoading, refetch } = useQuery({
    queryKey: ["ab-test-variants", workItemId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_ab_variants" as any)
        .select("*")
        .eq("work_item_id", workItemId)
        .order("created_at", { ascending: true });
      return (data as any[]) || [];
    },
    enabled: !!workItemId,
  });

  const selectVariant = useMutation({
    mutationFn: async (variant: any) => {
      const { error } = await supabase
        .from("marketing_ab_variants" as any)
        .update({ selected: true })
        .eq("id", variant.id);
      if (error) throw error;
    },
    onSuccess: (_, variant) => {
      toast.success("גרסה נבחרה!");
      queryClient.invalidateQueries({ queryKey: ["ab-test-variants", workItemId] });
      onVariantSelected(variant);
    },
    onError: (e: any) => toast.error("שגיאה: " + e.message),
  });

  const generateVariants = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("marketing-run-stage", {
        body: { work_item_id: workItemId, tenant_id: tenantId, stage: "ab_test", brief, channel },
      });
      if (error) throw error;
      toast.success("גרסאות נוצרו!");
      await refetch();
    } catch (e: any) {
      toast.error("שגיאה ביצירת גרסאות: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <Button onClick={generateVariants} disabled={generating} variant="outline" size="sm" className="gap-1.5">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {variants.length > 0 ? "צור גרסאות חדשות" : "צור גרסאות A/B"}
        </Button>
        <div className="text-right">
          <h3 className="font-semibold flex items-center gap-1.5 justify-end">
            <Sparkles className="h-4 w-4 text-orange-500" />בחירת גרסת קופי
          </h3>
          <p className="text-xs text-muted-foreground">בחר את הגרסה הטובה ביותר להמשיך</p>
        </div>
      </div>

      {variants.length === 0 && !generating && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          לחץ על "צור גרסאות A/B" כדי לייצר אפשרויות קופי
        </div>
      )}

      <div className="space-y-3">
        {variants.map((v: any, i: number) => (
          <Card key={v.id} className={`p-4 space-y-2 ${v.selected ? "border-emerald-500 bg-emerald-50/30" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-2">
                {v.selected && <Badge className="bg-emerald-500/15 text-emerald-700">✓ נבחר</Badge>}
                <Badge variant="outline">גרסה {i + 1}</Badge>
              </div>
              {!v.selected && (
                <Button
                  size="sm"
                  onClick={() => selectVariant.mutate(v)}
                  disabled={selectVariant.isPending}
                  className="gap-1.5 shrink-0"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  בחר גרסה זו
                </Button>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{v.content || v.copy || v.text}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
