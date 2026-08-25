import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CreativeImage } from "@/components/marketing/departments/creative/CreativeImage";
import {
  deriveBrandBook,
  sampleColorsFromFile,
  uploadCreativeAsset,
  type BrandBook,
} from "./brandKit";
import { ClientSelector } from "@/components/marketing/ClientSelector";
import {
  filesFromAttachments,
  websiteHref,
} from "./brandKit";
import { Globe, Lightbulb, Link2, Loader2, Paperclip, RefreshCw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import type { CreativeItem, CreativeProjectDraft } from "./types";
import { itemToProjectDraft, projectTypeLabel } from "./utils";
import { VisualStyleSelect } from "./VisualStyleSelect";
import { toast } from "sonner";
import { parseCopyConceptsFromPayload } from "@/components/marketing/copyConcepts";

export interface CreativeClientHint {
  id?: string;
  name?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
  attachments?: unknown;
}

interface Props {
  item: CreativeItem;
  tenantId: string;
  client?: CreativeClientHint | null;
  onSave: (draft: CreativeProjectDraft) => Promise<void>;
  onAssignClient?: (clientId: string | null, draft: CreativeProjectDraft) => Promise<void>;
  saving?: boolean;
  pullingCopy?: boolean;
  refreshingLinkedCopy?: boolean;
  onPullCopy?: () => void;
  onRefreshLinkedCopy?: () => void;
}

export function CreativeBriefEditor({
  item,
  tenantId,
  client,
  onSave,
  onAssignClient,
  saving,
  pullingCopy,
  refreshingLinkedCopy,
  onPullCopy,
  onRefreshLinkedCopy,
}: Props) {
  const [draft, setDraft] = useState<CreativeProjectDraft>(() => itemToProjectDraft(item));
  const [assigning, setAssigning] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "reference" | "brandbook" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refsInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);
  const concepts = parseCopyConceptsFromPayload(item.payload);
  const linkedCopyTitle = typeof item.payload?.linked_copy_title === "string" ? item.payload.linked_copy_title.trim() : "";
  const linkedCopyId = typeof item.payload?.linked_copy_item_id === "string" ? item.payload.linked_copy_item_id : "";
  const approvedCount = concepts.filter((concept) => concept.approved).length;
  const copyBusy = !!pullingCopy || !!refreshingLinkedCopy;

  useEffect(() => {
    setDraft(itemToProjectDraft(item));
  }, [item.id, item.updated_at, item.client_id, item.payload?.linked_copy_item_id, item.payload?.copy_text]);

  const patchBook = (patch: Partial<BrandBook>) => {
    const current = draft.brandBook ?? { colors: [], notes: "", source: "manual" as const };
    setDraft({ ...draft, brandBook: { ...current, ...patch, source: patch.source ?? "manual" } });
  };

  const upload = async (kind: "logo" | "reference" | "brandbook", files: FileList | null) => {
    if (!files?.length) return;
    setUploading(kind);
    try {
      const uploaded = [];
      let logoColors: string[] = [];
      for (const file of Array.from(files)) {
        const asset = await uploadCreativeAsset({
          supabase,
          tenantId,
          itemId: item.id,
          file,
          kind: kind === "brandbook" ? "brandbook" : kind,
        });
        uploaded.push({ ...asset, file });
        if (kind === "logo" && file.type.startsWith("image/")) {
          logoColors = await sampleColorsFromFile(file);
        }
      }
      if (kind === "logo") {
        const first = uploaded[0];
        setDraft((current) => ({
          ...current,
          logoUrl: first.url,
          brandBook: current.brandBook
            ? { ...current.brandBook, colors: current.brandBook.colors.length ? current.brandBook.colors : logoColors }
            : logoColors.length
              ? { colors: logoColors, notes: "", source: "auto" }
              : current.brandBook,
        }));
        toast.success("הלוגו הועלה — יישמר כשכבה, לא ייצבע מחדש");
      } else if (kind === "brandbook") {
        const first = uploaded[0];
        setDraft((current) => ({
          ...current,
          brandBook: {
            ...(current.brandBook ?? { colors: [], notes: "", source: "upload" as const }),
            fileUrl: first.url,
            fileName: first.name,
            source: "upload",
          },
        }));
        toast.success("קובץ הברנדבוק צורף");
      } else {
        setDraft((current) => ({
          ...current,
          styleReferences: [
            ...current.styleReferences,
            ...uploaded.map((asset) => ({ url: asset.url, name: asset.name })),
          ],
        }));
        toast.success(uploaded.length === 1 ? "הרפרנס הועלה" : `${uploaded.length} רפרנסים הועלו`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setUploading(null);
      if (logoInputRef.current) logoInputRef.current.value = "";
      if (refsInputRef.current) refsInputRef.current.value = "";
      if (bookInputRef.current) bookInputRef.current.value = "";
    }
  };

  const assignClient = async (clientId: string | null) => {
    const next = { ...draft, clientId };
    setDraft(next);
    if (!onAssignClient) return;
    setAssigning(true);
    try {
      await onAssignClient(clientId, next);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "השיוך נכשל");
    } finally {
      setAssigning(false);
    }
  };

  const autoBrandBook = () => {
    const book = deriveBrandBook({
      clientName: client?.name ?? undefined,
      website: client?.website ?? draft.clientWebsite,
      industry: client?.industry ?? undefined,
      brief: [draft.briefText, client?.notes].filter(Boolean).join("\n"),
      copy: draft.copyText,
      colors: draft.brandBook?.colors,
      existing: draft.brandBook,
    });
    setDraft({ ...draft, brandBook: book });
    toast.success("נוצר ברנדבוק אוטומטי מהלקוח, הבריף והלוגו");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">עריכת פרויקט — בריף, מותג ורפרנסים</span>
          <Badge variant="outline">{projectTypeLabel(draft.projectType)}</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onSave(draft)} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          שמור פרויקט
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-3xl gap-4">
          <div>
            <Label>שם הפרויקט</Label>
            <Input
              className="mt-1"
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </div>
          <div>
            <Label>פורמט</Label>
            <Select value={draft.format} onValueChange={(value: CreativeProjectDraft["format"]) => setDraft({ ...draft, format: value })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="9:16">סטורי / רילס 9:16</SelectItem>
                <SelectItem value="1:1">פוסט מרובע 1:1</SelectItem>
                <SelectItem value="4:5">פיד 4:5</SelectItem>
                <SelectItem value="16:9">וידאו רחב 16:9</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>שיוך ללקוח / סוכנות</Label>
            <div className="mt-1">
              <ClientSelector
                tenantId={tenantId}
                value={draft.clientId ?? null}
                onChange={(id) => void assignClient(id)}
                allowGeneral
                generalLabel="ללא לקוח"
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              כמו בקופי — נמשך האתר, הקבצים והסגנון של הלקוח לברנדבוק ולרפרנסים.
            </p>
          </div>

          {(client || draft.clientWebsite || assigning) && (
            <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed">
              <div className="mb-2 font-medium">{assigning ? "מושך מהלקוח..." : "נמשך אוטומטית מהלקוח"}</div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {draft.clientWebsite || client?.website ? (
                  <a
                    className="underline-offset-2 hover:underline"
                    href={websiteHref(draft.clientWebsite || client?.website)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {draft.clientWebsite || client?.website}
                  </a>
                ) : "אין אתר משויך ללקוח"}
              </div>
              <div className="mt-2 flex items-start gap-2 text-muted-foreground">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {filesFromAttachments(client?.attachments).length > 0
                  ? filesFromAttachments(client?.attachments).map((file) => file.name).join(" · ")
                  : "אין קבצים בתיק הלקוח"}
              </div>
            </div>
          )}

          <VisualStyleSelect
            value={draft.visualStyle}
            onChange={(visualStyle) => setDraft({ ...draft, visualStyle })}
          />

          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <Label>לוגו המותג</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                מורכב כשכבה מעל התמונה — המודל לא ממציא ולא מצייר מחדש את הלוגו.
              </p>
            </div>
            {draft.logoUrl && (
              <div className="flex h-20 w-36 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-2">
                <CreativeImage src={draft.logoUrl} alt="לוגו" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(event) => void upload("logo", event.target.files)}
              />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => logoInputRef.current?.click()} disabled={!!uploading}>
                {uploading === "logo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {draft.logoUrl ? "החלף לוגו" : "העלה לוגו"}
              </Button>
              {draft.logoUrl && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => setDraft({ ...draft, logoUrl: undefined })}>
                  <Trash2 className="h-3.5 w-3.5" />הסר
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label>ברנדבוק</Label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  אם יש קובץ — העלה. אם אין, יוצרים אוטומטית מלקוח / בריף / צבעי לוגו.
                </p>
              </div>
              {draft.brandBook?.source && <Badge variant="outline">{draft.brandBook.source === "auto" ? "אוטומטי" : draft.brandBook.source === "upload" ? "הועלה" : "ידני"}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={autoBrandBook}>
                <Sparkles className="h-3.5 w-3.5" />צור ברנדבוק אוטומטית
              </Button>
              <input
                ref={bookInputRef}
                type="file"
                accept="image/*,.pdf,.txt,.md"
                className="hidden"
                onChange={(event) => void upload("brandbook", event.target.files)}
              />
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => bookInputRef.current?.click()} disabled={!!uploading}>
                {uploading === "brandbook" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                העלה ברנדבוק
              </Button>
            </div>
            {draft.brandBook?.fileName && (
              <p className="text-[11px] text-muted-foreground">קובץ מצורף: {draft.brandBook.fileName}</p>
            )}
            <div>
              <Label>צבעי מותג</Label>
              <Input
                className="mt-1"
                value={(draft.brandBook?.colors ?? []).join(", ")}
                onChange={(event) => patchBook({
                  colors: event.target.value.split(/[,\s]+/).map((item) => item.trim()).filter((item) => /^#([0-9a-fA-F]{3,8})$/.test(item)),
                })}
                placeholder="#1d4ed8, #111827"
              />
            </div>
            <div>
              <Label>טון / קול</Label>
              <Input
                className="mt-1"
                value={draft.brandBook?.voice ?? ""}
                onChange={(event) => patchBook({ voice: event.target.value })}
                placeholder="יוקרתי, ישיר, ישראלי..."
              />
            </div>
            <div>
              <Label>הערות ברנד</Label>
              <Textarea
                className="mt-1 min-h-28"
                value={draft.brandBook?.notes ?? ""}
                onChange={(event) => patchBook({ notes: event.target.value })}
                placeholder="חוקים, צבעים, מה אסור, איך הלוגו יושב"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-xl border p-4">
            <div>
              <Label>רפרנסים לסגנון</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                תמונות ייחוס ליצירה — המודל ייקח תאורה, חומר וגרייד, בלי להעתיק לוגו או אותיות.
              </p>
            </div>
            {draft.styleReferences.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {draft.styleReferences.map((reference, index) => (
                  <div key={`${reference.url}-${index}`} className="relative overflow-hidden rounded-lg border">
                    <CreativeImage src={reference.url} alt={reference.name || "רפרנס"} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      className="absolute left-1 top-1 rounded-full bg-black/70 p-1 text-white"
                      onClick={() => setDraft({
                        ...draft,
                        styleReferences: draft.styleReferences.filter((_, itemIndex) => itemIndex !== index),
                      })}
                      aria-label="הסר רפרנס"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={refsInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(event) => void upload("reference", event.target.files)}
            />
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => refsInputRef.current?.click()} disabled={!!uploading}>
              {uploading === "reference" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              העלה רפרנס
            </Button>
          </section>

          <div>
            <Label>בריף / חומר גלם</Label>
            <Textarea
              className="mt-1 min-h-40"
              value={draft.briefText}
              onChange={(event) => setDraft({ ...draft, briefText: event.target.value })}
              placeholder="מטרה, קהל, סגנון, רפרנסים, מגבלות"
            />
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <Label>קופי משויך</Label>
              {linkedCopyTitle ? (
                <span className="truncate text-[11px] text-muted-foreground">מקור: {linkedCopyTitle}</span>
              ) : (
                <span className="text-[11px] text-muted-foreground">אין פרויקט קופי משויך</span>
              )}
            </div>
            <Textarea
              className="mt-1 min-h-28"
              value={draft.copyText}
              onChange={(event) => setDraft({ ...draft, copyText: event.target.value })}
              placeholder="הטקסט שיופיע על הקריאייטיב או ילווה את הסרטון"
            />
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                <Label>קונספטים מהקופי</Label>
                {approvedCount > 0 && (
                  <Badge variant="secondary" className="h-5 font-normal">{approvedCount} מאושרים</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {linkedCopyId && onRefreshLinkedCopy && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 gap-1.5"
                    onClick={onRefreshLinkedCopy}
                    disabled={copyBusy}
                  >
                    {refreshingLinkedCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    רענן מהמשויך
                  </Button>
                )}
                {onPullCopy && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={onPullCopy}
                    disabled={copyBusy}
                  >
                    {pullingCopy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    משוך מקופי
                  </Button>
                )}
              </div>
            </div>
            {concepts.length === 0 ? (
              <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
                אין קונספטים על הפרויקט. משכו פרויקט ממחלקת הקופי כדי לצרף קופי וקונספטים מאושרים.
              </p>
            ) : (
              concepts.map((concept) => (
                <div key={concept.id} className="rounded-lg border bg-muted/30 p-3 text-right">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{concept.name}</div>
                    {concept.approved ? (
                      <Badge className="h-5 bg-emerald-600 hover:bg-emerald-600">מאושר</Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 font-normal">לא אושר</Badge>
                    )}
                  </div>
                  {concept.bigIdea && <p className="mt-1 text-xs leading-relaxed">{concept.bigIdea}</p>}
                  {concept.visualLanguage && (
                    <p className="mt-1 text-[11px] text-muted-foreground">ויזואל: {concept.visualLanguage}</p>
                  )}
                  {concept.hook && (
                    <p className="mt-1 text-[11px] text-muted-foreground">הוק: {concept.hook}</p>
                  )}
                  {concept.copyAngle && (
                    <p className="mt-1 text-[11px] text-muted-foreground">זווית קופי: {concept.copyAngle}</p>
                  )}
                </div>
              ))
            )}
          </div>
          <div>
            <Label>הנחיות מיוחדות</Label>
            <Textarea
              className="mt-1 min-h-24"
              dir="rtl"
              value={draft.instructions}
              onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
              placeholder="טון, דברים שחייבים להופיע, מה אסור"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              יש דמות ברפרנס? כתבו «תשתמש בדמות מהרפרנס» — Cursor ישמור את הפנים. ברירת המחדל: קריאייטיב סופי עם עברית מצוירת על התמונה.
            </p>
          </div>
          <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="min-w-0">
              <Label htmlFor="live-text-layers">טקסט חי (שכבות)</Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                פיצ׳ר צדדי. כבוי כברירת מחדל. כשדולק — התמונה בלי אותיות והעברית מורכבת כשכבות לעריכה ידנית.
              </p>
            </div>
            <Switch
              id="live-text-layers"
              checked={!!draft.liveTextLayers}
              onCheckedChange={(checked) => setDraft({ ...draft, liveTextLayers: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
