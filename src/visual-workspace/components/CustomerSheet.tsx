import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { he } from "date-fns/locale";

interface Props {
  clientId: string | null;
  onClose: () => void;
}

export function CustomerSheet({ clientId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [client, setClient] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    const sb = supabase as any;
    Promise.all([
      sb.from("clients").select("*").eq("id", clientId).maybeSingle(),
      sb.from("tasks").select("id,title,status,due_date").eq("client_id", clientId).in("status", ["open", "in_progress"]).limit(10),
      sb.from("chat_messages").select("id,direction,message,created_at,sender_name").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    ]).then(([c, t, m]: any) => {
      setClient(c.data);
      setTasks(t.data ?? []);
      setMessages(m.data ?? []);
      setLoading(false);
    });
  }, [clientId]);

  return (
    <Sheet open={!!clientId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" dir="rtl" className="sm:max-w-lg bg-white/85 backdrop-blur-2xl">
        <SheetHeader>
          <SheetTitle>{client?.name || "טוען..."}</SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !client ? null : (
          <ScrollArea className="h-[calc(100vh-100px)] pl-3 mt-3">
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2">
                {client.status && <Badge variant="outline">{client.status}</Badge>}
                {client.mood_status && <Badge variant="secondary">{client.mood_status}</Badge>}
                {client.tier && <Badge>{client.tier}</Badge>}
              </div>

              {client.contact_name && (
                <div><div className="text-xs text-slate-500">איש קשר</div><div>{client.contact_name}</div></div>
              )}
              {client.phone && (
                <div><div className="text-xs text-slate-500">טלפון</div><div className="font-mono text-xs">{client.phone}</div></div>
              )}

              <div>
                <div className="text-xs text-slate-500 mb-1">משימות פתוחות</div>
                {tasks.length === 0 ? <p className="text-xs text-slate-400">אין משימות פתוחות</p> : (
                  <div className="space-y-1">
                    {tasks.map((t: any) => (
                      <div key={t.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs flex justify-between">
                        <span className="truncate">{t.title}</span>
                        <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-slate-500 mb-1">שיחות אחרונות</div>
                {messages.length === 0 ? <p className="text-xs text-slate-400">אין הודעות</p> : (
                  <div className="space-y-1">
                    {messages.map((m: any) => (
                      <div key={m.id} className={`rounded-lg px-3 py-2 text-xs ${m.direction === "outbound" ? "bg-primary/10" : "bg-slate-50"}`}>
                        <div className="text-[10px] text-slate-500">{m.sender_name || m.direction} · {m.created_at && format(new Date(m.created_at), "d MMM HH:mm", { locale: he })}</div>
                        <div className="line-clamp-2">{m.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-4">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-medium">
                  <Sparkles className="h-3.5 w-3.5" />
                  סיכום AI והמלצות
                </div>
                <p className="text-xs text-slate-500 mt-1">בקרוב — סיכום אוטומטי של מצב הלקוח והמלצות פעולה ל-Carmen.</p>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
