import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wrench, Search } from "lucide-react";
import { AGENT_TOOLS_CATALOG as ALL_TOOLS } from "@/lib/agentToolsCatalog";

export function ToolsTab({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(agent.allowed_tools || []));
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSelected(new Set(agent.allowed_tools || []));
  }, [agent.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("ai_agents")
        .update({ allowed_tools: Array.from(selected) })
        .eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("הכלים נשמרו");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    setSelected(next);
  };

  const filtered = ALL_TOOLS.filter(t =>
    !search || t.label.includes(search) || t.name.includes(search.toLowerCase())
  );
  const groups: Record<string, typeof ALL_TOOLS> = {};
  for (const t of filtered) (groups[t.group] ||= []).push(t);

  const allSelected = selected.size === 0; // empty = all allowed (legacy behavior)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wrench className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">כלים מאופשרים</h3>
        <Badge variant="outline">{allSelected ? "כל הכלים" : `${selected.size} נבחרו`}</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
          אפשר הכל
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "שומר..." : "שמור"}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="חיפוש כלי..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9" />
      </div>

      <div className="space-y-3">
        {Object.entries(groups).map(([group, tools]) => (
          <Card key={group} className="p-3">
            <h4 className="text-sm font-medium mb-2 text-muted-foreground">{group}</h4>
            <div className="grid grid-cols-2 gap-2">
              {tools.map(t => (
                <label key={t.name} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={selected.size === 0 || selected.has(t.name)}
                    onCheckedChange={() => toggle(t.name)}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
