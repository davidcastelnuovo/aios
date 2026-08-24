import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { applyClientFilter, ALL_CLIENTS_FILTER, type MarketingClientFilter } from "@/components/marketing/clientFilter";
import { isCopyDepartmentItem } from "@/components/marketing/departmentFilters";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowUp,
  FileText,
  Globe,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  Save,
  Send,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";

interface Props {
  clientFilter: MarketingClientFilter;
  tenantId: string;
  onClientChange: (id: string | null) => void;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface CopyItem {
  id: string;
  title: string | null;
  status: string;
  payload: Record<string, JsonValue> | null;
  current_stage_id: string | null;
  target_channel: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
  at: string;
}

interface BriefFile {
  name: string;
  path?: string;
  size?: number;
  type?: string;
}

interface ClientRow {
  id: string;
  name: string;
  agency_id: string | null;
  website: string | null;
  attachments: BriefFile[] | null;
}

interface AgencyRow {
  id: string;
  name: string;
}

interface RecordingRow {
  id: string;
  meeting_topic: string | null;
  start_time: string | null;
  summary_md: string | null;
  transcription: string | null;
  notes: string | null;
  client_id: string | null;
}

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const asText = (value: JsonValue | undefined) => (typeof value === "string" ? value : "");

const CONTENT_TYPES = [
  { value: "posts", label: "פוסטים" },
  { value: "ads", label: "מודעות" },
  { value: "script", label: "תסריט" },
  { value: "book", label: "ספר" },
];

const typeLabel = (value: string) => CONTENT_TYPES.find((type) => type.value === value)?.label
  ?? (value === "social_post" ? "פוסטים" : value === "ad_copy" || value === "ad_script" ? "מודעות" : value === "video_script" ? "תסריט" : "קופי");

const timeAgo = (iso: string) => {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}ד׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}ש׳`;
  return `${Math.floor(hours / 24)}י׳`;
};

const readChat = (payload: Record<string, JsonValue> | null): ChatTurn[] => {
  const raw = payload?.copy_chat;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const role = value.role === "user" || value.role === "assistant" ? value.role : null;
    if (!role) return [];
    return [{ role, content: asText(value.content), at: asText(value.at) || new Date().toISOString() }];
  });
};

const sanitizeFileName = (name: string) => {
  const ext = name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.lastIndexOf(".") > 0 ? name.slice(0, name.lastIndexOf(".")) : name;
  return `${base.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").slice(0, 50)}${ext.toLowerCase()}`;
};

const filesFromAttachments = (attachments: unknown): BriefFile[] => {
  if (!Array.isArray(attachments)) return [];
  return attachments.flatMap((file) => {
    if (!file || typeof file !== "object") return [];
    const rec = file as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : "";
    if (!name) return [];
    return [{
      name,
      path: typeof rec.path === "string" ? rec.path : undefined,
      size: typeof rec.size === "number" ? rec.size : undefined,
      type: typeof rec.type === "string" ? rec.type : undefined,
    }];
  });
};

const recordingHasText = (recording: RecordingRow) =>
  Boolean(recording.summary_md || recording.transcription || recording.notes);

const invokeErrorMessage = async (error: unknown, data: { error?: string } | null, fallback: string) => {
  if (data?.error) return data.error;
  const context = error && typeof error === "object" ? (error as { context?: Response }).context : undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json() as { error?: string };
      if (body?.error) return body.error;
    } catch { /* ignore */ }
  }
  return error instanceof Error ? error.message : fallback;
};

const extractCopyDocument = (output: string) => {
  const marker = output.split(/---COPY---/i);
  const body = (marker.length > 1 ? marker.slice(1).join("---COPY---") : output).trim();
  return body.replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "").trim();
};

export function CopyDepartment({ clientFilter, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CopyItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["copy-department-items", clientFilter, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("marketing_work_items")
        .select("id,title,status,payload,current_stage_id,target_channel,client_id,created_at,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, clientFilter);
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as CopyItem[]).filter((item) => isCopyDepartmentItem(item));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["copy-department-clients", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id,name,agency_id,website,attachments")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });

  const { data: agencies = [] } = useQuery({
    queryKey: ["copy-department-agencies", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from("agencies").select("id,name").eq("tenant_id", tenantId).order("name");
      if (error) throw error;
      return (data ?? []) as AgencyRow[];
    },
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null);
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const chat = useMemo(() => readChat(selected?.payload ?? null), [selected?.payload]);
  const copyText = asText(selected?.payload?.copy_text);
  const clientName = clients.find((client) => client.id === selected?.client_id)?.name;
  const agencyName = (() => {
    const client = clients.find((row) => row.id === selected?.client_id);
    return agencies.find((agency) => agency.id === client?.agency_id)?.name;
  })();

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.length, copyText, sending]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["copy-department-items", clientFilter, tenantId] });
  };

  const sendPrompt = async () => {
    if (!selected || !composer.trim() || sending) return;
    const prompt = composer.trim();
    setComposer("");
    setPendingPrompt(prompt);
    setSending(true);
    try {
      const conversationId = asText(selected.payload?.copy_conversation_id);
      const type = typeLabel(asText(selected.payload?.content_type) || "posts");
      const brief = asText(selected.payload?.brief_text);
      const existing = asText(selected.payload?.copy_text);
      const website = asText(selected.payload?.client_website);
      const recordingTitle = asText(selected.payload?.recording_title);
      // Isolation lives in the system addon — never put pulse/health trigger
      // phrases in command_text or resolveActiveSkills will load those skins.
      const studioAddon = [
        "זה שרשור סטודיו קופי נפרד מהצ׳ט הראשי של כרמן.",
        "עבדי רק כקופירייטרית (סקין copywriter) על הפרויקט הזה. כתבי בעברית טבעית, לא תרגום מאנגלית. אל תמציאי מחירים, תוצאות, פיצ'רים או הוכחות חברתיות.",
        "משימות רקע אחרות של כרמן רצות במקביל בשיחות ובקרונים נפרדים — אל תערבבי אותן לכאן ואל תריצי אותן בשרשור הזה.",
        "בהירות לפני חכמות. תועלת לפני פיצ'ר. כל וריאציה = זווית שונה (לא אותו משפט בניסוח אחר).",
        `פרויקט: ${selected.title || "בלי שם"}`,
        `סוג תוצר: ${type}`,
        clientName && `לקוח: ${clientName}`,
        agencyName && `סוכנות: ${agencyName}`,
        website && `אתר הלקוח: ${website}`,
        brief && `בריף:\n${brief}`,
        recordingTitle && `הקלטה משויכת: ${recordingTitle}`,
        "פורמט פלט חובה:",
        "---COPY---",
        "וריאציה N — [framework: AIDA/PAS/BAB/4Ps] — [זווית]",
        "כותרת:",
        "גוף:",
        "CTA:",
        "רציונל: משפט אחד מה בודקים מול שאר הווריאציות.",
      ].filter(Boolean).join("\n");
      const commandText = [
        `כתבי קופי לפרויקט "${selected.title || "בלי שם"}" (${type}).`,
        clientName && `לקוח: ${clientName}.`,
        website && `אתר: ${website}.`,
        brief && `בריף:\n${brief}`,
        existing && `קופי נוכחי בעורך — שפרי לפי הבקשה והחזירי מסמך מלא:\n${existing}`,
        `בקשת המשתמש:\n${prompt}`,
      ].filter(Boolean).join("\n\n");

      const { data, error } = await supabase.functions.invoke("run-ai-agent", {
        body: {
          command_text: commandText,
          tenant_id: tenantId,
          client_id: selected.client_id,
          surface: "internal_chat",
          task_mode: "copywriting",
          task_skills: ["copywriter"],
          pin_skills_only: true,
          system_prompt_addon: studioAddon,
          conversation_id: conversationId || undefined,
          conversation_history: readChat(selected.payload).map((turn) => ({
            role: turn.role,
            content: turn.content,
          })),
          user_name: "מחלקת קופי",
        },
      });
      if (error) throw new Error(await invokeErrorMessage(error, data, "כרמן לא הצליחה לכתוב"));
      if (data?.error) throw new Error(data.error);
      const output = String(data?.output ?? data?.reply ?? data?.message ?? "").trim();
      if (!output) throw new Error("כרמן החזירה תשובה ריקה");
      const copyDocument = extractCopyDocument(output);
      const now = new Date().toISOString();
      const nextChat = [
        ...readChat(selected.payload),
        { role: "user" as const, content: prompt, at: now },
        { role: "assistant" as const, content: copyDocument, at: now },
      ].slice(-40);
      const nextPayload = {
        ...(selected.payload ?? {}),
        department: "copy",
        copy_text: copyDocument,
        copy_chat: nextChat,
        copy_prompt: prompt,
        last_skin_slug: "copywriter",
        copy_conversation_id: data?.conversation_id || conversationId || null,
      };
      const { error: saveError } = await supabase
        .from("marketing_work_items")
        .update({ payload: nextPayload, status: "draft" })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);
      if (saveError) throw saveError;
      await supabase.from("marketing_assets").insert({
        tenant_id: tenantId,
        item_id: selected.id,
        stage_id: selected.current_stage_id,
        type: "copy",
        content: copyDocument,
        meta: { source: "carmen_chat", skin_slug: "copywriter", prompt },
      });
      toast.success("הקופי עודכן בעורך");
      await refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "כרמן לא הצליחה לכתוב"));
      setComposer(prompt);
    } finally {
      setSending(false);
      setPendingPrompt(null);
    }
  };

  const handoff = useMutation({
    mutationFn: async () => {
      if (!selected?.client_id) throw new Error("שייכו לקוח בהגדרות כדי להעביר לקריאייטיב");
      const pipeline = await ensurePipelineForClient({ clientId: selected.client_id, tenantId, track: "campaigns" });
      if (!pipeline) throw new Error("לא נמצא פייפליין");
      const { data: stages, error: stageError } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
      if (stageError) throw stageError;
      const creativeStage = stages?.find((stage) => stage.stage_type === "creative");
      if (!creativeStage) throw new Error("שלב קריאייטיב לא נמצא");
      const nextPayload = {
        ...(selected.payload ?? {}),
        department: "creative",
        project_type: selected.payload?.project_type ?? "static",
        handoff_from: "copy",
        handoff_at: new Date().toISOString(),
        linked_copy_item_id: selected.id,
        linked_copy_title: selected.title,
        copy_text: selected.payload?.copy_text ?? "",
        brief_text: selected.payload?.brief_text ?? "",
        content_type: selected.payload?.content_type,
        channel: selected.payload?.channel,
        instructions: selected.payload?.instructions,
        notes: selected.payload?.notes,
        format: selected.payload?.format ?? "1:1",
        intake_source: "copy_handoff",
      };
      const { error } = await supabase
        .from("marketing_work_items")
        .update({
          current_stage_id: creativeStage.id,
          status: "draft",
          pipeline_id: pipeline.id,
          payload: nextPayload,
        })
        .eq("id", selected.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("הועבר למחלקת קריאייטיב");
      await refresh();
    },
    onError: (error: unknown) => toast.error(errorMessage(error, "ההעברה נכשלה")),
  });

  const startRename = (item: CopyItem) => {
    setRenamingId(item.id);
    setRenameValue(item.title ?? "");
  };

  const saveRename = async (itemId: string) => {
    const nextTitle = renameValue.trim();
    setRenamingId(null);
    if (!nextTitle) return;
    const current = items.find((item) => item.id === itemId);
    if (current && current.title === nextTitle) return;
    try {
      const { error } = await supabase
        .from("marketing_work_items")
        .update({ title: nextTitle })
        .eq("id", itemId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("השם עודכן");
      await refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "לא הצלחתי לעדכן את השם"));
    }
  };

  const deleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await supabase.from("marketing_assets").delete().eq("item_id", deleteTarget.id).eq("tenant_id", tenantId);
      const { error } = await supabase
        .from("marketing_work_items")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      if (selectedId === deleteTarget.id) setSelectedId(null);
      toast.success("הפרויקט נמחק");
      setDeleteTarget(null);
      await refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "המחיקה נכשלה"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/20" dir="rtl">
      <aside className="flex w-[280px] min-w-0 shrink-0 flex-col overflow-hidden border-e bg-background">
        <div className="flex items-center gap-2 px-3 py-3">
          <Button className="h-9 w-full min-w-0 justify-start gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 shrink-0" />פרויקט חדש
          </Button>
        </div>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
          <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">פרויקטים</div>
          {isLoading ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">אין פרויקטים עדיין. צרו אחד כמו אייג׳נט חדש.</p>
          ) : items.map((item) => {
            const owner = clients.find((client) => client.id === item.client_id);
            const title = item.title || "בלי שם";
            const isRenaming = renamingId === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  "group mb-0.5 flex w-full min-w-0 items-start gap-1 rounded-lg px-2 py-2 transition-colors",
                  selectedId === item.id ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  {isRenaming ? (
                    <Input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveRename(item.id);
                        }
                        if (event.key === "Escape") {
                          setRenameValue(item.title ?? "");
                          setRenamingId(null);
                        }
                      }}
                      onBlur={() => void saveRename(item.id)}
                      className="h-7 px-2 text-[13px]"
                    />
                  ) : (
                    <button type="button" onClick={() => setSelectedId(item.id)} className="block w-full min-w-0 overflow-hidden text-right">
                      <div className="block w-full truncate text-[13px] font-medium [unicode-bidi:plaintext]" dir="auto" title={title}>{title}</div>
                      <div className="mt-0.5 block w-full truncate text-[11px] text-muted-foreground [unicode-bidi:plaintext]" dir="rtl">
                        {owner?.name || "ללא לקוח"} · {typeLabel(asText(item.payload?.content_type) || "posts")} · {timeAgo(item.updated_at)}
                      </div>
                    </button>
                  )}
                </div>
                <div className={cn(
                  "flex shrink-0 items-center gap-0.5 transition-opacity",
                  selectedId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                )}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    title="עריכת שם"
                    onClick={(event) => {
                      event.stopPropagation();
                      startRename(item);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="מחיקת פרויקט"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(item);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b bg-background px-5 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                <PenLine className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 overflow-hidden text-right">
                <div className="truncate text-sm font-semibold [unicode-bidi:plaintext]" dir="auto" title={selected.title ?? ""}>{selected.title}</div>
                <div className="truncate text-[11px] text-muted-foreground [unicode-bidi:plaintext]" dir="rtl">
                  {agencyName ? `${agencyName} · ` : ""}{clientName || "לא משויך ללקוח"} · {typeLabel(asText(selected.payload?.content_type) || "posts")} · כרמן · קופירייטר
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />הגדרות
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handoff.mutate()} disabled={handoff.isPending}>
                <Send className="h-3.5 w-3.5" />לקריאייטיב
              </Button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-6" dir="rtl">
                {chat.filter((turn) => turn.role === "user").map((turn, index) => (
                  <div key={`${turn.at}-${index}`} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-right text-sm leading-relaxed [unicode-bidi:plaintext]" dir="auto">{turn.content}</div>
                  </div>
                ))}
                {pendingPrompt && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-right text-sm leading-relaxed [unicode-bidi:plaintext]" dir="auto">{pendingPrompt}</div>
                  </div>
                )}
                {sending && (
                  <div className="flex items-center justify-start gap-2 px-1 text-xs text-muted-foreground" dir="rtl">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>כרמן כותבת…</span>
                  </div>
                )}

                {copyText ? (
                  <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-2 text-[11px] text-muted-foreground" dir="rtl">
                      <span>הקופי — ניתן לערוך ישירות</span>
                      <Badge variant="outline" className="font-normal">כרמן · קופירייטר</Badge>
                    </div>
                    <CopyEditor key={`${selected.id}-${selected.updated_at}`} item={selected} tenantId={tenantId} onSaved={refresh} />
                  </div>
                ) : sending ? null : (
                  <div className="rounded-2xl border border-dashed bg-background/60 px-8 py-16 text-center" dir="rtl">
                    <PenLine className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                    <h2 className="text-lg font-semibold">פרויקט מוכן לכתיבה</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground [unicode-bidi:plaintext]">
                      הצ׳ט מחובר לכרמן עם סקין הקופירייטר בשיחה מבודדת
                    </p>
                    <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground [unicode-bidi:plaintext]">
                      פתחו הגדרות לבריף ושיוך, או כתבו למטה מה לכתוב
                    </p>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>
            </div>

            <div className="border-t bg-background px-5 py-3">
              <form
                className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendPrompt();
                }}
              >
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" onClick={() => setSettingsOpen(true)} title="בריף, קבצים והקלטות">
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendPrompt();
                    }
                  }}
                  placeholder={copyText ? "מה לשנות בקופי?" : "מה לכתוב? למשל: פוסט השקה לאינסטגרם, טון ישיר, קריאה לשיחה"}
                  className="min-h-[44px] max-h-36 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  rows={1}
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={sending || !composer.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </form>
              <p className="mx-auto mt-1.5 max-w-3xl px-1 text-right text-[10px] text-muted-foreground [unicode-bidi:plaintext]" dir="rtl">כרמן · סקין קופירייטר · שיחה נפרדת מהצ׳ט הראשי וממשימות הרקע</p>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <PenLine className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">מחלקת קופי</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground [unicode-bidi:plaintext]" dir="rtl">צרו פרויקט חדש כמו אייג׳נט. הקופי יופיע כאן לעריכה, והצ׳אט למטה ישפר אותו.</p>
            <Button className="mt-5 gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />פרויקט חדש</Button>
          </div>
        )}
      </section>

      <NewProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        defaultClientId={clientFilter !== ALL_CLIENTS_FILTER ? clientFilter : null}
        onCreated={async (id) => {
          setSelectedId(id);
          setCreateOpen(false);
          await refresh();
          setSettingsOpen(true);
        }}
      />

      {selected && (
        <ProjectSettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          item={selected}
          tenantId={tenantId}
          clients={clients}
          onClientChange={onClientChange}
          onSaved={refresh}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>למחוק את הפרויקט?</AlertDialogTitle>
            <AlertDialogDescription>
              {`"${deleteTarget?.title || "בלי שם"}" יימחק לצמיתות, כולל הקופי וההיסטוריה שלו.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deleteProject();
              }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "מחק"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CopyEditor({ item, tenantId, onSaved }: { item: CopyItem; tenantId: string; onSaved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const dark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
  const editor = useCreateBlockNote();

  useEffect(() => {
    const markdown = asText(item.payload?.copy_text);
    const parsed = markdown.trim() ? editor.tryParseMarkdownToBlocks(markdown) : [];
    const blocks = parsed.length > 0 ? parsed : [{ type: "paragraph" as const, content: " " }];
    editor.replaceBlocks(editor.document, blocks);
  }, [editor, item.id, item.payload?.copy_text]);

  const save = async () => {
    setSaving(true);
    try {
      const markdown = editor.blocksToMarkdownLossy(editor.document);
      const nextPayload = { ...(item.payload ?? {}), copy_text: markdown, department: "copy" };
      const { error: itemError } = await supabase
        .from("marketing_work_items")
        .update({ payload: nextPayload })
        .eq("id", item.id)
        .eq("tenant_id", tenantId);
      if (itemError) throw itemError;
      const { error: assetError } = await supabase.from("marketing_assets").insert({
        tenant_id: tenantId,
        item_id: item.id,
        stage_id: item.current_stage_id,
        type: "copy",
        content: markdown,
        meta: { source: "manual_edit", skin_slug: "copywriter" },
      });
      if (assetError) throw assetError;
      toast.success("נשמר");
      await onSaved();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "השמירה נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end border-b px-3 py-1.5">
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => void save()} disabled={saving}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}שמור
        </Button>
      </div>
      <div className="copy-bn p-4 [&_.bn-container]:[direction:rtl] [&_.bn-editor]:text-right [&_.bn-block-content]:text-right" dir="rtl">
        <BlockNoteView editor={editor} theme={dark ? "dark" : "light"} />
      </div>
    </div>
  );
}

function NewProjectDialog({
  open,
  onClose,
  tenantId,
  defaultClientId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  defaultClientId?: string;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      let pipelineId: string | null = null;
      let stageId: string | null = null;
      let website: string | null = null;
      let files: BriefFile[] = [];
      if (defaultClientId) {
        const pipeline = await ensurePipelineForClient({ clientId: defaultClientId, tenantId, track: "campaigns" });
        if (pipeline) {
          const { data: stages, error: stageError } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
          if (stageError) throw stageError;
          pipelineId = pipeline.id;
          stageId = stages?.find((stage) => stage.stage_type === "copy")?.id ?? null;
        }
        const { data: client } = await supabase
          .from("clients")
          .select("website,attachments")
          .eq("id", defaultClientId)
          .maybeSingle();
        website = client?.website ?? null;
        files = filesFromAttachments(client?.attachments);
      }
      const { data, error } = await supabase.from("marketing_work_items").insert({
        tenant_id: tenantId,
        client_id: defaultClientId ?? null,
        pipeline_id: pipelineId,
        current_stage_id: stageId,
        title: title.trim(),
        status: "draft",
        payload: {
          department: "copy",
          content_type: "posts",
          intake_source: "studio",
          client_website: website,
          client_files: files.map((file) => ({ name: file.name, path: file.path ?? null })),
        },
      }).select("id").single();
      if (error) throw error;
      setTitle("");
      onCreated(data.id);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "יצירת הפרויקט נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>פרויקט קופי חדש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>שם הפרויקט</Label>
            <Input
              className="mt-1"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void create()}
              placeholder="למשל: השקת שירות חדש"
            />
          </div>
          <p className="text-xs text-muted-foreground">אחרי היצירה תפתחנה ההגדרות: סוג תוצר, שיוך ללקוח, בריף והקלטות.</p>
          <Button onClick={() => void create()} disabled={saving || !title.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}צור פרויקט
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectSettings({
  open,
  onOpenChange,
  item,
  tenantId,
  clients,
  onClientChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CopyItem;
  tenantId: string;
  clients: ClientRow[];
  onClientChange: (id: string | null) => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [contentType, setContentType] = useState(asText(item.payload?.content_type) || "posts");
  const [brief, setBrief] = useState(asText(item.payload?.brief_text));
  const [assignedClientId, setAssignedClientId] = useState<string | null>(item.client_id);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(item.title ?? "");
    const rawType = asText(item.payload?.content_type);
    setContentType(rawType === "social_post" ? "posts" : rawType === "ad_copy" || rawType === "ad_script" ? "ads" : rawType === "video_script" ? "script" : rawType || "posts");
    setBrief(asText(item.payload?.brief_text));
    setAssignedClientId(item.client_id);
  }, [item, open]);

  const assignedClient = clients.find((client) => client.id === assignedClientId) ?? null;
  const briefFiles = filesFromAttachments(item.payload?.brief_files);

  const { data: recordings = [] } = useQuery({
    queryKey: ["copy-department-recordings", tenantId, assignedClientId],
    enabled: recordingsOpen,
    queryFn: async () => {
      let query = supabase
        .from("zoom_recordings")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("start_time", { ascending: false })
        .limit(50);
      if (assignedClientId) query = query.eq("client_id", assignedClientId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RecordingRow[];
    },
  });

  const applyClientContext = async (nextClientId: string | null, extra: Record<string, JsonValue> = {}) => {
    let pipelineId: string | null = null;
    let stageId: string | null = null;
    let website: string | null = null;
    let files: BriefFile[] = [];
    if (nextClientId) {
      const pipeline = await ensurePipelineForClient({ clientId: nextClientId, tenantId, track: "campaigns" });
      if (pipeline) {
        const { data: stages, error } = await supabase.from("marketing_pipeline_stages").select("id,stage_type").eq("pipeline_id", pipeline.id);
        if (error) throw error;
        pipelineId = pipeline.id;
        stageId = stages?.find((stage) => stage.stage_type === "copy")?.id ?? null;
      }
      const client = clients.find((row) => row.id === nextClientId);
      website = client?.website ?? null;
      files = filesFromAttachments(client?.attachments);
      onClientChange(nextClientId);
    }
    const nextPayload = {
      ...(item.payload ?? {}),
      ...extra,
      department: "copy",
      client_website: website,
      client_files: files.map((file) => ({ name: file.name, path: file.path })),
    };
    const { error } = await supabase.from("marketing_work_items").update({
      client_id: nextClientId,
      pipeline_id: pipelineId,
      current_stage_id: nextClientId ? (stageId ?? item.current_stage_id) : null,
      payload: nextPayload,
    }).eq("id", item.id).eq("tenant_id", tenantId);
    if (error) throw error;
  };

  const save = async () => {
    setSaving(true);
    try {
      await applyClientContext(assignedClientId, {
        brief_text: brief,
        content_type: contentType,
      });
      const { error } = await supabase.from("marketing_work_items").update({ title: title.trim() || item.title }).eq("id", item.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("ההגדרות נשמרו");
      await onSaved();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "שמירת ההגדרות נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploaded: BriefFile[] = [];
      for (const file of Array.from(files)) {
        const path = `${tenantId}/copy/${item.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error } = await supabase.storage.from("entity-attachments").upload(path, file);
        if (error) throw error;
        uploaded.push({ name: file.name, path, size: file.size, type: file.type });
      }
      const nextFiles = [...briefFiles, ...uploaded];
      const { error } = await supabase.from("marketing_work_items").update({
        payload: { ...(item.payload ?? {}), brief_files: nextFiles, department: "copy" },
      }).eq("id", item.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("הקובץ צורף לבריף");
      await onSaved();
    } catch (error: unknown) {
      toast.error(errorMessage(error, "ההעלאה נכשלה"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const attachRecording = async (recording: RecordingRow) => {
    const excerpt = String(recording.summary_md || recording.transcription || recording.notes || "").slice(0, 8000);
    if (!excerpt) {
      toast.error("אין תמלול או סיכום להקלטה הזו");
      return;
    }
    const nextBrief = brief || excerpt.slice(0, 1200);
    const { error } = await supabase.from("marketing_work_items").update({
      payload: {
        ...(item.payload ?? {}),
        department: "copy",
        recording_id: recording.id,
        recording_title: recording.meeting_topic ?? "פגישה",
        recording_excerpt: excerpt,
        brief_text: nextBrief,
      },
    }).eq("id", item.id).eq("tenant_id", tenantId);
    if (error) {
      toast.error(errorMessage(error, "לא הצלחתי לשייך את ההקלטה"));
      return;
    }
    setBrief(nextBrief);
    toast.success("הסיכום נמשך לבריף");
    setRecordingsOpen(false);
    await onSaved();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex w-full flex-col overflow-y-auto sm:max-w-md" dir="rtl">
        <SheetHeader>
          <SheetTitle>הגדרות פרויקט</SheetTitle>
        </SheetHeader>
        <div className="mt-6 grid gap-5 pb-8">
          <div>
            <Label>שם</Label>
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>

          <div>
            <Label>שיוך ללקוח / סוכנות</Label>
            <div className="mt-1">
              <ClientSelector
                tenantId={tenantId}
                value={assignedClientId}
                onChange={(id) => {
                  setAssignedClientId(id);
                  void (async () => {
                    try {
                      await applyClientContext(id, { brief_text: brief, content_type: contentType });
                      await onSaved();
                      toast.success(id ? "נמשך האתר והקבצים של הלקוח" : "השיוך הוסר");
                    } catch (error: unknown) {
                      toast.error(errorMessage(error, "השיוך נכשל"));
                    }
                  })();
                }}
                allowGeneral
                generalLabel="ללא לקוח"
              />
            </div>
          </div>

          {assignedClient && (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed">
              <div className="mb-2 font-medium">נמשך אוטומטית מהלקוח</div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {assignedClient.website ? (
                  <a className="underline-offset-2 hover:underline" href={/^https?:\/\//i.test(assignedClient.website) ? assignedClient.website : `https://${assignedClient.website}`} target="_blank" rel="noreferrer">
                    {assignedClient.website}
                  </a>
                ) : "אין אתר משויך ללקוח"}
              </div>
              <div className="mt-2 flex items-start gap-2 text-muted-foreground">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {filesFromAttachments(assignedClient.attachments).length > 0
                  ? filesFromAttachments(assignedClient.attachments).map((file) => file.name).join(" · ")
                  : "אין קבצים בתיק הלקוח"}
              </div>
            </div>
          )}

          <div>
            <Label>סוג הקופי</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {CONTENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setContentType(type.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-sm",
                    contentType === type.value ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "hover:bg-muted/60",
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>בריף</Label>
            <Textarea className="mt-1 min-h-32" value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="מטרה, קהל, מסר, דברים שאסור להמציא" />
          </div>

          <div>
            <Label>מקורות לבריף</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}העלאת קובץ
              </Button>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRecordingsOpen(true)}>
                <Mic className="h-3.5 w-3.5" />משיכה מהקלטות
              </Button>
              <input ref={fileInputRef} type="file" className="hidden" multiple onChange={(event) => void uploadFiles(event.target.files)} />
            </div>
            {briefFiles.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {briefFiles.map((file) => (
                  <li key={file.path || file.name} className="flex items-center gap-1.5"><FileText className="h-3 w-3" />{file.name}</li>
                ))}
              </ul>
            )}
            {asText(item.payload?.recording_title) && (
              <div className="mt-2 text-xs text-muted-foreground">הקלטה: {asText(item.payload?.recording_title)}</div>
            )}
          </div>

          <Separator />
          <Button onClick={() => void save()} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}שמור הגדרות
          </Button>
        </div>
      </SheetContent>

      <Dialog open={recordingsOpen} onOpenChange={setRecordingsOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>בחירת הקלטה / סיכום פגישה</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[420px]">
            <div className="space-y-1 py-2">
              {recordings.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">אין הקלטות עם תמלול ללקוח הזה</p>
              ) : recordings.map((recording) => (
                <button
                  key={recording.id}
                  className="w-full rounded-lg border px-3 py-2 text-right hover:bg-muted/60 disabled:opacity-50"
                  disabled={!recordingHasText(recording)}
                  onClick={() => void attachRecording(recording)}
                >
                  <div className="text-sm font-medium">{recording.meeting_topic || "פגישה"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {recording.start_time ? new Date(recording.start_time).toLocaleString("he-IL") : ""}
                    {recording.summary_md || recording.notes ? " · יש סיכום" : recording.transcription ? " · יש תמלול" : " · אין טקסט"}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
