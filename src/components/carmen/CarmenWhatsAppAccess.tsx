import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

type Props = {
  entityType: "campaigner" | "client_contact";
  entityId: string;
  phone?: string | null;
  displayName?: string | null;
  roleTitle?: string | null;
  clientId?: string | null;
};

export function CarmenWhatsAppAccess(props: Props) {
  const { tenantId } = useCurrentTenant();
  const queryClient = useQueryClient();
  const queryKey = ["carmen-whatsapp-access", tenantId, props.entityType, props.entityId];
  const { data: identity, isLoading } = useQuery({
    queryKey,
    enabled: !!tenantId && !!props.entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carmen_whatsapp_identities" as any)
        .select("id, status, verified_at")
        .eq("tenant_id", tenantId!)
        .eq("entity_type", props.entityType)
        .eq("entity_id", props.entityId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const approved = identity?.status === "approved";
  const mutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error("חסר ארגון");
      const phone = String(props.phone || "").replace(/\D/g, "");
      if (!approved && (phone.length < 9 || phone.length > 15)) {
        throw new Error("יש להזין מספר טלפון תקין לפני האישור");
      }
      if (approved) {
        const { error } = await supabase.from("carmen_whatsapp_identities" as any)
          .update({ status: "revoked", verified_at: null }).eq("id", identity.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("carmen_whatsapp_identities" as any).upsert({
        tenant_id: tenantId,
        phone,
        entity_type: props.entityType,
        entity_id: props.entityId,
        client_id: props.clientId || null,
        display_name: props.displayName || null,
        role_title: props.roleTitle || null,
        status: "approved",
      }, { onConflict: "tenant_id,phone" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(approved
        ? "ההרשאה לדבר עם קארמן בוטלה"
        : "המספר אושר. קארמן תזהה אותו בקבוצות המשויכות.");
    },
    onError: (error: Error) => toast.error(error.message || "שגיאה בעדכון הרשאת כרמן"),
  });

  return (
    <Button type="button" size="sm" variant={approved ? "secondary" : "outline"}
      className="h-7 gap-1 text-xs" disabled={isLoading || mutation.isPending}
      onClick={() => mutation.mutate()}>
      {approved ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {approved ? "בטל גישה לקארמן" : "אשר לדבר עם קארמן"}
    </Button>
  );
}
