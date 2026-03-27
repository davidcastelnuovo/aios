import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Share2, Copy, Plus, X, Link, Mail, Trash2 } from "lucide-react";

interface ShareTableDialogProps {
  tableId: string;
  tableName: string;
  tenantId: string;
}

export function ShareTableDialog({ tableId, tableName, tenantId }: ShareTableDialogProps) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["table-shares", tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("table_shares" as any)
        .select("*")
        .eq("table_id", tableId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("table_shares" as any)
        .insert({
          table_id: tableId,
          tenant_id: tenantId,
          created_by: user.id,
          allowed_emails: [],
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-shares", tableId] });
      toast.success("קישור שיתוף נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת קישור"),
  });

  const updateEmailsMutation = useMutation({
    mutationFn: async ({ shareId, emails }: { shareId: string; emails: string[] }) => {
      const { error } = await supabase
        .from("table_shares" as any)
        .update({ allowed_emails: emails, updated_at: new Date().toISOString() } as any)
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-shares", tableId] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ shareId, isActive }: { shareId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("table_shares" as any)
        .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-shares", tableId] });
      toast.success("הקישור עודכן");
    },
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from("table_shares" as any)
        .delete()
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["table-shares", tableId] });
      toast.success("הקישור נמחק");
    },
  });

  const getShareUrl = (token: string) => {
    const origin =
      window.location.hostname.includes("preview") || window.location.hostname.includes("lovableproject")
        ? "https://after-lead.lovable.app"
        : window.location.origin;
    return `${origin}/shared/table/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getShareUrl(token));
    toast.success("הקישור הועתק ללוח");
  };

  const addEmail = (shareId: string, currentEmails: string[]) => {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      toast.error("נא להזין אימייל תקין");
      return;
    }
    if (currentEmails.includes(email)) {
      toast.error("אימייל זה כבר ברשימה");
      return;
    }
    updateEmailsMutation.mutate({ shareId, emails: [...currentEmails, email] });
    setNewEmail("");
    toast.success("אימייל נוסף");
  };

  const removeEmail = (shareId: string, currentEmails: string[], emailToRemove: string) => {
    updateEmailsMutation.mutate({
      shareId,
      emails: currentEmails.filter((e) => e !== emailToRemove),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="ml-2 h-4 w-4" />
          שתף טבלה
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            שיתוף טבלה: {tableName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={() => createShareMutation.mutate()} disabled={createShareMutation.isPending}>
            <Plus className="ml-2 h-4 w-4" />
            צור קישור שיתוף חדש
          </Button>

          {shares.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין קישורי שיתוף פעילים. צור קישור חדש כדי לשתף את הטבלה.
            </p>
          )}

          {shares.map((share: any) => (
            <div key={share.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link className="h-4 w-4 text-muted-foreground shrink-0" />
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {getShareUrl(share.share_token)}
                </code>
                <Button variant="ghost" size="sm" onClick={() => copyLink(share.share_token)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">קישור פעיל</Label>
                <Switch
                  checked={share.is_active}
                  onCheckedChange={(checked) =>
                    toggleActiveMutation.mutate({ shareId: share.id, isActive: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  הגבלת גישה לאימיילים (אופציונלי)
                </Label>
                <p className="text-xs text-muted-foreground">
                  {(share.allowed_emails || []).length === 0
                    ? "הקישור פתוח לכולם. הוסף אימיילים כדי להגביל גישה."
                    : "רק אימיילים ברשימה יוכלו לצפות בטבלה."}
                </p>

                <div className="flex gap-2">
                  <Input
                    placeholder="email@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEmail(share.id, share.allowed_emails || []);
                      }
                    }}
                    className="text-sm"
                    dir="ltr"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => addEmail(share.id, share.allowed_emails || [])}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {(share.allowed_emails || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(share.allowed_emails as string[]).map((email: string) => (
                      <Badge key={email} variant="secondary" className="text-xs gap-1">
                        {email}
                        <button
                          onClick={() => removeEmail(share.id, share.allowed_emails || [], email)}
                          className="hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteShareMutation.mutate(share.id)}
                >
                  <Trash2 className="ml-1 h-4 w-4" />
                  מחק קישור
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
