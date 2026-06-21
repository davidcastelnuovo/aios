import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";

interface Props {
  pipelineId: string;
  clientId: string;
}

export function MarketingCalendarView({ pipelineId }: Props) {
  const { data: items } = useQuery({
    queryKey: ["marketing-items-calendar", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .eq("pipeline_id", pipelineId)
        .order("scheduled_date", { ascending: true });
      return data ?? [];
    },
  });

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item: any) => (
          <Card key={item.id} className="p-3">
            <div className="text-xs text-muted-foreground">
              {item.scheduled_date
                ? format(new Date(item.scheduled_date), "dd/MM/yyyy")
                : "לא תוזמן"}
            </div>
            <div className="font-medium">{item.title ?? "ללא כותרת"}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {item.marketing_pipeline_stages?.name} · {item.status}
            </div>
          </Card>
        ))}
        {(items?.length ?? 0) === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            אין פריטי תוכן עדיין. הוסף פריט חדש מהפס.
          </div>
        )}
      </div>
    </div>
  );
}
