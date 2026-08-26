import { supabase } from "@/integrations/supabase/client";
import {
  buildMineAssignmentOrFilter,
  resolveMineTaskAssignee,
  type MineTaskIdentity,
} from "@/lib/taskFilters";

export type { MineTaskIdentity };
export { buildMineAssignmentOrFilter };

/**
 * Resolve every campaigner row that represents this user for task assignment.
 * profiles.campaigner_id is global; the same person may have another campaigners
 * row (or tasks stamped under another id) in a different tenant/agency.
 */
export async function fetchMineTaskIdentity(input: {
  userId: string;
  tenantId: string;
  crossTenantAgencyIds?: string[];
}): Promise<MineTaskIdentity> {
  const { userId, tenantId, crossTenantAgencyIds = [] } = input;

  const [{ data: profile }, { data: rpcCampaignerId }] = await Promise.all([
    supabase
      .from("profiles")
      .select("campaigner_id, sales_person_id, email")
      .eq("id", userId)
      .maybeSingle(),
    supabase.rpc("get_user_campaigner_id", { _user_id: userId }),
  ]);

  const campaignerIds = new Set<string>();
  if (profile?.campaigner_id) campaignerIds.add(profile.campaigner_id);
  if (rpcCampaignerId) campaignerIds.add(rpcCampaignerId as string);

  if (profile?.email) {
    const email = profile.email.trim();
    if (email.length > 0) {
      let emailQuery = supabase
        .from("campaigners")
        .select("id")
        .eq("active", true)
        .ilike("email", email);

      if (crossTenantAgencyIds.length > 0) {
        const { data: crossRows } = await supabase
          .from("campaigner_agencies")
          .select("campaigner_id")
          .in("agency_id", crossTenantAgencyIds);
        const crossIds = Array.from(new Set((crossRows || []).map((r) => r.campaigner_id)));
        if (crossIds.length > 0) {
          emailQuery = emailQuery.or(`tenant_id.eq.${tenantId},id.in.(${crossIds.join(",")})`);
        } else {
          emailQuery = emailQuery.eq("tenant_id", tenantId);
        }
      } else {
        emailQuery = emailQuery.eq("tenant_id", tenantId);
      }

      const { data: emailMatches } = await emailQuery;
      for (const row of emailMatches || []) {
        campaignerIds.add(row.id);
      }
    }
  }

  const assignee = resolveMineTaskAssignee({
    campaignerId: profile?.campaigner_id ?? (rpcCampaignerId as string | null),
    salesPersonId: profile?.sales_person_id,
    userId,
  });

  return {
    ...assignee,
    campaignerIds: [...campaignerIds],
  };
}
