import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface BrandSettingsProps {
  brandName: string;
  keywords: string[];
  competitors: string[];
  onSave: (data: { brandName: string; keywords: string[]; competitors: string[] }) => void;
}

export function BrandSettings({ brandName, keywords, competitors, onSave }: BrandSettingsProps) {
  const [editBrand, setEditBrand] = useState(brandName);
  const [editKeywords, setEditKeywords] = useState(keywords);
  const [editCompetitors, setEditCompetitors] = useState(competitors);
  const [newKeyword, setNewKeyword] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const addKeyword = () => {
    if (newKeyword.trim() && !editKeywords.includes(newKeyword.trim())) {
      setEditKeywords([...editKeywords, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const addCompetitor = () => {
    if (newCompetitor.trim() && !editCompetitors.includes(newCompetitor.trim())) {
      setEditCompetitors([...editCompetitors, newCompetitor.trim()]);
      setNewCompetitor("");
    }
  };

  const handleSave = () => {
    onSave({ brandName: editBrand, keywords: editKeywords, competitors: editCompetitors });
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          הגדרות מותג
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>הגדרות ניטור מותג</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <Label>שם המותג</Label>
            <Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} className="mt-1" />
          </div>

          <div>
            <Label>מילות מפתח</Label>
            <p className="text-xs text-muted-foreground mb-2">מילים שבהן המערכת תחפש אזכורים של המותג שלך</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {editKeywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="gap-1">
                  {kw}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setEditKeywords(editKeywords.filter(k => k !== kw))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="הוסף מילת מפתח"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              />
              <Button size="sm" variant="outline" onClick={addKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <Label>מתחרים</Label>
            <p className="text-xs text-muted-foreground mb-2">מותגים מתחרים להשוואה</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {editCompetitors.map((comp) => (
                <Badge key={comp} variant="secondary" className="gap-1">
                  {comp}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => setEditCompetitors(editCompetitors.filter(c => c !== comp))} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCompetitor}
                onChange={(e) => setNewCompetitor(e.target.value)}
                placeholder="הוסף מתחרה"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCompetitor())}
              />
              <Button size="sm" variant="outline" onClick={addCompetitor}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">שמור הגדרות</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
