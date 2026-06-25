import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InlineDialog } from "@/components/ui/inline-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DuplicateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: { id: string; name: string } | null;
  onDuplicated?: (newClientId: string) => void;
  /** Render embedded in the page flow instead of as a modal overlay. */
  inline?: boolean;
}

export function DuplicateClientDialog({
  open,
  onOpenChange,
  client,
  onDuplicated,
  inline = false,
}: DuplicateClientDialogProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [includeContacts, setIncludeContacts] = useState(true);
  const [includeTeam, setIncludeTeam] = useState(true);
  const [includeCredentials, setIncludeCredentials] = useState(false);

  useEffect(() => {
    if (open && client) {
      setNewName(`${client.name} (עותק)`);
      setIncludeContacts(true);
      setIncludeTeam(true);
      setIncludeCredentials(false);
    }
  }, [open, client]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error("missing client");
      const { data, error } = await supabase.functions.invoke("duplicate-client", {
        body: {
          clientId: client.id,
          newName: newName.trim(),
          includeContacts,
          includeTeam,
          includeCredentials,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { newClientId: string; stats: Record<string, number> };
    },
    onSuccess: (data) => {
      const parts: string[] = [];
      if (data.stats?.contacts) parts.push(`${data.stats.contacts} אנשי קשר`);
      if (data.stats?.team) parts.push(`${data.stats.team} חברי צוות`);
      if (data.stats?.credentials) parts.push(`${data.stats.credentials} אישורי גישה`);
      toast.success(
        parts.length ? `הלקוח שוכפל בהצלחה (כולל ${parts.join(", ")})` : "הלקוח שוכפל בהצלחה"
      );
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
      onDuplicated?.(data.newClientId);
    },
    onError: (e: any) => {
      toast.error("שגיאה בשכפול: " + (e?.message || "אירעה שגיאה"));
    },
  });

  return (
    <InlineDialog
      open={open}
      onOpenChange={onOpenChange}
      inline={inline}
      className="max-w-md"
      title={
        <span className="flex items-center gap-2">
          <Copy className="h-5 w-5" />
          שכפול לקוח
        </span>
      }
      description={
        <>
          יצירת לקוח חדש על בסיס <strong>{client?.name}</strong> עם כל הפרטים שתבחר.
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            ביטול
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!newName.trim() || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            <Copy className="ml-2 h-4 w-4" />
            שכפל לקוח
          </Button>
        </>
      }
    >
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="dup-name">שם הלקוח החדש</Label>
            <Input
              id="dup-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="שם הלקוח החדש"
              autoFocus
            />
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <Label className="text-sm font-medium">מה לשכפל בנוסף לפרטי הלקוח הבסיסיים?</Label>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={includeContacts}
                onCheckedChange={(c) => setIncludeContacts(c === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div>אנשי קשר נוספים</div>
                <div className="text-xs text-muted-foreground">
                  כל אנשי הקשר המשניים של הלקוח
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={includeTeam}
                onCheckedChange={(c) => setIncludeTeam(c === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div>צוות עבודה (קמפיינרים)</div>
                <div className="text-xs text-muted-foreground">
                  שיוך הקמפיינרים והאחוזים
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={includeCredentials}
                onCheckedChange={(c) => setIncludeCredentials(c === true)}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div>אישורי גישה (סיסמאות/קישורים)</div>
                <div className="text-xs text-muted-foreground">
                  שמות משתמש וסיסמאות לשירותים
                </div>
              </div>
            </label>
          </div>
        </div>
    </InlineDialog>
  );
}
