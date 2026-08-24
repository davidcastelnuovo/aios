import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save } from "lucide-react";
import type { CreativeItem, CreativeProjectDraft } from "./types";
import { itemToProjectDraft, projectTypeLabel } from "./utils";

interface Props {
  item: CreativeItem;
  onSave: (draft: CreativeProjectDraft) => Promise<void>;
  saving?: boolean;
}

export function CreativeBriefEditor({ item, onSave, saving }: Props) {
  const [draft, setDraft] = useState<CreativeProjectDraft>(() => itemToProjectDraft(item));

  useEffect(() => {
    setDraft(itemToProjectDraft(item));
  }, [item.id, item.updated_at]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">עריכת פרויקט — בריף, קופי והנחיות</span>
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
