import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Copy, Check } from "lucide-react";

export function CreateInvitationDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string>(typeof window !== "undefined" ? window.location.origin : "");
  const { toast } = useToast();

  const handleCreateInvitation = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-invitation-link", {
        body: { 
          email: email || undefined,
          baseUrl: baseUrl
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      // Do not show the link UI; just show toast and close the dialog
      setInvitationLink(null);
      toast({
        title: "הצלחה!",
        description: "ההזמנה נוצרה ונשלחה (אם אימות הדומיין תקין)",
      });
      setOpen(false);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      toast({
        title: "שגיאה",
        description: error.message || "שגיאה ביצירת קישור הזמנה",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (invitationLink) {
      navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      toast({
        title: "הועתק!",
        description: "הקישור הועתק ללוח",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEmail("");
    setInvitationLink(null);
    setCopied(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) handleClose();
    }}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="ml-2 h-4 w-4" />
          צור קישור הזמנה
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>צור קישור הזמנה חדש</DialogTitle>
          <DialogDescription>
            צור קישור הזמנה חד פעמי שתוכל לשלוח למשתמש חדש. הקישור תקף ל-7 ימים.
          </DialogDescription>
        </DialogHeader>

        {!invitationLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל (אופציונלי)</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="הזן כתובת אימייל"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                אם תזין אימייל, המשתמש יצטרך להשתמש באותו אימייל להרשמה
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">דומיין/כתובת בסיס לקישור</Label>
              <Input
                id="baseUrl"
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-domain.com"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                ברירת מחדל: הדומיין הנוכחי. ניתן לשנות לדומיין הייצור. ללא סלש בסוף.
              </p>
            </div>

            <Button onClick={handleCreateInvitation} disabled={loading} className="w-full">
              {loading ? "יוצר קישור..." : "צור קישור הזמנה"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>קישור ההזמנה</Label>
              <div className="flex gap-2">
                <Input value={invitationLink} readOnly className="flex-1" />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={copyToClipboard}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => invitationLink && window.open(invitationLink, "_blank", "noopener,noreferrer")}
                >
                  פתח
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                שלח קישור זה למשתמש החדש. הוא תקף ל-7 ימים ויכול לשמש פעם אחת בלבד.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              סגור
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
