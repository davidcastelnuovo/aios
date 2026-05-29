import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  agent: any;
}

export function ProfileTab({ agent }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: agent.name || "",
    personality: agent.personality || "",
    soul: agent.soul || "",
    talent: agent.talent || "",
    system_prompt: agent.system_prompt || "",
    writing_style: agent.writing_style || "",
    response_length: agent.response_length || "",
    language: agent.language || "he",
    max_tool_rounds: agent.max_tool_rounds ?? 25,
    active: agent.active ?? true,
  });

  useEffect(() => {
    setForm({
      name: agent.name || "",
      personality: agent.personality || "",
      soul: agent.soul || "",
      talent: agent.talent || "",
      system_prompt: agent.system_prompt || "",
      writing_style: agent.writing_style || "",
      response_length: agent.response_length || "",
      language: agent.language || "he",
      max_tool_rounds: agent.max_tool_rounds ?? 25,
      active: agent.active ?? true,
    });
  }, [agent.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_agents").update(form).eq("id", agent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-agents"] });
      toast.success("נשמר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>שם</Label>
          <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
          <Label>פעיל</Label>
        </div>
      </div>

      <div>
        <Label>טלנט / מומחיות</Label>
        <Input value={form.talent} onChange={e => setForm({ ...form, talent: e.target.value })} placeholder="לדוגמה: יועץ מכירות" />
      </div>

      <div>
        <Label>אישיות</Label>
        <Textarea rows={2} value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })} />
      </div>

      <div>
        <Label>נשמה / מטרה</Label>
        <Textarea rows={2} value={form.soul} onChange={e => setForm({ ...form, soul: e.target.value })} />
      </div>

      <div>
        <Label>System Prompt (אופציונלי — דורס את ברירת המחדל)</Label>
        <Textarea rows={5} value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} placeholder="ריק = בנייה אוטומטית מהשדות לעיל" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>סגנון כתיבה</Label>
          <Select value={form.writing_style || "none"} onValueChange={v => setForm({ ...form, writing_style: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="ברירת מחדל" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ברירת מחדל</SelectItem>
              <SelectItem value="formal">רשמי</SelectItem>
              <SelectItem value="casual">חברותי</SelectItem>
              <SelectItem value="professional">מקצועי</SelectItem>
              <SelectItem value="playful">משחקי</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>אורך תשובה</Label>
          <Select value={form.response_length || "none"} onValueChange={v => setForm({ ...form, response_length: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">ברירת מחדל</SelectItem>
              <SelectItem value="short">קצר (2-3 משפטים)</SelectItem>
              <SelectItem value="detailed">מפורט</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>שפה</Label>
          <Select value={form.language} onValueChange={v => setForm({ ...form, language: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="he">עברית</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ar">العربية</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>מקס׳ סבבי כלים</Label>
        <Input type="number" min={1} max={50} value={form.max_tool_rounds} onChange={e => setForm({ ...form, max_tool_rounds: Number(e.target.value) })} className="w-32" />
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "שומר..." : "שמור פרופיל"}
      </Button>
    </div>
  );
}
