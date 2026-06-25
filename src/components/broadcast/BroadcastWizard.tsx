import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useBroadcasts, type AudienceFilter } from "@/hooks/useBroadcasts";
import { WaProviderConnectionPicker } from "@/components/forms/WaProviderConnectionPicker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Image as ImageIcon, Send, CalendarClock, Loader2, MessageSquare, Mail } from "lucide-react";

const CLIENT_STATUSES = [
  { key: "active", label: "פעיל" },
  { key: "onboarding", label: "אונבורדינג" },
  { key: "paused", label: "מושהה" },
  { key: "ended", label: "הסתיים" },
];

const STEPS = ["ערוץ", "חיבור", "קהל יעד", "תוכן", "תזמון"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}

export function BroadcastWizard({ open, onOpenChange, onDone }: Props) {
  const { tenantId } = useCurrentTenant();
  const { statuses: leadStatuses } = useLeadStatuses();
  const { create, update, previewAudience, launch } = useBroadcasts();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("דיוור חדש");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [subject, setSubject] = useState("");
  const [integrationId, setIntegrationId] = useState<string | undefined>();
  const [source, setSource] = useState<AudienceFilter["source"]>("leads");
  const [clientStatuses, setClientStatuses] = useState<string[]>([]);
  const [leadStatusKeys, setLeadStatusKeys] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [bodyText, setBodyText] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [sendMode, setSendMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setStep(0); setName("דיוור חדש"); setChannel("whatsapp"); setSubject("");
      setIntegrationId(undefined); setSource("leads");
      setClientStatuses([]); setLeadStatusKeys([]); setTagIds([]); setActiveOnly(true);
      setBodyText(""); setMediaFile(null); setAudienceCount(null);
      setSendMode("now"); setScheduledAt("");
    }
  }, [open]);

  const { data: integrations } = useQuery({
    queryKey: ["wa-integrations", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, settings, user_id, integration_type")
        .eq("tenant_id", tenantId)
        .in("integration_type", ["green_api", "manus_wa"])
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: chatTags } = useQuery({
    queryKey: ["chat-tags", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_tags").select("id, name, color").eq("tenant_id", tenantId).order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const selectedProvider = useMemo<"green_api" | "manus_wa" | "resend">(() => {
    if (channel === "email") return "resend";
    const i = (integrations || []).find((x: any) => x.id === integrationId);
    return (i?.integration_type as "green_api" | "manus_wa") || "green_api";
  }, [integrations, integrationId, channel]);

  const buildFilter = (): AudienceFilter => {
    if (source === "clients") return { source, statuses: clientStatuses, tagIds };
    if (source === "leads") return { source, statusKeys: leadStatusKeys, tagIds };
    return { source: "campaigners", activeOnly };
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await previewAudience(buildFilter(), channel);
      setAudienceCount(res.total);
    } catch (e: any) {
      toast.error("שגיאה בחישוב קהל: " + (e?.message || ""));
      setAudienceCount(null);
    } finally {
      setPreviewing(false);
    }
  };

  // Recompute count when audience criteria change (on the audience step)
  useEffect(() => {
    if (step === 2 && open) runPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, source, clientStatuses, leadStatusKeys, tagIds, activeOnly]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const canNext = () => {
    if (step === 1) return channel === "email" ? true : !!integrationId;
    if (step === 2) return (audienceCount ?? 0) > 0;
    if (step === 3) return bodyText.trim().length > 0 && (channel !== "email" || subject.trim().length > 0);
    return true;
  };

  const submit = async () => {
    if (!tenantId) return;
    setSubmitting(true);
    try {
      // 1) create draft
      const draft = await create.mutateAsync({
        name, channel, provider: selectedProvider,
        integration_id: channel === "email" ? null : integrationId,
        subject: channel === "email" ? subject : null,
        body_text: bodyText, audience_filter: buildFilter(),
      });

      // 2) upload media if present → public bucket
      let mediaUrl: string | null = null;
      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop() || "jpg";
        const path = `${tenantId}/${draft.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("broadcast-media").upload(path, mediaFile, { upsert: true });
        if (upErr) throw upErr;
        mediaUrl = supabase.storage.from("broadcast-media").getPublicUrl(path).data.publicUrl;
        await update.mutateAsync({ id: draft.id, media_url: mediaUrl });
      }

      // 3) launch (enqueue recipients + set status)
      const total = await launch.mutateAsync({
        id: draft.id,
        sendNow: sendMode === "now",
        scheduledAt: sendMode === "schedule" ? new Date(scheduledAt).toISOString() : null,
      });

      toast.success(
        sendMode === "now"
          ? `הדיוור נשלח ל-${total} נמענים (בקצב מבוקר)`
          : `הדיוור תוזמן ל-${total} נמענים`,
      );
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error("שגיאה: " + (e?.message || "לא ניתן ליצור דיוור"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>דיוור חדש</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-1 text-xs">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
              <span className={i === step ? "font-semibold" : "text-muted-foreground"}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 0 — channel */}
        {step === 0 && (
          <div className="space-y-3">
            <Label>שם הדיוור</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Label className="mt-2 block">ערוץ</Label>
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setChannel("whatsapp")}
                className={`rounded-lg border-2 p-3 text-center text-sm font-medium ${channel === "whatsapp" ? "border-primary" : "border-muted"}`}>
                <MessageSquare className="mx-auto mb-1 h-5 w-5" /> WhatsApp לא-רשמי
              </button>
              <button disabled className="rounded-lg border p-3 text-center text-sm text-muted-foreground opacity-50">WhatsApp רשמי (בקרוב)</button>
              <button onClick={() => setChannel("email")}
                className={`rounded-lg border-2 p-3 text-center text-sm font-medium ${channel === "email" ? "border-primary" : "border-muted"}`}>
                <Mail className="mx-auto mb-1 h-5 w-5" /> אימייל
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — connection */}
        {step === 1 && (
          channel === "email" ? (
            <div className="rounded-lg border p-4 text-sm space-y-1">
              <div className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4" /> שליחה דרך Resend</div>
              <p className="text-muted-foreground">
                האימיילים נשלחים דרך Resend מהדומיין המאומת. ודא שהדומיין אומת ושמפתח ה-API מוגדר במערכת.
              </p>
            </div>
          ) : (
            <WaProviderConnectionPicker
              integrations={integrations as any}
              value={integrationId}
              onChange={setIntegrationId}
            />
          )
        )}

        {/* Step 2 — audience */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>מקור</Label>
              <Select value={source} onValueChange={(v) => setSource(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-[100]">
                  <SelectItem value="leads">לידים</SelectItem>
                  <SelectItem value="clients">לקוחות</SelectItem>
                  <SelectItem value="campaigners">צוות</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source === "clients" && (
              <div>
                <Label className="mb-1 block">סטטוס לקוח</Label>
                <div className="flex flex-wrap gap-3">
                  {CLIENT_STATUSES.map((s) => (
                    <label key={s.key} className="flex items-center gap-1 text-sm">
                      <Checkbox checked={clientStatuses.includes(s.key)} onCheckedChange={() => toggle(clientStatuses, s.key, setClientStatuses)} />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {source === "leads" && (
              <div>
                <Label className="mb-1 block">סטטוס ליד</Label>
                <div className="flex flex-wrap gap-3">
                  {(leadStatuses || []).map((s: any) => (
                    <label key={s.status_key} className="flex items-center gap-1 text-sm">
                      <Checkbox checked={leadStatusKeys.includes(s.status_key)} onCheckedChange={() => toggle(leadStatusKeys, s.status_key, setLeadStatusKeys)} />
                      {s.label || s.status_key}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {source === "campaigners" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={activeOnly} onCheckedChange={(v) => setActiveOnly(!!v)} /> רק חברי צוות פעילים
              </label>
            )}

            {(source === "clients" || source === "leads") && (chatTags || []).length > 0 && (
              <div>
                <Label className="mb-1 block">תגיות (אופציונלי)</Label>
                <div className="flex flex-wrap gap-2">
                  {(chatTags || []).map((t: any) => (
                    <button key={t.id} type="button" onClick={() => toggle(tagIds, t.id, setTagIds)}
                      className={`rounded-full border px-2 py-0.5 text-xs ${tagIds.includes(t.id) ? "bg-primary text-primary-foreground" : ""}`}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted p-3 text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <strong>{audienceCount ?? 0}</strong>} נמענים תקינים
            </div>
          </div>
        )}

        {/* Step 3 — content */}
        {step === 3 && (
          <div className="space-y-3">
            {channel === "email" && (
              <div>
                <Label>נושא האימייל</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא ההודעה" />
              </div>
            )}
            <Label>תוכן ההודעה</Label>
            <div className="flex flex-wrap gap-2 text-xs">
              {["{{contact_name}}", "{{phone}}"].map((v) => (
                <button key={v} type="button" className="rounded border px-2 py-0.5"
                  onClick={() => setBodyText((b) => b + " " + v)}>{v}</button>
              ))}
            </div>
            <Textarea rows={6} value={bodyText} onChange={(e) => setBodyText(e.target.value)}
              placeholder="שלום {{contact_name}}, ..." />
            {channel !== "email" && (
              <div>
                <Label className="mb-1 flex items-center gap-1"><ImageIcon className="h-4 w-4" /> תמונה (אופציונלי)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {channel === "email"
                ? "קישור הסרה מהרשימה (unsubscribe) יתווסף אוטומטית לתחתית כל אימייל — נדרש על פי חוק."
                : 'מומלץ להוסיף בסוף ההודעה אפשרות הסרה (למשל: "להסרה השב הסר") — נדרש על פי חוק.'}
            </p>
          </div>
        )}

        {/* Step 4 — schedule */}
        {step === 4 && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant={sendMode === "now" ? "default" : "outline"} onClick={() => setSendMode("now")} className="flex-1">
                <Send className="ml-1 h-4 w-4" /> שלח עכשיו
              </Button>
              <Button variant={sendMode === "schedule" ? "default" : "outline"} onClick={() => setSendMode("schedule")} className="flex-1">
                <CalendarClock className="ml-1 h-4 w-4" /> תזמן
              </Button>
            </div>
            {sendMode === "schedule" && (
              <div>
                <Label>מועד שליחה</Label>
                <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
              </div>
            )}
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div>
                ערוץ: {channel === "email"
                  ? "אימייל (Resend)"
                  : `WhatsApp (${selectedProvider === "manus_wa" ? "Manus" : "Green API"})`}
              </div>
              <div>נמענים: <Badge variant="secondary">{audienceCount ?? 0}</Badge></div>
              {channel !== "email" && (
                <div className="text-xs text-muted-foreground">שליחה בקצב מבוקר (12–20 שניות בין הודעות) כדי להימנע מחסימה.</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button variant="ghost" disabled={step === 0 || submitting} onClick={() => setStep((s) => s - 1)}>הקודם</Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)}>הבא</Button>
          ) : (
            <Button disabled={submitting || (sendMode === "schedule" && !scheduledAt)} onClick={submit}>
              {submitting ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : null}
              {sendMode === "now" ? "שלח דיוור" : "תזמן דיוור"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
