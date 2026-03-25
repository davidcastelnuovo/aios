import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface ProjectFormData {
  brandName: string;
  url: string;
  description: string;
  keywords: string[];
  competitors: string[];
}

interface CreateProjectDialogProps {
  trigger: React.ReactNode;
  initialData?: ProjectFormData;
  onSave: (data: ProjectFormData) => void;
  title?: string;
}

export function CreateProjectDialog({ trigger, initialData, onSave, title = "פרויקט חדש" }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [brandName, setBrandName] = useState(initialData?.brandName || "");
  const [url, setUrl] = useState(initialData?.url || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [keywords, setKeywords] = useState<string[]>(initialData?.keywords || []);
  const [competitors, setCompetitors] = useState<string[]>(initialData?.competitors || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");

  const resetForm = () => {
    if (!initialData) {
      setBrandName("");
      setUrl("");
      setDescription("");
      setKeywords([]);
      setCompetitors([]);
    }
    setNewKeyword("");
    setNewCompetitor("");
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      setKeywords([...keywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const addCompetitor = () => {
    if (newCompetitor.trim() && !competitors.includes(newCompetitor.trim())) {
      setCompetitors([...competitors, newCompetitor.trim()]);
      setNewCompetitor("");
    }
  };

  const handleSave = () => {
    if (!brandName.trim()) return;
    onSave({ brandName: brandName.trim(), url: url.trim(), description: description.trim(), keywords, competitors });
    setOpen(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && initialData) { setBrandName(initialData.brandName); setUrl(initialData.url); setDescription(initialData.description); setKeywords(initialData.keywords); setCompetitors(initialData.competitors); } }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>שם הפרויקט / מותג *</Label>
            <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="לדוגמה: AfterLead" className="mt-1" />
          </div>

          <div>
            <Label>כתובת אתר (URL)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.example.com" className="mt-1" dir="ltr" />
          </div>

          <div>
            <Label>תיאור</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר של הפרויקט..." className="mt-1" rows={2} />
          </div>

          <div>
            <Label>ביטויי מפתח</Label>
            <p className="text-xs text-muted-foreground mb-2">מילים שבהן המערכת תחפש אזכורים</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1">
                  {kw}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setKeywords(keywords.filter(k => k !== kw))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} placeholder="הוסף ביטוי" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())} />
              <Button size="sm" variant="outline" onClick={addKeyword} type="button"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div>
            <Label>מתחרים</Label>
            <p className="text-xs text-muted-foreground mb-2">מותגים/אתרים מתחרים להשוואה</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {competitors.map((comp) => (
                <Badge key={comp} variant="secondary" className="gap-1">
                  {comp}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setCompetitors(competitors.filter(c => c !== comp))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newCompetitor} onChange={(e) => setNewCompetitor(e.target.value)} placeholder="הוסף מתחרה" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())} />
              <Button size="sm" variant="outline" onClick={addCompetitor} type="button"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full" disabled={!brandName.trim()}>
            {initialData ? "שמור שינויים" : "צור פרויקט"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
