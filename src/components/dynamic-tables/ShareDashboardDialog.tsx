import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Share2, Copy, Plus, Trash2, Pencil, Check, X } from "lucide-react";

interface ShareDashboardDialogProps {
  dashboardId: string;
  dashboardName: string;
  tenantId: string;
}

const SLUG_REGEX = /^[a-zA-Z0-9_-]{3,64}$/;

export function ShareDashboardDialog({ dashboardId, dashboardName, tenantId }: ShareDashboardDialogProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const queryClient = useQueryClient();

  const { data: shares = [], isLoading } = useQuery({
    queryKey: ["dashboard-shares", dashboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dashboard_shares")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const createShareMutation = useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("dashboard_shares")
        .insert({
          dashboard_id: dashboardId,
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-shares", dashboardId] });
      toast.success("קישור שיתוף נוצר בהצלחה");
    },
    onError: () => toast.error("שגיאה ביצירת קישור"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ shareId, isActive }: { shareId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("dashboard_shares")
        .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-shares", dashboardId] });
      toast.success("הקישור עודכן");
    },
  });

  const updateSlugMutation = useMutation({
    mutationFn: async ({ shareId, slug }: { shareId: string; slug: string }) => {
      const { error } = await supabase
        .from("dashboard_shares")
        .update({ share_token: slug, updated_at: new Date().toISOString() } as any)
        .eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-shares", dashboardId] });
      toast.success("הסלאג עודכן");
      setEditingId(null);
      setEditingValue("");
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast.error("הסלאג הזה כבר תפוס, בחר אחר");
      } else {
        toast.error("שגיאה בעדכון הסלאג");
      }
    },
  });

  const deleteShareMutation = useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase.from("dashboard_shares").delete().eq("id", shareId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-shares", dashboardId] });
      toast.success("הקישור נמחק");
    },
  });

  const getShareUrl = (token: string) => {
    const publicAppOrigin = "https://after-lead.lovable.app";
    return `${publicAppOrigin}/shared/dashboard/${token}`;
  };

  const copyLink = (token: string) => {
    navigator.clipboard.writeText(getShareUrl(token));
    toast.success("הקישור הועתק ללוח");
  };

  const startEditing = (shareId: string, currentToken: string) => {
    setEditingId(shareId);
    setEditingValue(currentToken);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const saveSlug = (shareId: string) => {
    const trimmed = editingValue.trim();
    if (!SLUG_REGEX.test(trimmed)) {
      toast.error("סלאג חייב להיות 3-64 תווים: אותיות באנגלית, מספרים, מקפים או קווים תחתונים");
      return;
    }
    updateSlugMutation.mutate({ shareId, slug: trimmed });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="ml-2 h-4 w-4" />
          שתף דשבורד
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            שיתוף דשבורד: {dashboardName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={() => createShareMutation.mutate()} disabled={createShareMutation.isPending}>
            <Plus className="ml-2 h-4 w-4" />
            צור קישור שיתוף חדש
          </Button>

          {shares.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              אין קישורי שיתוף פעילים. צור קישור חדש כדי לשתף את הדשבורד.
            </p>
          )}

          {shares.map((share: any) => (
            <div key={share.id} className="border rounded-lg p-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">סלאג (מזהה הקישור)</Label>
                {editingId === share.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      placeholder="my-custom-slug"
                      dir="ltr"
                      className="text-left font-mono text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSlug(share.id);
                        if (e.key === "Escape") cancelEditing();
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => saveSlug(share.id)}
                      disabled={updateSlugMutation.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEditing}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-2 py-1.5 bg-muted rounded text-xs font-mono text-left truncate" dir="ltr">
                      {share.share_token}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => startEditing(share.id, share.share_token)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-left" dir="ltr">
                  {getShareUrl(share.share_token)}
                </p>
              </div>

              <div className="flex items-center gap-2 justify-end">
                <Button variant="default" size="sm" onClick={() => copyLink(share.share_token)} className="shrink-0">
                  <Copy className="ml-1 h-4 w-4" />
                  העתק קישור
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

              <p className="text-xs text-muted-foreground">כל מי שיש לו את הקישור יכול לצפות בדשבורד.</p>

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
