import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClipboardCheck, Play, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

export function EvalsTab({ agent }: { agent: any }) {
  const qc = useQueryClient();
  const { tenantId } = useCurrentTenant();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [datasetStr, setDatasetStr] = useState('[\n  {"input":"מה הסטטוס של לקוח X?","expected":"…"}\n]');

  const { data: evals } = useQuery({
    queryKey: ["agent-evals", agent.id],
    queryFn: async () => {
      const { data } = await supabase.from("agent_evals").select("*").eq("agent_id", agent.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: runs } = useQuery({
    queryKey: ["agent-eval-runs", agent.id],
    queryFn: async () => {
      const { data } = await supabase.from("agent_eval_runs").select("*").eq("agent_id", agent.id).order("started_at", { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  const createEval = useMutation({
    mutationFn: async () => {
      let dataset: any;
      try { dataset = JSON.parse(datasetStr); } catch { throw new Error("JSON לא תקין"); }
      if (!Array.isArray(dataset)) throw new Error("ה-dataset חייב להיות מערך");
      const { error } = await supabase.from("agent_evals").insert({
        tenant_id: tenantId, agent_id: agent.id, name, dataset,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent-evals", agent.id] });
      setOpen(false); setName(""); toast.success("Eval נוצר");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const runEval = useMutation({
    mutationFn: async (eval_id: string) => {
      const { data, error } = await supabase.functions.invoke("run-agent-eval", {
        body: { eval_id, tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Eval הסתיים: ${d?.passed}/${d?.total} עברו (avg ${Number(d?.avg_score).toFixed(1)})`);
      qc.invalidateQueries({ queryKey: ["agent-eval-runs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeEval = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_evals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-evals", agent.id] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Evals — בדיקות איכות</h3>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 me-1" />Eval חדש</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>צור Eval</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>שם</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: זיהוי לקוחות בסיכון" />
              </div>
              <div>
                <Label>Dataset (JSON array של {`{input, expected}`})</Label>
                <Textarea value={datasetStr} onChange={(e) => setDatasetStr(e.target.value)} rows={12} dir="ltr" className="font-mono text-xs" />
              </div>
              <Button onClick={() => createEval.mutate()} disabled={!name || createEval.isPending} className="w-full">צור</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {(evals ?? []).map((e: any) => (
          <Card key={e.id} className="p-3 flex items-center gap-3">
            <div className="flex-1">
              <div className="font-medium">{e.name}</div>
              <div className="text-xs text-muted-foreground">{(e.dataset ?? []).length} מקרים • סף {e.pass_threshold}</div>
            </div>
            <Button size="sm" variant="outline" onClick={() => runEval.mutate(e.id)} disabled={runEval.isPending}>
              <Play className="h-3 w-3 me-1" />הרץ
            </Button>
            <Button size="icon" variant="ghost" onClick={() => removeEval.mutate(e.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Card>
        ))}
        {!evals?.length && <p className="text-sm text-muted-foreground text-center py-4">אין Evals.</p>}
      </div>

      <div className="pt-4 border-t">
        <h4 className="font-medium mb-2">ריצות אחרונות</h4>
        <Accordion type="single" collapsible>
          {(runs ?? []).map((r: any) => (
            <AccordionItem key={r.id} value={r.id}>
              <AccordionTrigger>
                <div className="flex items-center gap-2 flex-1">
                  <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                  <span className="text-sm">{new Date(r.started_at).toLocaleString("he-IL")}</span>
                  <span className="text-sm">{r.passed_cases}/{r.total_cases}</span>
                  {r.avg_score != null && <Badge variant="outline">avg {r.avg_score}</Badge>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {(r.results ?? []).map((res: any, i: number) => (
                    <Card key={i} className="p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        {res.passed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                        <Badge variant="outline">{res.score}</Badge>
                        <span className="font-medium truncate">{res.input}</span>
                      </div>
                      <div className="text-muted-foreground">צפוי: {res.expected}</div>
                      <div className="text-muted-foreground">בפועל: {res.actual}</div>
                      {res.reasoning && <div className="italic mt-1">{res.reasoning}</div>}
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
