import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Share2, Loader2, CheckCircle2 } from "lucide-react";

interface ShareTelegramConnectionSectionProps {
  botStateId: string;
  currentTenantId: string;
}

export function ShareTelegramConnectionSection({
  botStateId,
  currentTenantId,
}: ShareTelegramConnectionSectionProps) {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);

  const { data: userTenants, isLoading: loadingTenants } = useQuery({
    queryKey: ["user-all-tenants-for-telegram-sharing", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("tenant_users")
        .select(`tenant_id, tenants:tenant_id ( id, name, slug )`)
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || [])
        .filter((tu) => tu.tenant_id !== currentTenantId && tu.tenants)
        .map((tu) => ({
          id: (tu.tenants as any).id,
          name: (tu.tenants as any).name,
          slug: (tu.tenants as any).slug,
        }));
    },
    enabled: !!user?.id && !!currentTenantId,
  });

  const { data: existingShares, isLoading: loadingShares } = useQuery({
    queryKey: ["telegram-bot-shares", botStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_bot_state")
        .select("tenant_id")
        .eq("shared_from_state_id", botStateId)
        .eq("is_active", true);
      if (error) throw error;
      return data?.map((d) => d.tenant_id) || [];
    },
    enabled: !!botStateId,
  });

  useEffect(() => {
    if (existingShares) setSelectedTenants(existingShares);
  }, [existingShares]);

  const { data: sourceBot } = useQuery({
    queryKey: ["telegram-bot-source", botStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_bot_state")
        .select("bot_name, bot_username")
        .eq("id", botStateId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!botStateId,
  });

  const saveSharesMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not found");
      const currentShares = existingShares || [];
      const toAdd = selectedTenants.filter((t) => !currentShares.includes(t));
      const toRemove = currentShares.filter((t) => !selectedTenants.includes(t));

      for (const tenantId of toAdd) {
        const { error } = await supabase.from("telegram_bot_state").insert({
          tenant_id: tenantId,
          shared_from_state_id: botStateId,
          is_active: true,
          bot_name: sourceBot?.bot_name || "Shared Bot",
          bot_username: sourceBot?.bot_username || "",
          update_offset: 0,
        });
        if (error) throw error;
      }

      for (const tenantId of toRemove) {
        const { error } = await supabase
          .from("telegram_bot_state")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("shared_from_state_id", botStateId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("השיתופים נשמרו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["telegram-bot-shares"] });
    },
    onError: (error) => {
      toast.error("שגיאה בשמירת השיתופים: " + (error as Error).message);
    },
  });

  const handleToggleTenant = (tenantId: string) => {
    setSelectedTenants((prev) =>
      prev.includes(tenantId) ? prev.filter((t) => t !== tenantId) : [...prev, tenantId]
    );
  };

  const hasChanges = () => {
    const current = existingShares || [];
    if (current.length !== selectedTenants.length) return true;
    return !current.every((t) => selectedTenants.includes(t));
  };

  if (loadingTenants || loadingShares) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!userTenants || userTenants.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-row-reverse justify-end text-right">
          <Share2 className="h-5 w-5" />
          שתף בוט עם ארגונים אחרים
        </CardTitle>
        <CardDescription className="text-right">
          בחר ארגונים נוספים שיוכלו להשתמש בבוט הטלגרם שלך לשליחת הודעות (כגון התראות לידים)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {userTenants.map((tenant) => (
            <div
              key={tenant.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors flex-row-reverse"
            >
              <Checkbox
                id={`share-tg-${tenant.id}`}
                checked={selectedTenants.includes(tenant.id)}
                onCheckedChange={() => handleToggleTenant(tenant.id)}
              />
              <Label htmlFor={`share-tg-${tenant.id}`} className="flex-1 cursor-pointer text-right">
                {tenant.name}
              </Label>
              {selectedTenants.includes(tenant.id) && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  משותף
                </Badge>
              )}
            </div>
          ))}
        </div>

        <Button
          onClick={() => saveSharesMutation.mutate()}
          disabled={!hasChanges() || saveSharesMutation.isPending}
          className="w-full gap-2"
        >
          {saveSharesMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              שמור שיתופים
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
