import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ALL_CLIENTS_FILTER,
  applyClientFilter,
  type MarketingClientFilter,
} from "@/components/marketing/clientFilter";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import {
  ExternalLink,
  FilePlus2,
  Globe,
  Loader2,
  Plus,
  WandSparkles,
} from "lucide-react";

interface Props {
  clientFilter: MarketingClientFilter;
  tenantId: string;
  onClientChange: (id: string | null) => void;
}

interface WebItem {
  id: string;
  title: string | null;
  status: string;
  payload: Record<string, unknown> | null;
  updated_at: string;
  client_id: string | null;
  target_channel?: string | null;
}

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

function isWebDepartmentItem(item: WebItem) {
  const department = item.payload?.department;
  if (department === "web") return true;
  if (item.payload?.web_brief || item.payload?.site_brief) return true;
  return item.target_channel === "web";
}

export function WebDesignDepartment({ clientFilter, tenantId, onClientChange }: Props) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const needsClient = !clientFilter || clientFilter === ALL_CLIENTS_FILTER;

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["web-department-context", clientFilter, tenantId],
    queryFn: async () => {
      if (!clientFilter || clientFilter === ALL_CLIENTS_FILTER) return null;
      const pipeline = await ensurePipelineForClient({
        clientId: clientFilter,
        tenantId,
        track: "campaigns",
      });
      if (!pipeline) throw new Error("לא ניתן לפתוח סביבת עיצוב ובניית אתרים");
      const [{ data: stages, error: stageError }, { data: client, error: clientError }] =
        await Promise.all([
          supabase
            .from("marketing_pipeline_stages")
            .select("id,stage_type")
            .eq("pipeline_id", pipeline.id),
          supabase
            .from("clients")
            .select("id,name,website")
            .eq("id", clientFilter)
            .maybeSingle(),
        ]);
      if (stageError) throw stageError;
      if (clientError) throw clientError;
      return {
        pipeline,
        strategyStage:
          stages?.find((stage) => stage.stage_type === "strategy") ?? null,
        client: client ?? null,
      };
    },
    enabled: !needsClient,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["web-department-items", clientFilter, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,status,payload,updated_at,client_id,target_channel")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, clientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as WebItem[]).filter(isWebDepartmentItem);
    },
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const briefText = useMemo(() => {
    if (!selected?.payload) return "";
    const p = selected.payload;
    return (
      (typeof p.web_brief === "string" ? p.web_brief : null) ??
      (typeof p.brief_text === "string" ? p.brief_text : null) ??
      ""
    );
  }, [selected?.payload]);

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["web-department-items", clientFilter, tenantId],
    });
  };

  if (needsClient) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Globe className="h-12 w-12 text-cyan-400/50" />
        <div>
          <h2 className="text-lg font-bold">מחלקת עיצוב ובניית אתרים</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            בריף, מפרט ומעקב פרויקטי אתר — בחרו לקוח כדי לפתוח את הפרויקטים שלו.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">לקוח:</span>
          <ClientSelector
            tenantId={tenantId}
            value={clientFilter}
            onChange={onClientChange}
            allowGeneral={false}
            allowAllClients={false}
          />
        </div>
      </div>
    );
  }

  if (loadingContext) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-cyan-500" />
      </div>
    );
  }

  const website = context?.client?.website ?? null;
  const websiteHref =
    website && /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)_280px] bg-muted/10">
      <aside className="flex min-h-0 flex-col border-l bg-card/70">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h2 className="text-sm font-bold">פרויקטי אתר</h2>
            <p className="text-[11px] text-muted-foreground">עיצוב, מפרט ובנייה</p>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 bg-cyan-600 hover:bg-cyan-700"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-2">
            {isLoading ? (
              <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" />
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <FilePlus2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                אין פרויקטי אתר עדיין
              </div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-right",
                    selectedId === item.id
                      ? "border-cyan-400 bg-cyan-50 dark:bg-cyan-950/20"
                      : "bg-background hover:bg-muted/50",
                  )}
                >
                  <div className="truncate text-xs font-semibold">
                    {item.title || "ללא כותרת"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{item.status}</div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        {selected ? (
          <>
            <div className="flex items-center gap-3 border-b bg-card/60 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold">{selected.title}</h2>
                <p className="text-[11px] text-muted-foreground">Web Design Studio</p>
              </div>
              <Badge variant="outline">{selected.status}</Badge>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-5">
                <Card className="p-4">
                  <Label className="text-xs text-muted-foreground">בריף / מפרט</Label>
                  <Textarea
                    className="mt-2 min-h-48"
                    value={briefText}
                    readOnly
                    placeholder="אין בריף עדיין"
                  />
                </Card>
                {typeof selected.payload?.notes === "string" && selected.payload.notes && (
                  <Card className="p-4">
                    <Label className="text-xs text-muted-foreground">הערות</Label>
                    <p className="mt-2 text-sm leading-relaxed">{selected.payload.notes}</p>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            בחרו פרויקט או צרו חדש
          </div>
        )}
      </main>

      <aside className="flex min-h-0 flex-col border-r bg-card/80">
        <div className="border-b p-4">
          <h3 className="text-sm font-bold">{context?.client?.name ?? "לקוח"}</h3>
          <p className="text-[11px] text-muted-foreground">חיבורים וכלים</p>
        </div>
        <div className="space-y-3 p-4">
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">{website}</span>
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">לא הוגדר אתר ללקוח ב-CRM</p>
          )}
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => {
              const slug = tenantSlug ?? "";
              window.open(`/t/${slug}/manus-tasks`, "_blank", "noopener,noreferrer");
            }}
          >
            <WandSparkles className="h-4 w-4" />
            משימת Manus לבנייה
          </Button>
          <Card className="p-3 text-[11px] leading-relaxed text-muted-foreground">
            העתיקו את הבריף מכאן ל-Manus, או שלחו לכרמן בצ&apos;אט עם קישור לפרויקט. בקרוב: אוטומציה
            ישירה מהמחלקה.
          </Card>
        </div>
      </aside>

      <CreateWebProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        clientId={clientFilter}
        pipelineId={context?.pipeline.id ?? null}
        strategyStageId={context?.strategyStage?.id ?? null}
        onCreated={async (id) => {
          setSelectedId(id);
          setCreateOpen(false);
          await refresh();
        }}
      />
    </div>
  );
}

function CreateWebProjectDialog({
  open,
  onClose,
  tenantId,
  clientId,
  pipelineId,
  strategyStageId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  clientId: string;
  pipelineId: string | null;
  strategyStageId: string | null;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !brief.trim() || !pipelineId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          pipeline_id: pipelineId,
          current_stage_id: strategyStageId,
          title: title.trim(),
          status: "draft",
          target_channel: "web",
          payload: {
            department: "web",
            web_brief: brief.trim(),
            brief_text: brief.trim(),
            intake_source: "manual",
          },
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("פרויקט אתר נוצר במחלקה");
      onCreated(data.id);
      setTitle("");
      setBrief("");
    } catch (error: unknown) {
      toast.error(message(error, "יצירת הפרויקט נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>פרויקט עיצוב ובניית אתר</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>שם הפרויקט</Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="למשל: אתר חדש / ריענון דף הבית"
            />
          </div>
          <div>
            <Label>בריף</Label>
            <Textarea
              className="mt-1 min-h-32"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder="מטרות, סגנון, דפים נדרשים, דדליין..."
            />
          </div>
          <Button
            className="w-full bg-cyan-600 hover:bg-cyan-700"
            disabled={saving || !pipelineId || !title.trim() || !brief.trim()}
            onClick={handleCreate}
          >
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            צור פרויקט
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
