import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Plus, Search, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TrackedPrompt {
  id: string;
  prompt: string;
  category: string;
  lastChecked: string;
  platforms: {
    chatgpt: boolean;
    gemini: boolean;
    perplexity: boolean;
  };
  position: number | null;
  sentiment: "positive" | "neutral" | "negative" | null;
}

interface PromptTrackerProps {
  prompts: TrackedPrompt[];
  onAddPrompt: (prompt: string, category: string) => void;
}

export function PromptTracker({ prompts, onAddPrompt }: PromptTrackerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredPrompts = prompts.filter(p =>
    p.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPrompt = () => {
    if (newPrompt.trim()) {
      onAddPrompt(newPrompt.trim(), newCategory.trim() || "כללי");
      setNewPrompt("");
      setNewCategory("");
      setDialogOpen(false);
    }
  };

  const sentimentLabel = (s: TrackedPrompt["sentiment"]) => {
    if (s === "positive") return <Badge variant="default" className="bg-green-500">חיובי</Badge>;
    if (s === "negative") return <Badge variant="destructive">שלילי</Badge>;
    if (s === "neutral") return <Badge variant="secondary">ניטרלי</Badge>;
    return <Badge variant="outline">לא נבדק</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">מעקב פרומפטים</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                הוסף פרומפט
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>הוסף פרומפט למעקב</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>פרומפט</Label>
                  <Textarea
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    placeholder="לדוגמה: מהי תוכנת ה-CRM הטובה ביותר לעסקים קטנים?"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>קטגוריה</Label>
                  <Input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="לדוגמה: CRM, שיווק, מכירות"
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleAddPrompt} className="w-full">הוסף</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חפש פרומפט..."
            className="pr-10"
          />
        </div>
        <div className="rounded-md border overflow-auto max-h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">פרומפט</TableHead>
                <TableHead className="text-right">קטגוריה</TableHead>
                <TableHead className="text-center">ChatGPT</TableHead>
                <TableHead className="text-center">Gemini</TableHead>
                <TableHead className="text-center">Perplexity</TableHead>
                <TableHead className="text-center">סנטימנט</TableHead>
                <TableHead className="text-right">נבדק לאחרונה</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium max-w-[300px] truncate">{prompt.prompt}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{prompt.category}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {prompt.platforms.chatgpt ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {prompt.platforms.gemini ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {prompt.platforms.perplexity ? (
                      <Check className="h-4 w-4 text-green-500 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-red-500 mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-center">{sentimentLabel(prompt.sentiment)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{prompt.lastChecked}</TableCell>
                </TableRow>
              ))}
              {filteredPrompts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    לא נמצאו פרומפטים
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
