import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Phone, Users, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface GreenAPIControlsProps {
  phone: string | null;
  groupChatId?: string | null;
}

export function GreenAPIControls({ phone, groupChatId }: GreenAPIControlsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!groupChatId) return;
    try {
      await navigator.clipboard.writeText(groupChatId);
      setCopied(true);
      toast.success("מזהה הקבוצה הועתק");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("שגיאה בהעתקה");
    }
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">
          Green API
        </Badge>
      </div>

      {groupChatId ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="h-3 w-3" />
            מזהה קבוצה
          </Label>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-muted px-2 py-1 rounded flex-1 truncate" dir="ltr">
              {groupChatId}
            </code>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 flex-shrink-0"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            מספר טלפון
          </Label>
          <div className="text-sm font-mono">{phone || "לא מוגדר"}</div>
        </div>
      )}
    </div>
  );
}
