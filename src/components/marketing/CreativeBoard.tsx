import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  clientId: string;
  onSelectItem?: (id: string) => void;
}

export function CreativeBoard({ clientId, onSelectItem }: Props) {
  const { data: assets } = useQuery({
    queryKey: ["marketing-creative-board", clientId],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("marketing_work_items")
        .select("id")
        .eq("client_id", clientId);
      const ids = (items ?? []).map((i: any) => i.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("marketing_assets")
        .select("*, marketing_pipeline_stages(name, stage_type)")
        .in("item_id", ids)
        .in("type", ["image", "video"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-4">
      {(assets ?? []).length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          אין קריאייטיב עדיין. הפעל את שלב הקריאייטיב על פריט תוכן.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {(assets ?? []).map((a: any) => (
            <Card
              key={a.id}
              className="cursor-pointer overflow-hidden p-0 hover:shadow-lg"
              onClick={() => onSelectItem?.(a.item_id)}
            >
              {a.url && <img src={a.url} alt="" className="aspect-square w-full object-cover" />}
              <div className="p-2 text-xs">
                <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                <div className="mt-1 text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString("he-IL")}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
