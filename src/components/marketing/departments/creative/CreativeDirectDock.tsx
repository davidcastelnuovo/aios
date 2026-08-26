import { CREATIVE_DIRECT_LABEL_HE } from "@/components/marketing/departments/creative/creativeDirect";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, MessageCircle, Sparkles } from "lucide-react";

interface Props {
  agentUrl: string | null;
  opening?: boolean;
  onOpen: () => void;
}

export function CreativeDirectDock({ agentUrl, opening, onOpen }: Props) {
  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b bg-gradient-to-l from-pink-50/90 to-violet-50/50 px-4 py-2.5"
      dir="rtl"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-violet-700 text-white">
        <MessageCircle className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{CREATIVE_DIRECT_LABEL_HE}</p>
        <p className="text-[11px] text-muted-foreground">
          כרמן ומחלקת קריאייטיב מבקשות תמונות כאן. הצ׳אט יוצר את הקריאייטיב ומעלה אותו לפרויקט.
          {agentUrl ? " · הצ׳אט פתוח" : " · עדיין לא נפתח"}
        </p>
      </div>
      {agentUrl ? (
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <a href={agentUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            פתח צ׳אט
          </a>
        </Button>
      ) : (
        <Button size="sm" className="gap-1.5 bg-pink-600 hover:bg-pink-700" onClick={onOpen} disabled={opening}>
          {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          פתח צ׳אט
        </Button>
      )}
    </div>
  );
}
