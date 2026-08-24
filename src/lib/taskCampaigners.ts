import { supabase } from "@/integrations/supabase/client";

/** Active campaigners in this tenant, plus campaigners on shared agencies. */
export async function fetchActiveCampaigners(
  tenantId: string,
  crossTenantAgencyIds: string[] = [],
) {
  let crossTenantCampaignerIds: string[] = [];
  if (crossTenantAgencyIds.length > 0) {
    const { data: caRows } = await supabase
      .from("campaigner_agencies")
      .select("campaigner_id")
      .in("agency_id", crossTenantAgencyIds);
    crossTenantCampaignerIds = Array.from(
      new Set((caRows || []).map((r: { campaigner_id: string }) => r.campaigner_id)),
    );
  }

  let query = supabase
    .from("campaigners")
    .select("id, full_name")
    .eq("active", true)
    .order("full_name");

  if (crossTenantCampaignerIds.length > 0) {
    query = query.or(`tenant_id.eq.${tenantId},id.in.(${crossTenantCampaignerIds.join(",")})`);
  } else {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
