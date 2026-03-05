import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";

interface ManualTriggerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automationId: string;
  automationName: string;
}

export function ManualTriggerDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
}: ManualTriggerDialogProps) {
  const [commandText, setCommandText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const { toast } = useToast();

  const handleRun = async () => {
    if (!commandText.trim()) return;
    setIsRunning(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("trigger-automation", {
        body: {
          automationId,
          command_text: commandText.trim(),
          user_name: user?.email || "משתמש",
        },
      });
      if (error) throw error;
      toast({ title: "האוטומציה הופעלה בהצלחה!" });
      setCommandText("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "שגיאה בהפעלת האוטומציה",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הפעלה ידנית - {automationName}</DialogTitle>
          <DialogDescription>
            כתוב את ההוראה או הפקודה שתרצה לשלוח לאוטומציה
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Textarea
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            placeholder="למשל: שלח הודעת מעקב לכל הלידים החדשים מהיום..."
            className="min-h-[120px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                handleRun();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Ctrl+Enter לשליחה מהירה
          </p>
        </div>

        <DialogFooter className="flex-row-reverse sm:flex-row-reverse gap-2">
          <Button onClick={handleRun} disabled={isRunning || !commandText.trim()}>
            {isRunning ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 ml-2" />
            )}
            {isRunning ? "מפעיל..." : "הפעל"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
