import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Loader2, Save, Sparkles, Trash2, Upload } from "lucide-react";
import type { CreativeItem, CreativeProjectDraft } from "./types";
import { itemToProjectDraft, projectTypeLabel } from "./utils";
import { VisualStyleSelect } from "./VisualStyleSelect";
import { toast } from "sonner";

export interface CreativeClientHint {
  name?: string | null;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

interface Props {
  item: CreativeItem;
  tenantId: string;
  client?: CreativeClientHint | null;
  onSave: (draft: CreativeProjectDraft) => Promise<void>;
  saving?: boolean;
}

export function CreativeBriefEditor({ item, tenantId, client, onSave, saving }: Props) {
  const [draft, setDraft] = useState<CreativeProjectDraft>(() => itemToProjectDraft(item));
  const [uploading, setUploading] = useState<"logo" | "reference" | "brandbook" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refsInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(itemToProjectDraft(item));
  }, [item.id, item.updated_at]);

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

  const autoBrandBook = () => {
    const book = deriveBrandBook({
      clientName: client?.name ?? undefined,
      website: client?.website ?? undefined,
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
            <Label>קופי משויך</Label>
            <Textarea
              className="mt-1 min-h-28"
              value={draft.copyText}
              onChange={(event) => setDraft({ ...draft, copyText: event.target.value })}
              placeholder="הטקסט שיופיע על הקריאייטיב או ילווה את הסרטון"
            />
          </div>
          <div>
            <Label>הנחיות מיוחדות</Label>
            <Textarea
              className="mt-1 min-h-24"
              value={draft.instructions}
              onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
              placeholder="טון, דברים שחייבים להופיע, מה אסור"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
