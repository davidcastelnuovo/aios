import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon } from "lucide-react";

interface Props {
  pipelineId: string;
  clientId: string;
  onSelectItem?: (id: string) => void;
}

export function MarketingCalendarView({ pipelineId, onSelectItem }: Props) {
  const { data: items } = useQuery({
    queryKey: ["marketing-items-calendar", pipelineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("marketing_work_items")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .eq("pipeline_id", pipelineId)
        .order("scheduled_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {(items ?? []).map((item: any) => {
          const imageUrl = item.payload?.image_url;
          const copy = item.payload?.copy_text;
          return (
            <Card
              key={item.id}
              className="cursor-pointer overflow-hidden p-0 transition-all hover:shadow-lg"
              onClick={() => onSelectItem?.(item.id)}
            >
              {imageUrl && (
                <img src={imageUrl} alt={item.title ?? ""} className="h-40 w-full object-cover" />
              )}
              <div className="p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3" />
                  {item.scheduled_date
                    ? format(new Date(item.scheduled_date), "dd/MM/yyyy")
                    : "לא תוזמן"}
                  <Badge variant="outline" className="ms-auto text-[10px]">
                    {item.status}
                  </Badge>
                </div>
                <div className="font-medium">{item.title ?? "ללא כותרת"}</div>
                {copy && (
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground whitespace-pre-wrap">
                    {copy}
                  </p>
                )}
                <div className="mt-2 text-[10px] text-muted-foreground">
                  שלב: {item.marketing_pipeline_stages?.name ?? "—"}
                </div>
              </div>
            </Card>
          );
        })}
        {(items?.length ?? 0) === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            אין פריטי תוכן עדיין. הוסף פריט חדש מהפס.
          </div>
        )}
      </div>
    </div>
  );
}
