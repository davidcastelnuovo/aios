import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import type { SeoGeoCalendarEntry } from "@/lib/seoGeoDb";
import { seoGeoDb } from "@/lib/seoGeoDb";

export function SeoGeoArticlePreviewDialog({
  entry,
  open,
  onClose,
  onSaved,
}: {
  entry: SeoGeoCalendarEntry | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [meta, setMeta] = useState("");
  const [html, setHtml] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title_draft || entry.title);
    setExcerpt(entry.excerpt || "");
    setMeta(entry.meta_description || "");
    setHtml(entry.content_html || "");
  }, [entry]);

  const save = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const { error } = await seoGeoDb.from("seo_geo_calendar_entries").update({
        title_draft: title.trim(),
        excerpt: excerpt.trim(),
        meta_description: meta.trim(),
        content_html: html,
        generation_status: html.trim() ? "draft" : entry.generation_status,
      }).eq("id", entry.id);
      if (error) throw error;
      toast.success("המאמר נשמר");
      onSaved();
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-hidden p-4 sm:p-6" dir="rtl">
        <DialogHeader><DialogTitle>פריוויו ועריכה</DialogTitle></DialogHeader>
        <div className="grid max-h-[calc(90dvh-5rem)] gap-4 overflow-y-auto lg:grid-cols-2">
          <div className="space-y-3">
            <div><Label>כותרת</Label><Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div><Label>תקציר</Label><Textarea className="mt-1 min-h-20" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} /></div>
            <div><Label>מטא תיאור</Label><Textarea className="mt-1 min-h-16" value={meta} onChange={(e) => setMeta(e.target.value)} /></div>
            <div><Label>HTML</Label><Textarea className="mt-1 min-h-64 font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} dir="rtl" /></div>
            <Button onClick={save} disabled={saving} className="gap-2"><Save className="h-4 w-4" />{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}שמור</Button>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">תצוגה</div>
            <h1 className="text-xl font-bold">{title}</h1>
            {excerpt ? <p className="mt-2 text-sm text-muted-foreground">{excerpt}</p> : null}
            <div className="prose prose-sm mt-4 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: html || "<p>—</p>" }} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
