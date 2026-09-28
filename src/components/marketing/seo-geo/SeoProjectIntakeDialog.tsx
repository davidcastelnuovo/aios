import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  fetchSeoIntakePreview,
  runSeoProjectIntake,
  SEO_INTAKE_MANUAL_QUESTIONS,
  type SeoIntakePreview,
  type SeoPriorBrief,
} from "@/lib/seoGeoClientIntake";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Globe, Loader2, Plus, Sparkles, WandSparkles } from "lucide-react";

type Path = "pick_brief" | "carmen" | "manual";

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  defaultClientId?: string | null;
  onCreated: (id: string) => void | Promise<void>;
}

const message = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

export function SeoProjectIntakeDialog({ open, onClose, tenantId, defaultClientId, onCreated }: Props) {
  const [clientId, setClientId] = useState<string | null>(defaultClientId ?? null);
  const [title, setTitle] = useState("");
  const [websiteOverride, setWebsiteOverride] = useState("");
  const [preview, setPreview] = useState<SeoIntakePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [path, setPath] = useState<Path>("carmen");
  const [selectedBriefId, setSelectedBriefId] = useState<string | null>(null);
  const [carmenPrompt, setCarmenPrompt] = useState("");
  const [manualAnswers, setManualAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(defaultClientId ?? null);
      setPath("carmen");
      setSelectedBriefId(null);
      setManualAnswers({});
      setCarmenPrompt("");
    }
  }, [defaultClientId, open]);

  useEffect(() => {
    if (!open || !clientId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingPreview(true);
      try {
        const data = await fetchSeoIntakePreview(tenantId, clientId);
        if (!cancelled) {
          setPreview(data);
          setWebsiteOverride(data.website ?? "");
          if (data.priorBriefs.length > 0) {
            setPath("pick_brief");
            setSelectedBriefId(data.priorBriefs[0].id);
          } else {
            setPath("carmen");
          }
        }
      } catch (error: unknown) {
        if (!cancelled) toast.error(message(error, "טעינת נתוני לקוח נכשלה"));
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, open, tenantId]);

  const activeWp = useMemo(
    () => preview?.wordpressSites.find((s) => s.is_active !== false) ?? preview?.wordpressSites[0],
    [preview],
  );

  const createWorkItem = async () => {
    if (!clientId || !title.trim()) throw new Error("נדרש לקוח ושם תוכנית");
    const pipeline = await ensurePipelineForClient({ clientId, tenantId, track: "seo_geo" });
    const { data: stages, error: stageError } = await supabase
      .from("marketing_pipeline_stages")
      .select("id,stage_type")
      .eq("pipeline_id", pipeline.id);
    if (stageError) throw stageError;
    const stageId = stages?.find((stage) => stage.stage_type === "target_seo")?.id ?? null;
    if (!stageId) throw new Error("שלב SEO/GEO לא נמצא");

    const { data, error } = await supabase
      .from("marketing_work_items")
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        pipeline_id: pipeline.id,
        current_stage_id: stageId,
        title: title.trim(),
        status: "draft",
        target_channel: "seo",
        payload: { department: "seo", intake_source: "pending" },
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const submit = async () => {
    if (!clientId) {
      toast.error("בחר לקוח לפני פתיחת פרויקט SEO");
      return;
    }
    if (!title.trim()) {
      toast.error("הזן שם לתוכנית");
      return;
    }
    if (path === "manual" && SEO_INTAKE_MANUAL_QUESTIONS.some((_, i) => !manualAnswers[`q${i + 1}`]?.trim())) {
      toast.error("ענה על כל חמש השאלות");
      return;
    }
    if (path === "pick_brief" && !selectedBriefId) {
      toast.error("בחר בריף קיים");
      return;
    }

    setSaving(true);
    try {
      const workItemId = await createWorkItem();
      const mode = path === "pick_brief" ? "existing_brief" : path === "manual" ? "manual_five" : "carmen_full";
      await runSeoProjectIntake({
        work_item_id: workItemId,
        mode,
        website_override: websiteOverride.trim() || undefined,
        manual_answers: path === "manual" ? manualAnswers : undefined,
        selected_brief_id: path === "pick_brief" ? selectedBriefId ?? undefined : undefined,
        run_research: mode === "carmen_full",
        user_prompt: path === "carmen" ? carmenPrompt.trim() : "",
      });

      if (path === "manual" || path === "pick_brief") {
        const { data, error } = await supabase.functions.invoke("marketing-seo-plan", {
          body: {
            item_id: workItemId,
            mode: "brief",
            prompt: path === "manual" ? "מחקר ביטויים ומתחרים מהתשובות הידניות" : "המשך מהבריף הקיים",
            horizon_months: 3,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
      }

      toast.success(path === "carmen" ? "כרמן בנתה בריף ומחקר מהנתונים המחוברים" : "הפרויקט נפתח והתוכנית נבנית");
      setTitle("");
      await onCreated(workItemId);
    } catch (error: unknown) {
      toast.error(message(error, "פתיחת הפרויקט נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-emerald-600" />
            פרויקט SEO / GEO חדש
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-3">
          <div className="grid gap-4 py-2">
            <div>
              <Label>לקוח</Label>
              <div className="mt-1">
                <ClientSelector tenantId={tenantId} value={clientId} onChange={setClientId} allowGeneral={false} />
              </div>
              {!clientId && <p className="mt-2 text-[11px] text-amber-700">פרויקט SEO דורש לקוח — נמשך את האתר, וורדפרס ובריפים מהמערכת.</p>}
            </div>

            <div>
              <Label>שם התוכנית</Label>
              <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: תוכנית SEO רבעון 4" />
            </div>

            {clientId && (
              <div className="rounded-xl border bg-muted/30 p-4">
                {loadingPreview ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    טוען אתר, וורדפרס ובריפים…
                  </div>
                ) : preview ? (
                  <div className="space-y-3">
                    <div>
                      <Label>אתר</Label>
                      <Input className="mt-1" value={websiteOverride} onChange={(e) => setWebsiteOverride(e.target.value)} placeholder="https://…" dir="ltr" />
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {activeWp ? (
                        <Badge variant="outline" className="gap-1 border-emerald-400 text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          WordPress: {activeWp.site_name || activeWp.site_url}
                        </Badge>
                      ) : (
                        <Badge variant="outline">WordPress — לא מחובר ללקוח</Badge>
                      )}
                      <Badge variant="secondary">Ahrefs: {preview.ahrefsReportCount} דוחות</Badge>
                      <Badge variant="secondary">מעקב: {preview.trackedKeywordCount} ביטויים</Badge>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {clientId && preview && preview.priorBriefs.length > 0 && (
              <div className="space-y-2">
                <Label>בריפים קיימים ללקוח</Label>
                <div className="grid gap-2">
                  {preview.priorBriefs.map((brief) => (
                    <BriefRow
                      key={brief.id}
                      brief={brief}
                      active={path === "pick_brief" && selectedBriefId === brief.id}
                      onSelect={() => {
                        setPath("pick_brief");
                        setSelectedBriefId(brief.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <PathButton
                active={path === "carmen"}
                title="קרמן תעשי הכל"
                subtitle="אתר + חיבורים, דוחות, תקשורת — בריף ומחקר"
                icon={WandSparkles}
                onClick={() => setPath("carmen")}
              />
              <PathButton
                active={path === "manual"}
                title="בריף ידני"
                subtitle="חמש שאלות — ואז מחקר ביטויים"
                icon={Sparkles}
                onClick={() => setPath("manual")}
              />
            </div>

            {path === "carmen" && (
              <div>
                <Label>הנחיה לכרמן (אופציונלי)</Label>
                <Textarea
                  className="mt-1 min-h-24"
                  value={carmenPrompt}
                  onChange={(e) => setCarmenPrompt(e.target.value)}
                  placeholder="לינק או דגשים — כרמן תסרוק את האתר ותמשוך CRM: דוחות, וואטסאפ (Green API + בוט כרמן), פגישות"
                />
              </div>
            )}

            {path === "manual" && (
              <div className="space-y-3">
                {SEO_INTAKE_MANUAL_QUESTIONS.map((q, i) => (
                  <div key={q}>
                    <Label className="text-xs">{q}</Label>
                    <Textarea
                      className="mt-1 min-h-16"
                      value={manualAnswers[`q${i + 1}`] ?? ""}
                      onChange={(e) => setManualAnswers((prev) => ({ ...prev, [`q${i + 1}`]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <Button
              onClick={submit}
              disabled={saving || !clientId || !title.trim()}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {path === "carmen" ? "קרמן — צור בריף ופתח מחקר" : path === "pick_brief" ? "המשך מבריף קיים" : "שמור בריף ופתח מחקר"}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function BriefRow({ brief, active, onSelect }: { brief: SeoPriorBrief; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-right text-xs transition",
        active ? "border-emerald-500 bg-emerald-50" : "bg-background hover:bg-muted/50",
      )}
    >
      <div className="font-semibold">{brief.title || "בריף ללא כותרת"}</div>
      <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{brief.excerpt}</p>
    </button>
  );
}

function PathButton({
  active,
  title,
  subtitle,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-right",
        active ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10" : "hover:bg-muted/50",
      )}
    >
      <div className="flex items-center gap-2 text-xs font-bold">
        <Icon className="h-3.5 w-3.5 text-emerald-600" />
        {title}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{subtitle}</div>
    </button>
  );
}
