import { useState } from "react";
import { useAgentKnowledge, useAgentKnowledgeMutations } from "@/hooks/useAgentKnowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Folder, FolderPlus, FilePlus, Trash2, Link as LinkIcon, FileText, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, any> = {
  note: StickyNote, document: FileText, link: LinkIcon, snippet: FileText,
};

export function KnowledgeTab({ agentId }: { agentId: string }) {
  const { folders, items } = useAgentKnowledge(agentId);
  const { createFolder, deleteFolder, createItem, deleteItem } = useAgentKnowledgeMutations(agentId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newItemOpen, setNewItemOpen] = useState(false);

  const itemsInFolder = (items.data ?? []).filter(i =>
    selectedFolderId ? i.folder_id === selectedFolderId : i.folder_id === null
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">ידע</h3>
        <div className="flex-1" />
        <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline"><FolderPlus className="h-4 w-4 me-1" /> תיקייה</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>תיקייה חדשה</DialogTitle></DialogHeader>
            <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="שם תיקייה" />
            <Button
              onClick={async () => {
                await createFolder.mutateAsync({ name: newFolderName, parent_folder_id: selectedFolderId });
                setNewFolderName(""); setNewFolderOpen(false);
              }}
              disabled={!newFolderName}
            >צור</Button>
          </DialogContent>
        </Dialog>
        <Dialog open={newItemOpen} onOpenChange={setNewItemOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><FilePlus className="h-4 w-4 me-1" /> פריט ידע</Button>
          </DialogTrigger>
          <ItemDialog
            folderId={selectedFolderId}
            onSubmit={async (input) => { await createItem.mutateAsync(input); setNewItemOpen(false); }}
            submitting={createItem.isPending}
          />
        </Dialog>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-3">
        {/* Folder tree */}
        <Card className="p-2 max-h-[480px] overflow-auto">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={cn("w-full flex items-center gap-2 rounded p-2 text-sm text-right",
              selectedFolderId === null ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          >
            <Folder className="h-4 w-4" /> שורש
          </button>
          {(folders.data ?? []).map(f => (
            <div key={f.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedFolderId(f.id)}
                className={cn("flex-1 flex items-center gap-2 rounded p-2 text-sm text-right",
                  selectedFolderId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <Folder className="h-4 w-4" /> {f.name}
              </button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteFolder.mutate(f.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </Card>

        {/* Items */}
        <div className="space-y-2">
          {itemsInFolder.map(item => {
            const Icon = KIND_ICON[item.kind] || StickyNote;
            return (
              <Card key={item.id} className="p-3">
                <div className="flex items-start gap-3">
                  <Icon className="h-4 w-4 mt-1 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{item.title}</h4>
                      <Badge variant="outline" className="text-[10px] h-4">{item.kind}</Badge>
                    </div>
                    {item.content && <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{item.content}</p>}
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        {item.url}
                      </a>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
          {itemsInFolder.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">אין פריטים בתיקייה זו</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemDialog({ folderId, onSubmit, submitting }: {
  folderId: string | null;
  onSubmit: (input: any) => Promise<void>;
  submitting: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [kind, setKind] = useState("note");
  const [url, setUrl] = useState("");

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>פריט ידע חדש</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>סוג</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="note">פתק</SelectItem>
              <SelectItem value="document">מסמך</SelectItem>
              <SelectItem value="link">קישור</SelectItem>
              <SelectItem value="snippet">קטע</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>כותרת</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        {kind === "link" && (
          <div>
            <Label>URL</Label>
            <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" />
          </div>
        )}
        <div>
          <Label>תוכן</Label>
          <Textarea rows={6} value={content} onChange={e => setContent(e.target.value)} />
        </div>
        <Button
          onClick={() => onSubmit({ title, content, kind, url, folder_id: folderId })}
          disabled={!title || submitting}
          className="w-full"
        >
          {submitting ? "שומר..." : "שמור"}
        </Button>
      </div>
    </DialogContent>
  );
}
