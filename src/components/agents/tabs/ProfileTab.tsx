import { useState, useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BrainSelector } from "../BrainSelector";
import { useAgentGoals } from "@/hooks/useAgentGoals";
import { useAgentKnowledge } from "@/hooks/useAgentKnowledge";
import { useAgentMemoryTree, useCarmenMemoryTree } from "@/hooks/useAgentMemory";
import {
  IdCard, Sparkles, Heart, Wrench, Settings, Save, Target,
  BookOpen, Brain, Crown, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function isCarmen(name: string) {
  const n = (name || "").toLowerCase();
  return n.includes("carmen") || name?.includes("כרמן");
}

export function ProfileTab({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const carmen = isCarmen(agent.name);

  const [form, setForm] = useState(() => initialForm(agent));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(initialForm(agent));
    setDirty(false);
  }, [agent.id]);

  const update = (patch: Partial<typeof form>) => {
    setForm(p => ({ ...p, ...patch }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_agents").update(form).eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      setDirty(false);
      toast.success("הפרופיל נשמר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-4xl space-y-4 pb-24">
      {/* ===== Identity card ===== */}
      <Card className="p-5">
        <SectionHeader icon={IdCard} title="זהות" subtitle="מי הסוכן הזה ומה התפקיד שלו" />
        <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr_auto] gap-4 items-end">
          <Field label="שם הסוכן">
            <Input value={form.name} onChange={e => update({ name: e.target.value })} />
          </Field>
          <Field label="תפקיד / מומחיות (talent)">
            <Input
              value={form.talent}
              onChange={e => update({ talent: e.target.value })}
              placeholder="לדוגמה: יועצת CRM בכירה לסוכנויות שיווק"
            />
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <Switch checked={form.active} onCheckedChange={v => update({ active: v })} />
            <Label className="text-sm">פעיל</Label>
          </div>
        </div>
      </Card>

      {/* ===== Personality + Soul ===== */}
      <Card className="p-5">
        <SectionHeader icon={Heart} title="אישיות ונשמה" subtitle="האופי, הטון, ומה מניע את הסוכן" />
        <div className="space-y-4">
          <Field label="אישיות" hint="איך הסוכן מתנהל בשיחה — מה הטון, ההומור, רמת הפורמליות, כיצד מגיב ללחץ">
            <Textarea
              rows={6}
              value={form.personality}
              onChange={e => update({ personality: e.target.value })}
              placeholder="לדוגמה: רגועה, מקצועית, אסרטיבית כשצריך. שואלת שאלות חדות ולא נכנעת לחצי-תשובות..."
            />
          </Field>

          <Field label="נשמה / מטרת קיום" hint="למה הסוכן קיים — המטרה העל-זמנית שלו במערכת">
            <Textarea
              rows={5}
              value={form.soul}
              onChange={e => update({ soul: e.target.value })}
              placeholder="לדוגמה: לוודא שאף לקוח לא נופל בין הכיסאות, ולתת לצוות ראייה בזמן אמת על בריאות תיק הלקוחות..."
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="סגנון כתיבה">
              <Select value={form.writing_style || "none"} onValueChange={v => update({ writing_style: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ברירת מחדל</SelectItem>
                  <SelectItem value="formal">רשמי</SelectItem>
                  <SelectItem value="casual">חברותי</SelectItem>
                  <SelectItem value="professional">מקצועי</SelectItem>
                  <SelectItem value="playful">משחקי</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="אורך תשובה">
              <Select value={form.response_length || "none"} onValueChange={v => update({ response_length: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ברירת מחדל</SelectItem>
                  <SelectItem value="short">קצר (2-3 משפטים)</SelectItem>
                  <SelectItem value="medium">בינוני</SelectItem>
                  <SelectItem value="detailed">מפורט</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="שפה">
              <Select value={form.language} onValueChange={v => update({ language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="he">עברית</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">العربية</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      {/* ===== System Prompt override ===== */}
      <Card className="p-5">
        <SectionHeader
          icon={Sparkles}
          title="הנחיות מערכת (System Prompt)"
          subtitle="טקסט שדורס את הבנייה האוטומטית מהשדות לעיל"
        />

        {/* Built-in baseline instructions (read-only, expandable) */}
        <BuiltInInstructions
          carmen={carmen}
          agentName={agent.name}
          onAppend={(text) => {
            const current = form.system_prompt?.trim() || "";
            update({
              system_prompt: current ? `${current}\n\n${text}` : text,
            });
            toast.success("ההנחיות המובנות הועתקו לעריכה");
          }}
        />

        <Field
          label={
            <span className="flex items-center gap-2">
              System Prompt מותאם
              <span className="text-xs text-muted-foreground font-normal">
                ({form.system_prompt.length.toLocaleString()} תווים)
              </span>
            </span>
          }
          hint="השאר ריק כדי שהמערכת תבנה אוטומטית מהזהות, האישיות, הנשמה, המטרות והידע. הוסף כאן הנחיות נוספות מעבר למובנות."
        >
          <Textarea
            rows={12}
            value={form.system_prompt}
            onChange={e => update({ system_prompt: e.target.value })}
            placeholder="ריק = שימוש בהנחיות המובנות. מלא = החלפת ההנחיות המובנות בטקסט הזה (או הוספה אם תעתיק את המובנות לעיל ותוסיף בסוף)."
            className="font-mono text-xs"
          />
        </Field>
        {form.system_prompt && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>שדה זה דורס את ההנחיות המובנות. אם רוצים להוסיף עליהן — לחצי "העתק לעריכה" למעלה.</span>
          </div>
        )}
      </Card>


      {/* ===== Capabilities summary ===== */}
      <CapabilitiesCard agent={agent} carmen={carmen} />

      {/* ===== Runtime ===== */}
      <Card className="p-5">
        <SectionHeader icon={Settings} title="הגדרות ריצה" subtitle="המוח שבו הסוכן ישתמש ומגבלות תפעוליות" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Field label="המוח (LLM)" hint="ניתן לעדכן כאן או בכותרת">
            <BrainSelector value={agent.engine} onChange={async (engine) => {
              await supabase.from("ai_agents").update({ engine }).eq("id", agent.id);
              qc.invalidateQueries({ queryKey: ["ai-agents"] });
              toast.success("המוח עודכן");
            }} />
          </Field>
          <Field label="מקסימום סבבי כלים (tool rounds)" hint="כמה פעמים הסוכן יכול לקרוא לכלים ברצף">
            <Input
              type="number"
              min={1}
              max={50}
              value={form.max_tool_rounds}
              onChange={e => update({ max_tool_rounds: Number(e.target.value) })}
              className="w-32"
            />
          </Field>
          <Field label="גרסת Prompt" hint="V2 מוסיף חשיבה מובנית, תכנון, ואימות פעולות. V1 = התנהגות נוכחית">
            <Select
              value={form.metadata?.prompt_version || "v1"}
              onValueChange={v => update({ metadata: { ...form.metadata, prompt_version: v } })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="בחר גרסה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="v1">V1 — נוכחי (יציב)</SelectItem>
                <SelectItem value="v2">V2 — חדש (ReAct, חשיבה, אימות)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      {/* ===== Sticky save bar ===== */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-30 transition-all",
          dirty ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        <Card className="px-4 py-3 shadow-lg border-primary/30 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">יש שינויים שלא נשמרו</span>
          <Button size="sm" variant="ghost" onClick={() => { setForm(initialForm(agent)); setDirty(false); }}>
            ביטול
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-4 w-4 me-1" />
            {save.isPending ? "שומר..." : "שמור פרופיל"}
          </Button>
        </Card>
      </div>
    </div>
  );
}

// =========================================================================
// Capabilities card (read-only summary)
// =========================================================================
function CapabilitiesCard({ agent, carmen }: { agent: any; carmen: boolean }) {
  const goals = useAgentGoals(agent.id);
  const knowledge = useAgentKnowledge(agent.id);
  const carmenTree = useCarmenMemoryTree();
  const agentTree = useAgentMemoryTree(carmen ? null : agent.id);

  const toolsCount = Array.isArray(agent.allowed_tools) ? agent.allowed_tools.length : 0;
  const activeGoals = (goals.data ?? []).filter(g => g.status === "active").length;
  const folderCount = (knowledge.folders.data ?? []).length;
  const knowledgeItems = (knowledge.items.data ?? []).length;
  const memoryCount = carmen
    ? (carmenTree.data?.tree ?? []).reduce((s, n) => s + n.count, 0) + (carmenTree.data?.episodesCount ?? 0)
    : (agentTree.data ?? []).reduce((s, n) => s + n.count, 0);

  return (
    <Card className="p-5">
      <SectionHeader
        icon={carmen ? Crown : Wrench}
        title="סיכום יכולות"
        subtitle="מבט מהיר על המטרות, הכלים, הידע והזיכרון של הסוכן"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={Target} label="מטרות פעילות" value={activeGoals} hint={`מתוך ${goals.data?.length ?? 0}`} />
        <StatTile icon={Wrench} label="כלים פעילים" value={toolsCount} />
        <StatTile icon={BookOpen} label="ידע" value={knowledgeItems} hint={`${folderCount} תיקיות`} />
        <StatTile icon={Brain} label="פריטי זיכרון" value={memoryCount} />
      </div>
      {carmen && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Crown className="h-3 w-3 text-amber-500" />
          הזיכרון של כרמן מנוהל בנפרד דרך carmen_memory_pointers ו-episodes.
        </p>
      )}
    </Card>
  );
}

function StatTile({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number; hint?: string }) {
  return (
    <div className="border rounded-lg p-3 bg-muted/30">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

// =========================================================================
// Built-in (hardcoded) Carmen baseline instructions — mirrored from
// supabase/functions/run-ai-agent/index.ts so users can see & extend them.
// =========================================================================
const CARMEN_BUILTIN_INSTRUCTIONS = [
  'אתה כרמן, מנהלת AI ראשית של הארגון. את עוזרת אישית חכמה, יעילה ומקצועית.',
  'יש לך גישה מלאה לכל מודולי המערכת: לידים, לקוחות, משימות, קמפיינרים, אנשי מכירות, סוכנויות, ספקים, מוצרים, אוטומציות, ועוד.',
  'את יכולה לבצע כל פעולה שמשתמש יכול לבצע ידנית במערכת.',
  'חשוב מאוד: לפני יצירת משימה חדשה, תמיד חפשי קודם עם search_tasks כדי לוודא שהמשימה לא קיימת כבר. אם היא קיימת - עדכני אותה במקום ליצור חדשה.',
  'הבדל בין סוגי משימות: create_task = משימה לצוות (קמפיינרים). create_agent_task = משימה לכרמן עצמה. כשמבקשים ממך ליצור משימה לעצמך, סריקה תקופתית, או משימה חוזרת — השתמשי ב-create_agent_task.',
  'ענה בעברית. היי תמציתית, מקצועית, ויעילה. כשמבצעים פעולה — אשרי את הביצוע בקצרה (2-3 משפטים מקסימום).',
  'כשמדברים על "דשבורד CRM" — הכוונה לדשבורד CRM הסוכנות שמציג Health Score, דגלים, סטטוס תקשורת. השתמשי ב-update_client_health כדי לעדכן את המצב.',
  'כלל למידה עצמית: כשמשתמש מסביר/מתקן/מלמד אותך — שמרי מיד בזיכרון עם save_memory בקטגוריה instructions עם מפתח תיאורי. בתחילת כל עבודה בדקי עם recall_memory אם יש הנחיות רלוונטיות שנשמרו.',
  '🚫 איסור בלוף מוחלט: אסור לכתוב "נוצרה/עודכנה/בוצע" אלא אם באמת קראת לכלי המתאים והוא החזיר success. כל אישור פעולה ללא קריאת כלי = שקר חמור.',
  'כשמתבקשת לשייך/לעדכן/למחוק משימה קיימת: קודם search_tasks למצוא אותה, ואז update_task עם ה-id.',
].join('\n\n');

function BuiltInInstructions({
  carmen,
  agentName,
  onAppend,
}: {
  carmen: boolean;
  agentName: string;
  onAppend: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const text = carmen
    ? CARMEN_BUILTIN_INSTRUCTIONS
    : `אתה ${agentName}. ענה בעברית. היה תמציתי ומקצועי. כשמבצע פעולה — קרא לכלי המתאים, אל תכריז על ביצוע ללא קריאת כלי.`;

  return (
    <div className="mb-4 border rounded-lg bg-muted/30">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition"
      >
        <span className="flex items-center gap-2 font-medium">
          <BookOpen className="h-4 w-4 text-primary" />
          הנחיות מובנות {carmen ? "של כרמן" : "ברירת מחדל"} ({text.length.toLocaleString()} תווים)
        </span>
        <span className="text-xs text-muted-foreground">{open ? "הסתר" : "הצג"}</span>
      </button>
      {open && (
        <div className="border-t p-3 space-y-2">
          <pre className="whitespace-pre-wrap text-[11px] font-mono bg-background border rounded p-2 max-h-72 overflow-auto text-right" dir="rtl">
            {text}
          </pre>
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => onAppend(text)}>
              העתק לעריכה והוסף הנחיות
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-right">
            ההנחיות הללו מוטמעות במנוע ופעילות תמיד גם אם השדה למטה ריק. לעריכה — העתיקי לעריכה והוסיפי את ההנחיות שלך בהמשך הטקסט.
          </p>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Helpers
// =========================================================================
function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function initialForm(agent: any) {
  return {
    name: agent.name || "",
    talent: agent.talent || "",
    personality: agent.personality || "",
    soul: agent.soul || "",
    system_prompt: agent.system_prompt || "",
    writing_style: agent.writing_style || "",
    response_length: agent.response_length || "",
    language: agent.language || "he",
    max_tool_rounds: agent.max_tool_rounds ?? 25,
    active: agent.active ?? true,
    metadata: agent.metadata || {},
  };
}
