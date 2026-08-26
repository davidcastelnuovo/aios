import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Plus, Search, Sparkles, Loader2, Trash2, Pencil, Download, BookOpen } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_LABELS, type PromptInsight, type PromptStatus, visibilityCsv } from "@/lib/aiVisibilityInsights";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { he } from "date-fns/locale";

export type TrackedPrompt = PromptInsight;

interface PromptTrackerProps {
  prompts: TrackedPrompt[];
  onAddPrompt: (prompt: string, category: string) => void;
  onDeletePrompt?: (promptId: string) => void;
  onEditPrompt?: (promptId: string, prompt: string, category: string) => void;
  onAutoGenerate?: () => void;
  isGenerating?: boolean;
  onImportGeo?: () => void;
  geoCount?: number;
  isImporting?: boolean;
}

const STATUS_FILTERS: Array<{ id: "all" | PromptStatus; label: string }> = [
  { id: "all", label: "הכל" },
  { id: "owned", label: STATUS_LABELS.owned },
  { id: "present", label: STATUS_LABELS.present },
  { id: "competitor_wins", label: STATUS_LABELS.competitor_wins },
  { id: "blank", label: STATUS_LABELS.blank },
  { id: "negative", label: STATUS_LABELS.negative },
];

const statusClass: Record<PromptStatus, string> = {
  owned: "border-emerald-300 bg-emerald-50 text-emerald-800",
  present: "border-sky-300 bg-sky-50 text-sky-800",
  competitor_wins: "border-amber-300 bg-amber-50 text-amber-800",
  blank: "border-slate-300 bg-slate-50 text-slate-700",
  negative: "border-red-300 bg-red-50 text-red-800",
};

export function PromptTracker({
  prompts, onAddPrompt, onDeletePrompt, onEditPrompt, onAutoGenerate, isGenerating,
  onImportGeo, geoCount = 0, isImporting,
}: PromptTrackerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [newPrompt, setNewPrompt] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<TrackedPrompt | null>(null);
  const [editPromptText, setEditPromptText] = useState("");
  const [editCategoryText, setEditCategoryText] = useState("");
  const [selected, setSelected] = useState<TrackedPrompt | null>(null);

  const filteredPrompts = useMemo(() => prompts.filter((prompt) => {
    const haystack = `${prompt.prompt} ${prompt.category}`.toLowerCase();
    if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== "all" && prompt.status !== statusFilter) return false;
    return true;
  }), [prompts, searchQuery, statusFilter]);

  const handleAddPrompt = () => {
    if (!newPrompt.trim()) return;
    onAddPrompt(newPrompt.trim(), newCategory.trim() || "כללי");
    setNewPrompt("");
    setNewCategory("");
    setDialogOpen(false);
  };

  const handleEditSave = () => {
    if (editingPrompt && editPromptText.trim() && onEditPrompt) {
      onEditPrompt(editingPrompt.promptId, editPromptText.trim(), editCategoryText.trim() || "כללי");
      setEditDialogOpen(false);
      setEditingPrompt(null);
    }
  };

  const exportCsv = () => {
    const blob = new Blob([visibilityCsv(prompts)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ai-visibility-prompts.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">מעקב פרומפטים</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {onImportGeo && geoCount > 0 && (
              <Button size="sm" variant="outline" onClick={onImportGeo} disabled={isImporting}>
                {isImporting ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <BookOpen className="ml-1 h-4 w-4" />}
                ייבוא מתוכנית GEO ({geoCount})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={prompts.length === 0}>
              <Download className="ml-1 h-4 w-4" />ייצוא
            </Button>
            {onAutoGenerate && (
              <Button size="sm" variant="outline" onClick={onAutoGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="ml-1 h-4 w-4 animate-spin" /> : <Sparkles className="ml-1 h-4 w-4" />}
                {isGenerating ? "מייצר..." : "מחקר פרומפטים"}
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="ml-1 h-4 w-4" />הוסף פרומפט</Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>הוסף פרומפט למעקב</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>פרומפט</Label>
                    <Textarea value={newPrompt} onChange={(event) => setNewPrompt(event.target.value)} placeholder="שאלה כללית בלי שם המותג, למשל: מה סוכנות השיווק הכי טובה לעסקים קטנים?" className="mt-1" />
                  </div>
                  <div>
                    <Label>קטגוריה</Label>
                    <Input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="recommendation / comparison / pricing..." className="mt-1" />
                  </div>
                  <Button onClick={handleAddPrompt} className="w-full">הוסף</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-1">
          {STATUS_FILTERS.map((filter) => (
            <Button key={filter.id} size="sm" variant={statusFilter === filter.id ? "default" : "outline"} className="h-7 text-xs" onClick={() => setStatusFilter(filter.id)}>
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="חפש פרומפט..." className="pr-10" />
        </div>
        <div className="max-h-[520px] overflow-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פרומפט</TableHead>
                <TableHead className="text-right">סטטוס</TableHead>
                <TableHead className="text-center">ChatGPT</TableHead>
                <TableHead className="text-right">מתחרים</TableHead>
                {(onEditPrompt || onDeletePrompt) && <TableHead className="w-[80px] text-center">פעולות</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrompts.map((prompt) => (
                <TableRow key={prompt.promptId} className="cursor-pointer" onClick={() => setSelected(prompt)}>
                  <TableCell className="max-w-[280px] truncate font-medium">{prompt.prompt}</TableCell>
                  <TableCell><Badge variant="outline" className={cn("text-[10px]", statusClass[prompt.status])}>{STATUS_LABELS[prompt.status]}</Badge></TableCell>
                  <TableCell className="text-center">{prompt.platforms.chatgpt ? <Check className="mx-auto h-4 w-4 text-green-500" /> : <X className="mx-auto h-4 w-4 text-red-500" />}</TableCell>
                  <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{prompt.competitors.join(", ") || "—"}</TableCell>
                  {(onEditPrompt || onDeletePrompt) && (
                    <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {onEditPrompt && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingPrompt(prompt); setEditPromptText(prompt.prompt); setEditCategoryText(prompt.category); setEditDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onDeletePrompt && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => window.confirm("למחוק את הפרומפט הזה?") && onDeletePrompt(prompt.promptId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredPrompts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">לא נמצאו פרומפטים</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ערוך פרומפט</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>פרומפט</Label><Textarea value={editPromptText} onChange={(event) => setEditPromptText(event.target.value)} className="mt-1" /></div>
            <div><Label>קטגוריה</Label><Input value={editCategoryText} onChange={(event) => setEditCategoryText(event.target.value)} className="mt-1" /></div>
            <Button onClick={handleEditSave} className="w-full">שמור</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-lg" dir="rtl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-right leading-relaxed">{selected.prompt}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={cn("text-xs", statusClass[selected.status])}>{STATUS_LABELS[selected.status]}</Badge>
                  <Badge variant="secondary">{selected.category || "כללי"}</Badge>
                  {selected.position ? <Badge variant="outline">מיקום #{selected.position}</Badge> : null}
                </div>
                {selected.lastChecked && (
                  <p className="text-xs text-muted-foreground">
                    נסרק {formatDistanceToNow(new Date(selected.lastChecked), { addSuffix: true, locale: he })}
                  </p>
                )}
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">תשובת ה-AI</div>
                  <p className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 leading-relaxed">{selected.snippet || "אין קטע תשובה — הפעילו סריקה."}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">מתחרים שמוזכרים</div>
                  <p>{selected.competitors.length ? selected.competitors.join(" · ") : "לא זוהו"}</p>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-muted-foreground">מקורות שצוטטו</div>
                  {selected.citations.length ? (
                    <ul className="space-y-1">
                      {selected.citations.map((url) => (
                        <li key={url}><a href={url.startsWith("http") ? url : `https://${url}`} target="_blank" rel="noreferrer" className="text-emerald-700 underline" dir="ltr">{url}</a></li>
                      ))}
                    </ul>
                  ) : <p className="text-muted-foreground">אין ציטוטי URL בסריקה הזו</p>}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
