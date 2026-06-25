import { useState } from "react";
import { useBroadcastDomains } from "@/hooks/useBroadcastDomains";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Star, Globe, Loader2 } from "lucide-react";

export function BroadcastDomainSettings() {
  const { list, add, remove, setDefault } = useBroadcastDomains();
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [local, setLocal] = useState("noreply");

  const handleAdd = async () => {
    if (!domain.trim()) { toast.error("הזן דומיין"); return; }
    try {
      await add.mutateAsync({ domain, from_name: fromName, default_local: local });
      setDomain(""); setFromName(""); setLocal("noreply");
      toast.success("הדומיין נוסף");
    } catch (e: any) {
      toast.error("שגיאה: " + (e?.message?.includes("duplicate") ? "הדומיין כבר קיים" : e?.message));
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        כל ארגון מגדיר כאן את דומיין השליחה שלו לאימייל. הדומיין חייב להיות <strong>מאומת ב-Resend</strong> (SPF/DKIM)
        לפני שאפשר לדוור ממנו. הדומיין שמסומן כ⭐ ברירת מחדל ישמש כשולח כברירת מחדל.
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>הוספת דומיין שליחה</Label>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="noreply" className="w-28" dir="ltr" />
              <span className="text-muted-foreground">@</span>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.co.il" className="w-48" dir="ltr" />
            </div>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="שם שולח (אופציונלי)" className="w-44" />
            <Button onClick={handleAdd} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="ml-1 h-4 w-4" />הוסף</>}
            </Button>
          </div>
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
            <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span dir="ltr" className="font-medium">{d.default_local}@{d.domain}</span>
                {d.from_name && <span className="text-sm text-muted-foreground">· {d.from_name}</span>}
                {d.is_default && <Badge variant="secondary"><Star className="ml-1 h-3 w-3" />ברירת מחדל</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {!d.is_default && (
                  <Button variant="ghost" size="sm" onClick={() => setDefault.mutate(d.id)}>קבע כברירת מחדל</Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => { if (confirm("למחוק את הדומיין?")) remove.mutate(d.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
