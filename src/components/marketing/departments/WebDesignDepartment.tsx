import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ALL_CLIENTS_FILTER,
  applyClientFilter,
  type MarketingClientFilter,
} from "@/components/marketing/clientFilter";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import { isCopyDepartmentItem } from "@/components/marketing/departmentFilters";
import {
  previewUrl,
  publicWebDesignBucket,
  slugifyWebProject,
  type WebDesignProject,
  webDesignStoragePath,
} from "@/components/marketing/lib/webDesign";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  ExternalLink,
  FilePlus2,
  Globe,
  Loader2,
  Plus,
  Rocket,
  Save,
  Upload,
  WandSparkles,
} from "lucide-react";

interface Props {
  clientFilter: MarketingClientFilter;
  tenantId: string;
  onClientChange: (id: string | null) => void;
}

const message = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const STATUS_LABEL: Record<string, string> = {
  draft: "טיוטה",
  building: "בבנייה",
  preview: "תצוגה מקדימה",
  published: "פורסם",
  failed: "נכשל",
};

export function WebDesignDepartment({ clientFilter, tenantId, onClientChange }: Props) {
  const queryClient = useQueryClient();
  const { tenant } = useCurrentTenant();
  const tenantSlug = tenant?.slug ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [building, setBuilding] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["web-design-projects", clientFilter, tenantId],
    queryFn: async () => {
      let query = supabase
        .from("web_design_projects" as "marketing_work_items")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      query = applyClientFilter(query, clientFilter) as typeof query;
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as WebDesignProject[];
    },
  });

  const { data: clientRow } = useQuery({
    queryKey: ["web-design-client", clientFilter],
    queryFn: async () => {
      if (!clientFilter || clientFilter === ALL_CLIENTS_FILTER) return null;
      const { data } = await supabase.from("clients").select("id,name,website").eq("id", clientFilter).maybeSingle();
      return data;
    },
    enabled: !!clientFilter && clientFilter !== ALL_CLIENTS_FILTER,
  });

  const { data: copyItems = [] } = useQuery({
    queryKey: ["web-design-copy-items", clientFilter, tenantId],
    queryFn: async () => {
      if (!clientFilter || clientFilter === ALL_CLIENTS_FILTER) return [];
      const { data, error } = await supabase
        .from("marketing_work_items")
        .select("id,title,payload,updated_at")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientFilter)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []).filter((row) => isCopyDepartmentItem(row as { payload?: Record<string, unknown> }));
    },
    enabled: !!clientFilter && clientFilter !== ALL_CLIENTS_FILTER,
  });

  useEffect(() => {
    if (!selectedId && items[0]?.id) setSelectedId(items[0].id);
    if (selectedId && !items.some((item) => item.id === selectedId)) {
      setSelectedId(items[0]?.id ?? null);
    }
  }, [items, selectedId]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const [draftCopy, setDraftCopy] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftRefUrl, setDraftRefUrl] = useState("");
  const [draftCopyItemId, setDraftCopyItemId] = useState<string>("none");

  useEffect(() => {
    if (!selected) return;
    setDraftCopy(selected.copy_snapshot ?? "");
    setDraftNotes(selected.intake_notes ?? "");
    setDraftRefUrl(selected.reference_url ?? "");
    setDraftCopyItemId(selected.copy_work_item_id ?? "none");
  }, [selected?.id]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["web-design-projects", clientFilter, tenantId] });

  const saveIntake = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const copySource = draftCopyItemId !== "none" ? "copy_department" : "manual";
      const { error } = await supabase
        .from("web_design_projects" as "marketing_work_items")
        .update({
          copy_snapshot: draftCopy.trim() || null,
          intake_notes: draftNotes.trim() || null,
          reference_url: draftRefUrl.trim() || null,
          copy_source: copySource,
          copy_work_item_id: draftCopyItemId === "none" ? null : draftCopyItemId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("הבריף נשמר");
      await refresh();
    } catch (error: unknown) {
      toast.error(message(error, "שמירה נכשלה"));
    } finally {
      setSaving(false);
    }
  };

  const runBuild = async () => {
    if (!selected) return;
    setBuilding(true);
    try {
      await saveIntake();
      const { data, error } = await supabase.functions.invoke("cursor-build-web", {
        body: { action: "build", tenant_id: tenantId, project_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("הבנייה נשלחה לסוכן Cursor");
      if (data?.agent_url) window.open(data.agent_url, "_blank", "noopener,noreferrer");
      await refresh();
    } catch (error: unknown) {
      toast.error(message(error, "שליחת בנייה נכשלה"));
    } finally {
      setBuilding(false);
    }
  };

  const publish = async () => {
    if (!selected) return;
    try {
      const { data, error } = await supabase.functions.invoke("cursor-build-web", {
        body: { action: "publish", tenant_id: tenantId, project_id: selected.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("הדף פורסם");
      await refresh();
    } catch (error: unknown) {
      toast.error(message(error, "פרסום נכשל"));
    }
  };

  const uploadRefs = async (files: FileList | null) => {
    if (!selected || !files?.length) return;
    const paths = [...(selected.reference_image_paths ?? [])];
    for (const file of Array.from(files).slice(0, 8)) {
      const path = webDesignStoragePath(tenantId, selected.id, file.name);
      const { error } = await supabase.storage.from(publicWebDesignBucket()).upload(path, file, { upsert: true });
      if (error) {
        toast.error(`העלאה נכשלה: ${file.name}`);
        continue;
      }
      paths.push(path);
    }
    const { error } = await supabase
      .from("web_design_projects" as "marketing_work_items")
      .update({ reference_image_paths: paths, updated_at: new Date().toISOString() })
      .eq("id", selected.id);
    if (error) toast.error(message(error, "עדכון רפרנסים נכשל"));
    else {
      toast.success("תמונות רפרנס נשמרו");
      await refresh();
    }
  };

  const publicBase = useMemo(() => {
    const fromEnv = import.meta.env.VITE_WEB_DESIGN_PUBLIC_BASE_URL as string | undefined;
    return (fromEnv || selected?.public_url?.replace(/\/[^/]+\/[^/]+\/?$/, "") || "").trim();
  }, [selected?.public_url]);

  const previewLink =
    selected?.preview_token && tenantSlug && selected.slug
      ? previewUrl(publicBase, tenantSlug, selected.slug, selected.preview_token)
      : "";

  const website = clientRow?.website ?? null;
  const websiteHref =
    website && /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : null;

  const needsClientForCreate = clientFilter === ALL_CLIENTS_FILTER;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[270px_minmax(0,1fr)_280px] bg-muted/10">
      <aside className="flex min-h-0 flex-col border-l bg-card/70">
        <div className="flex items-center justify-between border-b p-3">
          <div>
            <h2 className="text-sm font-bold">פרויקטי אתר</h2>
            <p className="text-[11px] text-muted-foreground">נחיתה ומיני־אתר</p>
          </div>
          <Button
            size="icon"
            className="h-8 w-8 bg-cyan-600 hover:bg-cyan-700"
            onClick={() => setCreateOpen(true)}
            disabled={needsClientForCreate}
            title={needsClientForCreate ? "בחרו לקוח ספציפי ליצירת פרויקט" : undefined}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {clientFilter === ALL_CLIENTS_FILTER && (
          <p className="border-b px-3 py-2 text-[10px] text-muted-foreground">מציגים כל הלקוחות — ליצירה בחרו לקוח בתצוגה למעלה.</p>
        )}
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-2">
            {isLoading ? (
              <Loader2 className="mx-auto mt-8 h-5 w-5 animate-spin" />
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <FilePlus2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
                אין פרויקטים עדיין
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
                  <div className="truncate text-xs font-semibold">{item.title}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {STATUS_LABEL[item.status] ?? item.status} · {item.kind}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-col">
        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b bg-card/60 px-4 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
                <Globe className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-bold">{selected.title}</h2>
                <p className="text-[11px] text-muted-foreground">{selected.slug}</p>
              </div>
              <Badge variant="outline">{STATUS_LABEL[selected.status] ?? selected.status}</Badge>
              <Button size="sm" variant="outline" className="gap-1" onClick={saveIntake} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                שמור
              </Button>
              <Button size="sm" className="gap-1 bg-cyan-600 hover:bg-cyan-700" onClick={runBuild} disabled={building}>
                {building ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                שלח לבנייה
              </Button>
              {(selected.status === "preview" || selected.status === "published") && (
                <Button size="sm" variant="secondary" className="gap-1" onClick={publish}>
                  <Rocket className="h-3.5 w-3.5" />
                  פרסם
                </Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-5">
                <Card className="space-y-3 p-4">
                  <Label>לינק רפרנס (אופציונלי)</Label>
                  <Input value={draftRefUrl} onChange={(e) => setDraftRefUrl(e.target.value)} placeholder="https://..." dir="ltr" />
                </Card>
                <Card className="space-y-3 p-4">
                  <Label>קופי — ידני או ממחלקת קופי</Label>
                  <Select
                    value={draftCopyItemId}
                    onValueChange={(value) => {
                      setDraftCopyItemId(value);
                      if (value === "none") return;
                      const item = copyItems.find((row) => row.id === value);
                      const payload = (item?.payload ?? {}) as Record<string, unknown>;
                      const text =
                        (typeof payload.copy_text === "string" ? payload.copy_text : null) ??
                        (typeof payload.brief_text === "string" ? payload.brief_text : null) ??
                        "";
                      if (text) setDraftCopy(text);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="שיוך מקופי" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">ללא שיוך — קופי ידני בלבד</SelectItem>
                      {copyItems.map((row) => (
                        <SelectItem key={row.id} value={row.id}>{row.title || row.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    className="min-h-40"
                    value={draftCopy}
                    onChange={(e) => setDraftCopy(e.target.value)}
                    placeholder="טקסט לדף הנחיתה..."
                  />
                </Card>
                <Card className="space-y-3 p-4">
                  <Label>הערות לבריף</Label>
                  <Textarea value={draftNotes} onChange={(e) => setDraftNotes(e.target.value)} className="min-h-24" />
                </Card>
                <Card className="space-y-3 p-4">
                  <Label>תמונות רפרנס</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      className="text-xs"
                      onChange={(e) => uploadRefs(e.target.files)}
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {(selected.reference_image_paths ?? []).length} קבצים שמורים
                  </p>
                </Card>
                {selected.cursor_session_url && (
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <a href={selected.cursor_session_url} target="_blank" rel="noreferrer">
                      סשן בנייה ב-Cursor
                    </a>
                  </Button>
                )}
                {selected.last_build_error && (
                  <Card className="border-red-200 bg-red-50 p-3 text-xs text-red-700">{selected.last_build_error}</Card>
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
          <h3 className="text-sm font-bold">{clientRow?.name ?? "לקוח"}</h3>
          <p className="text-[11px] text-muted-foreground">פרסום וקישורים</p>
        </div>
        <div className="space-y-3 p-4">
          {websiteHref ? (
            <a href={websiteHref} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">{website}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">אין אתר ב-CRM</p>
          )}
          {previewLink && (
            <a href={previewLink} target="_blank" rel="noreferrer" className="block text-xs text-primary hover:underline">
              תצוגה מקדימה (לפני פרסום)
            </a>
          )}
          {selected?.public_url && selected.status === "published" && (
            <a href={selected.public_url} target="_blank" rel="noreferrer" className="block text-xs font-medium text-primary hover:underline">
              {selected.public_url}
            </a>
          )}
          {!publicBase && (
            <Card className="p-3 text-[11px] text-muted-foreground">
              הגדירו `WEB_DESIGN_PUBLIC_BASE_URL` ב-Supabase ו-`VITE_WEB_DESIGN_PUBLIC_BASE_URL` ב-Vercel CRM כדי להציג קישור ציבורי (ראו `apps/landing-studio/README.md`).
            </Card>
          )}
        </div>
      </aside>

      <CreateWebProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantId={tenantId}
        clientId={clientFilter === ALL_CLIENTS_FILTER ? null : clientFilter}
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
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  clientId: string | null;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"landing" | "minisite">("landing");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !clientId) return;
    setSaving(true);
    try {
      const slug = slugifyWebProject(title);
      const { data, error } = await supabase
        .from("web_design_projects" as "marketing_work_items")
        .insert({
          tenant_id: tenantId,
          client_id: clientId,
          slug,
          title: title.trim(),
          kind,
          status: "draft",
          copy_source: "manual",
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("פרויקט נוצר");
      onCreated(data.id);
      setTitle("");
      setKind("landing");
    } catch (error: unknown) {
      toast.error(message(error, "יצירה נכשלה"));
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
            <Label>שם</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>סוג</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as "landing" | "minisite")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="landing">דף נחיתה</SelectItem>
                <SelectItem value="minisite">מיני־אתר (שלב 2 — כרגע דף ראשי)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={saving || !clientId || !title.trim()} onClick={handleCreate}>
            {saving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
            צור פרויקט
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
