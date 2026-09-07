import { useState } from "react";
import { useBroadcastDomains, SenderDomain } from "@/hooks/useBroadcastDomains";
import { formatSenderEmail } from "@/lib/senderEmailDomain";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star, Globe, Loader2, Pencil, Check, X } from "lucide-react";

function SenderFields({
  local,
  domain,
  fromName,
  onLocalChange,
  onDomainChange,
  onFromNameChange,
}: {
  local: string;
  domain: string;
  fromName: string;
  onLocalChange: (v: string) => void;
  onDomainChange: (v: string) => void;
  onFromNameChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">שם תיבה (לפני @)</Label>
        <Input value={local} onChange={(e) => onLocalChange(e.target.value)} placeholder="pdpsagot" className="w-32" dir="ltr" />
      </div>
      <span className="pb-2 text-muted-foreground">@</span>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">דומיין מאומת ב-Resend</Label>
        <Input value={domain} onChange={(e) => onDomainChange(e.target.value)} placeholder="aios.co.il" className="w-48" dir="ltr" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">שם תצוגה (אופציונלי)</Label>
        <Input value={fromName} onChange={(e) => onFromNameChange(e.target.value)} placeholder="Pd Psagot" className="w-44" />
      </div>
    </div>
  );
}

export function BroadcastDomainSettings() {
  const { list, add, update, remove, setDefault } = useBroadcastDomains();
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [local, setLocal] = useState("noreply");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLocal, setEditLocal] = useState("");
  const [editDomain, setEditDomain] = useState("");
  const [editFromName, setEditFromName] = useState("");

  const showSwapToast = (wasSwapped?: boolean) => {
    if (wasSwapped) {
      toast.message("תיקנו אוטומטית: הדומיין והתיבה היו הפוכים");
    }
  };

  const handleAdd = async () => {
    if (!domain.trim() || !local.trim()) {
      toast.error("הזן שם תיבה ודומיין מאומת");
      return;
    }
    try {
      const result = await add.mutateAsync({ domain, from_name: fromName, default_local: local });
      showSwapToast(result.wasSwapped);
      setDomain("");
      setFromName("");
      setLocal("noreply");
      toast.success(`נוסף: ${result.email}`);
    } catch (e: any) {
      toast.error("שגיאה: " + (e?.message?.includes("duplicate") ? "הדומיין כבר קיים" : e?.message));
    }
  };

  const startEdit = (row: SenderDomain) => {
    setEditingId(row.id);
    setEditLocal(row.default_local);
    setEditDomain(row.domain);
    setEditFromName(row.from_name || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLocal("");
    setEditDomain("");
    setEditFromName("");
  };

  const saveEdit = async () => {
    if (!editingId || !editDomain.trim() || !editLocal.trim()) return;
    try {
      const result = await update.mutateAsync({
        id: editingId,
        domain: editDomain,
        default_local: editLocal,
        from_name: editFromName,
      });
      showSwapToast(result.wasSwapped);
      toast.success(`עודכן: ${result.email}`);
      cancelEdit();
    } catch (e: any) {
      toast.error("שגיאה בעדכון: " + e?.message);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        ב-Resend מאמתים רק <strong>דומיין</strong> (למשל <span dir="ltr">aios.co.il</span>) — לא כל תיבה בנפרד.
        אחרי האימות אפשר לשלוח מכל כתובת <span dir="ltr">something@aios.co.il</span>.
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Label>הוספת דומיין שליחה</Label>
          <SenderFields
            local={local}
            domain={domain}
            fromName={fromName}
            onLocalChange={setLocal}
            onDomainChange={setDomain}
            onFromNameChange={setFromName}
          />
          <Button onClick={handleAdd} disabled={add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="ml-1 h-4 w-4" />הוסף</>}
          </Button>
        </CardContent>
      </Card>

      {list.isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : (list.data || []).length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <Globe className="mx-auto mb-2 h-7 w-7 opacity-50" /> עדיין לא הוגדרו דומיינים לשליחה.
        </div>
      ) : (
        <div className="space-y-2">
          {(list.data || []).map((d) => (
            <div key={d.id} className="rounded-lg border p-3">
              {editingId === d.id ? (
                <div className="space-y-3">
                  <SenderFields
                    local={editLocal}
                    domain={editDomain}
                    fromName={editFromName}
                    onLocalChange={setEditLocal}
                    onDomainChange={setEditDomain}
                    onFromNameChange={setEditFromName}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} disabled={update.isPending}>
                      {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="ml-1 h-4 w-4" />שמור</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit}>
                      <X className="ml-1 h-4 w-4" />ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span dir="ltr" className="font-medium">{formatSenderEmail(d.default_local, d.domain)}</span>
                    {d.from_name && <span className="text-sm text-muted-foreground">· {d.from_name}</span>}
                    {d.is_default && <Badge variant="secondary"><Star className="ml-1 h-3 w-3" />ברירת מחדל</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!d.is_default && (
                      <Button variant="ghost" size="sm" onClick={() => setDefault.mutate(d.id)}>קבע כברירת מחדל</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("למחוק את הדומיין?")) remove.mutate(d.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
