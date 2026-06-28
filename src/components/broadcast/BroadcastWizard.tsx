import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useLeadStatuses } from "@/hooks/useLeadStatuses";
import { useBroadcasts, type AudienceFilter } from "@/hooks/useBroadcasts";
import { useBroadcastLists } from "@/hooks/useBroadcastLists";
import { useBroadcastDomains } from "@/hooks/useBroadcastDomains";
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
import { Users, Image as ImageIcon, Send, CalendarClock, Loader2, MessageSquare, Mail, UsersRound } from "lucide-react";

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
  const { lists } = useBroadcastLists();
  const { list: domainsQ } = useBroadcastDomains();
  const domains = domainsQ.data || [];
  const defaultDomain = domains.find((d) => d.is_default) || domains[0];

  const [step, setStep] = useState(0);
  const [name, setName] = useState("דיוור חדש");
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [subject, setSubject] = useState("");
  const [fromMode, setFromMode] = useState<"default" | "custom">("default");
  const [fromName, setFromName] = useState("");
  const [fromLocal, setFromLocal] = useState("");
  const [fromDomain, setFromDomain] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [integrationId, setIntegrationId] = useState<string | undefined>();
  const [source, setSource] = useState<AudienceFilter["source"]>("leads");
  const [clientStatuses, setClientStatuses] = useState<string[]>([]);
  const [leadStatusKeys, setLeadStatusKeys] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [listId, setListId] = useState<string | undefined>();
  const [pickMode, setPickMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  // WA Groups state
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupSearch, setGroupSearch] = useState("");
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
      setFromMode("default"); setFromName(""); setFromLocal(""); setFromDomain(defaultDomain?.domain || ""); setReplyTo("");
      setIntegrationId(undefined); setSource("leads");
      setClientStatuses([]); setLeadStatusKeys([]); setTagIds([]); setActiveOnly(true);
      setListId(undefined); setPickMode(false); setSelectedIds([]); setCandidateSearch("");
      setSelectedGroupIds([]); setGroupSearch("");
      setBodyText(""); setMediaFile(null); setAudienceCount(null);
      setSendMode("now"); setScheduledAt("");
    }
  }, [open]);

  // Default the sending domain once the tenant's domains load
  useEffect(() => {
    if (open && !fromDomain && defaultDomain) setFromDomain(defaultDomain.domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDomain?.domain]);

  const { data: integrations } = useQuery({
    queryKey: ["wa-integrations", tenantId],
    enabled: !!tenantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, settings, user_id, integration_type, display_name")
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

  // WhatsApp groups for the tenant
  const { data: waGroups, isLoading: groupsLoading } = useQuery({
    queryKey: ["wa-groups", tenantId],
    enabled: !!tenantId && open && channel === "whatsapp",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("id, group_name, group_chat_id, description")
        .eq("tenant_id", tenantId)
        .eq("is_blocked", false)
        .order("group_name", { ascending: true });
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
    if (source === "wa_groups") return { source: "wa_groups", groupIds: selectedGroupIds };
    if (source === "list") return { source: "list", listId };
    const include = pickMode ? { includeIds: selectedIds } : {};
    if (source === "clients") return { source, statuses: clientStatuses, tagIds, ...include };
    if (source === "leads") return { source, statusKeys: leadStatusKeys, tagIds, ...include };
    return { source: "campaigners", activeOnly, ...include };
  };

  // Candidate contacts for manual selection (base-table filters; tags applied server-side otherwise)
  const candidates = useQuery({
    queryKey: ["broadcast-candidates", tenantId, source, clientStatuses, leadStatusKeys, activeOnly],
    enabled: !!tenantId && open && pickMode && source !== "list" && source !== "wa_groups",
    queryFn: async () => {
      if (source === "clients") {
        let q = supabase.from("clients").select("id, contact_name, name, phone, email").eq("tenant_id", tenantId);
        if (clientStatuses.length) q = q.in("status", clientStatuses);
        const { data } = await q.limit(1000);
        return (data || []).map((c: any) => ({ id: c.id, label: c.contact_name || c.name || c.phone, phone: c.phone, email: c.email }));
      }
      if (source === "leads") {
        let q = supabase.from("leads").select("id, contact_name, company_name, phone, email").eq("tenant_id", tenantId);
        if (leadStatusKeys.length) q = q.in("status", leadStatusKeys);
        const { data } = await q.limit(1000);
        return (data || []).map((l: any) => ({ id: l.id, label: l.contact_name || l.company_name || l.phone, phone: l.phone, email: l.email }));
      }
      let q = supabase.from("campaigners").select("id, full_name, phone, email").eq("tenant_id", tenantId);
      if (activeOnly) q = q.eq("active", true);
      const { data } = await q.limit(1000);
      return (data || []).map((c: any) => ({ id: c.id, label: c.full_name || c.phone, phone: c.phone, email: c.email }));
    },
  });

  const runPreview = async () => {
    if (source === "wa_groups") {
      // For groups, count = number of selected groups
      setAudienceCount(selectedGroupIds.length);
      return;
    }
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
    if (step === 2 && open) {
      if (source === "wa_groups") {
        setAudienceCount(selectedGroupIds.length);
      } else if (source !== "list" || listId) {
        runPreview();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, source, clientStatuses, leadStatusKeys, tagIds, activeOnly, listId, pickMode, selectedIds, selectedGroupIds]);

  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const canNext = () => {
    if (step === 1) return channel === "email" ? domains.length > 0 : !!integrationId;
    if (step === 2) {
      if (source === "wa_groups") return selectedGroupIds.length > 0;
      return (audienceCount ?? 0) > 0;
    }
    if (step === 3) {
      if (bodyText.trim().length === 0) return false;
      if (channel === "email") {
        if (subject.trim().length === 0) return false;
        if (fromMode === "custom" && (!/^[a-zA-Z0-9._%+-]+$/.test(fromLocal) || !fromDomain)) return false;
      }
      return true;
    }
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
        from_email: channel === "email"
          ? (fromMode === "custom"
              ? `${fromLocal}@${fromDomain}`
              : defaultDomain ? `${defaultDomain.default_local}@${defaultDomain.domain}` : null)
          : null,
        from_name: channel === "email"
          ? (fromMode === "custom" ? (fromName.trim() || null) : (defaultDomain?.from_name || null))
          : null,
        reply_to: channel === "email" && replyTo.trim() ? replyTo.trim() : null,
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

      const isGroups = source === "wa_groups";
      toast.success(
        sendMode === "now"
          ? `הדיוור נשלח ל-${total} ${isGroups ? "קבוצות" : "נמענים"} (בקצב מבוקר)`
          : `הדיוור תוזמן ל-${total} ${isGroups ? "קבוצות" : "נמענים"}`,
      );
      onOpenChange(false);
      onDone?.();
    } catch (e: any) {
      toast.error("שגיאה: " + (e?.message || "לא ניתן ליצור דיוור"));
    } finally {
      setSubmitting(false);
    }
  };

  const filteredGroups = (waGroups || []).filter((g: any) =>
    !groupSearch || g.group_name.toLowerCase().includes(groupSearch.toLowerCase())
  );

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
              {domains.length === 0 ? (
                <p className="text-destructive">
                  לארגון זה עדיין לא הוגדר דומיין שליחה. עבור לטאב "הגדרות שולח" והוסף דומיין מאומת ב-Resend.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  שולח מהדומיין: <strong dir="ltr">{defaultDomain?.domain}</strong>
                  {domains.length > 1 ? ` (ועוד ${domains.length - 1})` : ""}. ניתן לבחור כתובת ספציפית בשלב התוכן.
                </p>
              )}
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
              <Select value={source} onValueChange={(v) => {
                setSource(v as AudienceFilter["source"]);
                setSelectedGroupIds([]);
                setGroupSearch("");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-[100]">
                  <SelectItem value="leads">לידים</SelectItem>
                  <SelectItem value="clients">לקוחות</SelectItem>
                  <SelectItem value="campaigners">צוות</SelectItem>
                  <SelectItem value="list">רשימת תפוצה</SelectItem>
                  {channel === "whatsapp" && (
                    <SelectItem value="wa_groups">
                      <span className="flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5" /> קבוצות וואטסאפ
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* ── WA Groups picker ── */}
            {source === "wa_groups" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">בחר קבוצות לשליחה</Label>
                  {selectedGroupIds.length > 0 && (
                    <span className="text-xs text-muted-foreground">נבחרו {selectedGroupIds.length} קבוצות</span>
                  )}
                </div>
                <Input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="חיפוש קבוצה..."
                  className="h-8"
                />
                {groupsLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : filteredGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    <UsersRound className="mx-auto mb-2 h-6 w-6 opacity-40" />
                    {(waGroups || []).length === 0
                      ? "לא נמצאו קבוצות וואטסאפ. ודא שהחיבור פעיל ושהקבוצות סונכרנו."
                      : "לא נמצאו קבוצות התואמות לחיפוש."}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>{filteredGroups.length} קבוצות</span>
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          const allIds = filteredGroups.map((g: any) => g.id);
                          setSelectedGroupIds(
                            selectedGroupIds.length === allIds.length ? [] : allIds
                          );
                        }}
                      >
                        {selectedGroupIds.length === filteredGroups.length ? "נקה הכל" : "בחר הכל"}
                      </button>
                    </div>
                    <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border p-2">
                      {filteredGroups.map((g: any) => (
                        <label key={g.id} className="flex items-center gap-2 rounded p-1.5 text-sm hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={selectedGroupIds.includes(g.id)}
                            onCheckedChange={() => toggle(selectedGroupIds, g.id, setSelectedGroupIds)}
                          />
                          <UsersRound className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{g.group_name}</div>
                            {g.description && (
                              <div className="truncate text-xs text-muted-foreground">{g.description}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {selectedGroupIds.length > 0 && (
                  <div className="rounded-lg bg-muted p-3 text-sm flex items-center gap-2">
                    <UsersRound className="h-4 w-4" />
                    <span>ישלח ל-<strong>{selectedGroupIds.length}</strong> קבוצות</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Existing sources ── */}
            {source === "list" && (
              <div>
                <Label>בחר רשימה</Label>
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger><SelectValue placeholder="בחר רשימת תפוצה..." /></SelectTrigger>
                  <SelectContent className="bg-background z-[100]">
                    {(lists.data || []).map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name} ({l.member_count})</SelectItem>
                    ))}
                    {(lists.data || []).length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">אין רשימות — צור בטאב "רשימות תפוצה"</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            {source !== "list" && source !== "wa_groups" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pickMode} onCheckedChange={(v) => { setPickMode(!!v); setSelectedIds([]); }} />
                  בחירת נמענים ספציפית
                </label>
                {pickMode && (
                  <div className="rounded-lg border p-2 space-y-2">
                    <Input value={candidateSearch} onChange={(e) => setCandidateSearch(e.target.value)} placeholder="חיפוש..." className="h-8" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>נבחרו {selectedIds.length}</span>
                      <button type="button" className="underline" onClick={() => {
                        const all = (candidates.data || []).map((c: any) => c.id);
                        setSelectedIds(selectedIds.length === all.length ? [] : all);
                      }}>בחר/נקה הכל</button>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {candidates.isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : (candidates.data || [])
                        .filter((c: any) => !candidateSearch || (c.label || "").includes(candidateSearch) || (c.phone || "").includes(candidateSearch))
                        .slice(0, 300)
                        .map((c: any) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={selectedIds.includes(c.id)} onCheckedChange={() => toggle(selectedIds, c.id, setSelectedIds)} />
                            <span className="truncate">{c.label}</span>
                            <span className="text-xs text-muted-foreground" dir="ltr">{c.phone || c.email}</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {source !== "wa_groups" && (
              <div className="rounded-lg bg-muted p-3 text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <strong>{audienceCount ?? 0}</strong>} נמענים תקינים
              </div>
            )}
          </div>
        )}

        {/* Step 3 — content */}
        {step === 3 && (
          <div className="space-y-3">
            {channel === "email" && (
              <>
                <div>
                  <Label>נושא האימייל</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="נושא ההודעה" />
                </div>
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="text-xs">כתובת שולח (From)</Label>
                  {domains.length === 0 ? (
                    <p className="text-xs text-destructive">
                      לא הוגדר דומיין שליחה לארגון. הוסף דומיין מאומת בטאב "הגדרות שולח" לפני שליחת אימייל.
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2 text-sm">
                        <button type="button" onClick={() => setFromMode("default")}
                          className={`rounded border px-2 py-1 ${fromMode === "default" ? "bg-primary text-primary-foreground" : ""}`}>
                          ברירת מחדל ({defaultDomain ? `${defaultDomain.default_local}@${defaultDomain.domain}` : ""})
                        </button>
                        <button type="button" onClick={() => setFromMode("custom")}
                          className={`rounded border px-2 py-1 ${fromMode === "custom" ? "bg-primary text-primary-foreground" : ""}`}>
                          כתובת מותאמת
                        </button>
                      </div>
                      {fromMode === "custom" && (
                        <div className="space-y-2">
                          <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="שם השולח (לדוגמה: AfterLead)" />
                          <div className="flex items-center gap-1">
                            <Input value={fromLocal} onChange={(e) => setFromLocal(e.target.value)} placeholder="info" className="flex-1" />
                            <span className="text-muted-foreground">@</span>
                            <Select value={fromDomain} onValueChange={setFromDomain}>
                              <SelectTrigger className="w-44"><SelectValue placeholder="דומיין" /></SelectTrigger>
                              <SelectContent className="bg-background z-[100]">
                                {domains.map((d) => <SelectItem key={d.id} value={d.domain}>{d.domain}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <p className="text-xs text-muted-foreground">ניתן לשלוח רק מדומיין מאומת ב-Resend.</p>
                        </div>
                      )}
                    </>
                  )}
                  <div>
                    <Label className="text-xs">Reply-To (לאן יגיעו התשובות — אופציונלי)</Label>
                    <Input type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="david@gmail.com" />
                  </div>
                </div>
              </>
            )}
            <Label>תוכן ההודעה</Label>
            {source !== "wa_groups" && (
              <div className="flex flex-wrap gap-2 text-xs">
                {["{{contact_name}}", "{{phone}}"].map((v) => (
                  <button key={v} type="button" className="rounded border px-2 py-0.5"
                    onClick={() => setBodyText((b) => b + " " + v)}>{v}</button>
                ))}
              </div>
            )}
            <Textarea rows={6} value={bodyText} onChange={(e) => setBodyText(e.target.value)}
              placeholder={source === "wa_groups" ? "שלום לכולם, ..." : "שלום {{contact_name}}, ..."} />
            {channel !== "email" && (
              <div>
                <Label className="mb-1 flex items-center gap-1"><ImageIcon className="h-4 w-4" /> תמונה (אופציונלי)</Label>
                <Input type="file" accept="image/*" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
              </div>
            )}
            {source !== "wa_groups" && (
              <p className="text-xs text-muted-foreground">
                {channel === "email"
                  ? "קישור הסרה מהרשימה (unsubscribe) יתווסף אוטומטית לתחתית כל אימייל — נדרש על פי חוק."
                  : 'מומלץ להוסיף בסוף ההודעה אפשרות הסרה (למשל: "להסרה השב הסר") — נדרש על פי חוק.'}
              </p>
            )}
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
              {source === "wa_groups" ? (
                <div className="space-y-1">
                  <div>קבוצות: <Badge variant="secondary">{selectedGroupIds.length}</Badge></div>
                  <div className="text-xs text-muted-foreground">
                    ההודעה תישלח לכל הקבוצות הנבחרות{sendMode === "schedule" ? " במועד המתוזמן" : " מיד"}.
                  </div>
                </div>
              ) : (
                <>
                  <div>נמענים: <Badge variant="secondary">{audienceCount ?? 0}</Badge></div>
                  {channel !== "email" && (
                    <div className="text-xs text-muted-foreground">שליחה בקצב מבוקר (12–20 שניות בין הודעות) כדי להימנע מחסימה.</div>
                  )}
                </>
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
