import { supabase } from "@/integrations/supabase/client";
import {
  crmWhatsappFunctionName,
  pickCrmWhatsappIntegration,
  type CrmWhatsappIntegration,
} from "@/lib/crmWhatsappRoute";

const WA_TYPES = ["manychat", "green_api", "manus_wa", "meta_whatsapp"] as const;

async function loadTenantWhatsappIntegrations(
  tenantId: string,
  userId: string,
): Promise<CrmWhatsappIntegration[]> {
  const { data, error } = await supabase
    .from("tenant_integrations")
    .select("id, integration_type, user_id, connection_visibility")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("integration_type", [...WA_TYPES]);
  if (error) throw error;

  const { data: grants } = await supabase
    .from("integration_tenant_access")
    .select("integration_id")
    .eq("accessing_tenant_id", tenantId);
  const grantedIds = (grants || []).map((row) => row.integration_id);
  let granted: CrmWhatsappIntegration[] = [];
  if (grantedIds.length > 0) {
    const { data: shared } = await supabase
      .from("tenant_integrations")
      .select("id, integration_type, user_id, connection_visibility")
      .in("id", grantedIds)
      .eq("is_active", true)
      .in("integration_type", [...WA_TYPES]);
    granted = shared || [];
  }

  const { data: permData } = await supabase
    .from("integration_user_permissions")
    .select("integration_id")
    .eq("user_id", userId);
  const permittedIds = new Set((permData || []).map((row) => row.integration_id));
  const grantedIdSet = new Set(grantedIds);

  return [...(data || []), ...granted].filter((row) => {
    if (grantedIdSet.has(row.id)) return true;
    if (row.integration_type === "manychat") return true;
    if (row.user_id === userId) return true;
    if ((row as { connection_visibility?: string }).connection_visibility === "org") return true;
    if (permittedIds.has(row.id)) return true;
    return false;
  });
}

export async function sendCrmWhatsappToLead(input: {
  leadId: string;
  tenantId: string;
  message: string;
}): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return { ok: false, skipped: "no_user" };

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, phone, tenant_id, active_chat_provider")
    .eq("id", input.leadId)
    .maybeSingle();
  if (leadError) return { ok: false, error: leadError.message };
  if (!lead?.phone) return { ok: false, skipped: "no_phone" };

  const integrations = await loadTenantWhatsappIntegrations(input.tenantId, userId);
  const picked = pickCrmWhatsappIntegration(lead.active_chat_provider, integrations);
  if (!picked) return { ok: false, skipped: "no_integration" };

  const fn = crmWhatsappFunctionName(picked.type);
  const body: Record<string, unknown> = {
    leadId: lead.id,
    message: input.message,
    phoneNumber: lead.phone,
    tenantId: input.tenantId,
    integrationId: picked.id,
  };
  if (picked.type === "manychat") {
    body.channel = "whatsapp";
    body.provider = "manychat";
  }

  const { error } = await supabase.functions.invoke(fn, { body });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
