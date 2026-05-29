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

const ALL_TOOLS: { name: string; label: string; group: string }[] = [
  { name: "create_lead", label: "יצירת ליד", group: "לידים" },
  { name: "list_leads", label: "צפייה בלידים", group: "לידים" },
  { name: "update_lead_status", label: "עדכון סטטוס ליד", group: "לידים" },
  { name: "add_lead_update", label: "הוספת עדכון לליד", group: "לידים" },
  { name: "create_task", label: "יצירת משימה לצוות", group: "משימות" },
  { name: "create_agent_task", label: "משימה לסוכן עצמו", group: "משימות" },
  { name: "list_tasks", label: "צפייה במשימות", group: "משימות" },
  { name: "search_tasks", label: "חיפוש משימות", group: "משימות" },
  { name: "update_task_status", label: "עדכון סטטוס משימה", group: "משימות" },
  { name: "list_clients", label: "צפייה בלקוחות", group: "לקוחות" },
  { name: "get_client_info", label: "מידע על לקוח", group: "לקוחות" },
  { name: "add_client_update", label: "הוספת עדכון ללקוח", group: "לקוחות" },
  { name: "update_client_health", label: "עדכון Health Score", group: "לקוחות" },
  { name: "send_message", label: "שליחת WhatsApp", group: "תקשורת" },
  { name: "search_entities", label: "חיפוש כללי", group: "כללי" },
  { name: "create_social_post", label: "יצירת פוסט", group: "סושיאל" },
  { name: "generate_ad_image", label: "יצירת תמונה (AI)", group: "סושיאל" },
  { name: "list_campaigners", label: "רשימת קמפיינרים", group: "צוות" },
  { name: "list_sales_people", label: "רשימת אנשי מכירות", group: "צוות" },
  { name: "list_automations", label: "אוטומציות", group: "אוטומציות" },
  { name: "toggle_automation", label: "הפעלה/כיבוי אוטומציה", group: "אוטומציות" },
  { name: "list_integrations", label: "אינטגרציות", group: "אינטגרציות" },
  { name: "get_dashboard_stats", label: "סטטיסטיקות דשבורד", group: "דוחות" },
  { name: "analyze_campaign_performance", label: "ניתוח קמפיינים", group: "דוחות" },
  { name: "get_finance_summary", label: "סיכום כספי", group: "דוחות" },
  { name: "list_agents", label: "רשימת סוכנים", group: "ניהול AI" },
  { name: "create_agent", label: "יצירת סוכן", group: "ניהול AI" },
  { name: "update_agent", label: "עדכון סוכן", group: "ניהול AI" },
  { name: "delegate_to_github_agent", label: "האצלה ל-GitHub Agent", group: "ניהול AI" },
  { name: "save_memory", label: "שמירת זיכרון", group: "זיכרון" },
  { name: "recall_memory", label: "שליפת זיכרון", group: "זיכרון" },
  { name: "kb_search", label: "חיפוש בידע", group: "ידע" },
  { name: "kb_open", label: "פתיחת ידע", group: "ידע" },
  { name: "kb_learn", label: "למידה לזיכרון ארוך", group: "ידע" },
];

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
