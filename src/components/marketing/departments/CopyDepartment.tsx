import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { supabase } from "@/integrations/supabase/client";
import { ensurePipelineForClient } from "@/components/marketing/lib/ensurePipeline";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  PenLine,
  Plus,
  Save,
  Send,
  Settings2,
  Upload,
} from "lucide-react";

interface Props {
  clientId?: string;
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

export function CopyDepartment({ clientId, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["copy-department-items", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id,title,status,payload,current_stage_id,target_channel,client_id,created_at,updated_at")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as CopyItem[]).filter((item) => {
        const payload = item.payload ?? {};
        return payload.department === "copy" || !!payload.brief_text || !!payload.copy_text || !!payload.copy_chat;
      });
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
    await queryClient.invalidateQueries({ queryKey: ["copy-department-items", tenantId] });
  };

  const sendPrompt = async () => {
    if (!selected || !composer.trim() || sending) return;
    const prompt = composer.trim();
    setComposer("");
    setPendingPrompt(prompt);
    setSending(true);
    try {
      const hasCopy = !!asText(selected.payload?.copy_text);
      const hasBrief = !!asText(selected.payload?.brief_text) || !!asText(selected.payload?.recording_excerpt);
      const mode = hasCopy ? "improve" : hasBrief ? "brief" : "autopilot";
      const { data, error } = await supabase.functions.invoke("marketing-copy-plan", {
        body: { item_id: selected.id, prompt, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
      const { error } = await supabase
        .from("marketing_work_items")
        .update({ current_stage_id: creativeStage.id, status: "draft", pipeline_id: pipeline.id })
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

  return (
    <div className="flex min-h-0 flex-1 bg-muted/20" dir="rtl">
      <aside className="flex w-[280px] shrink-0 flex-col border-l bg-background">
        <div className="flex items-center gap-2 px-3 py-3">
          <Button className="h-9 flex-1 justify-start gap-2 rounded-lg bg-foreground text-background hover:bg-foreground/90" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />פרויקט חדש
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-2 pb-3">
            <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">פרויקטים</div>
            {isLoading ? (
              <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-muted-foreground" />
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-xs text-muted-foreground">אין פרויקטים עדיין. צרו אחד כמו אייג׳נט חדש.</p>
            ) : items.map((item) => {
              const owner = clients.find((client) => client.id === item.client_id);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "mb-0.5 w-full rounded-lg px-3 py-2.5 text-right transition-colors",
                    selectedId === item.id ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{item.title || "בלי שם"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {owner?.name || "ללא לקוח"} · {typeLabel(asText(item.payload?.content_type) || "posts")}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(item.updated_at)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b bg-background px-5 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white">
                <PenLine className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{selected.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {agencyName ? `${agencyName} · ` : ""}{clientName || "לא משויך ללקוח"} · {typeLabel(asText(selected.payload?.content_type) || "posts")}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setSettingsOpen(true)}>
                <Settings2 className="h-4 w-4" />הגדרות
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handoff.mutate()} disabled={handoff.isPending}>
                <Send className="h-3.5 w-3.5" />לקריאייטיב
              </Button>
            </header>

            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-6">
                {chat.filter((turn) => turn.role === "user").map((turn, index) => (
                  <div key={`${turn.at}-${index}`} className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">{turn.content}</div>
                  </div>
                ))}
                {pendingPrompt && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-muted px-4 py-2.5 text-sm leading-relaxed">{pendingPrompt}</div>
                  </div>
                )}
                {sending && (
                  <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    כרמן כותבת…
                  </div>
                )}

                {copyText ? (
                  <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
                    <div className="flex items-center justify-between border-b px-4 py-2 text-[11px] text-muted-foreground">
                      <span>הקופי — ניתן לערוך ישירות</span>
                      <Badge variant="outline" className="font-normal">כרמן</Badge>
                    </div>
                    <CopyEditor key={`${selected.id}-${selected.updated_at}`} item={selected} tenantId={tenantId} onSaved={refresh} />
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed bg-background/60 px-8 py-16 text-center">
                    <PenLine className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                    <h2 className="text-lg font-semibold">פרויקט מוכן לכתיבה</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      פתחו הגדרות לבריף, סוג תוצר ושיוך ללקוח — או כתבו למטה מה כרמן צריכה ליצור.
                    </p>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>
            </ScrollArea>

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
                  placeholder={copyText ? "מה לשנות בקופי?" : "מה לכתוב? למשל: פוסט השקה לאינסטגרם, טון ישיר, CTA לשיחה"}
                  className="min-h-[44px] max-h-36 flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  rows={1}
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-xl" disabled={sending || !composer.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600 text-white">
              <PenLine className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold">מחלקת קופי</h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">צרו פרויקט חדש כמו אייג׳נט. הקופי יופיע כאן לעריכה, והצ׳אט למטה ישפר אותו.</p>
            <Button className="mt-5 gap-2" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />פרויקט חדש</Button>
          </div>
        )}
      </section>

      <NewProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        defaultClientId={clientId}
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
      <div className="p-4" dir="rtl">
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
