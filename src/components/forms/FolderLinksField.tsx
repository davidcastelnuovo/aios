import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, Plus, Trash2, ExternalLink } from "lucide-react";

export interface FolderLink {
  name: string;
  url: string;
}

interface FolderLinksFieldProps {
  links: FolderLink[];
  onChange: (links: FolderLink[]) => void;
  readOnly?: boolean;
}

export function FolderLinksField({ links, onChange, readOnly = false }: FolderLinksFieldProps) {
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const handleAdd = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    
    // Validate URL
    try {
      new URL(newUrl);
    } catch {
      return;
    }

    onChange([...links, { name: newName.trim(), url: newUrl.trim() }]);
    setNewName("");
    setNewUrl("");
  };

  const handleRemove = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">קישורים</Label>
      
      {/* Existing links */}
      {links.length > 0 && (
        <div className="space-y-2">
          {links.map((link, index) => (
            <div 
              key={index} 
              className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
            >
              <Link className="h-4 w-4 text-muted-foreground shrink-0" />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-primary hover:underline truncate flex items-center gap-1"
              >
                {link.name}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Add new link form */}
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="שם הקישור"
            className="flex-1 rounded-lg border-2 h-10 px-3 text-sm"
          />
          <Input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="https://..."
            className="flex-[2] rounded-lg border-2 h-10 px-3 text-sm"
            dir="ltr"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleAdd}
            disabled={!newName.trim() || !newUrl.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {links.length === 0 && readOnly && (
        <p className="text-sm text-muted-foreground">אין קישורים</p>
      )}
    </div>
  );
}
