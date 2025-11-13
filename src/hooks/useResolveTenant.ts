import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a tenant slug for a user, with persistence to user_active_tenant if needed
 * Returns the slug string if found, otherwise null
 */
export async function resolveTenantSlug(userId: string): Promise<string | null> {
  try {
    // 1) Try active tenant mapping first
    const { data: activeTenant } = await (supabase as any)
      .from("user_active_tenant")
      .select("tenant_id, tenants(slug, status)")
      .eq("user_id", userId)
      .maybeSingle();

    const activeSlug = (activeTenant as any)?.tenants?.slug as string | undefined;
    if (activeSlug) return activeSlug;

    // 2) Fall back to first available tenant from memberships
    const { data: userTenants } = await (supabase as any)
      .from("tenant_users")
      .select("tenant_id, tenants(slug, status)")
      .eq("user_id", userId)
      .limit(10);

    const candidate: any = (userTenants || []).find((t: any) => t?.tenants?.status === "active") || (userTenants || [])[0];
    const candidateSlug = candidate?.tenants?.slug as string | undefined;
    const candidateTenantId = candidate?.tenant_id as string | undefined;

    if (candidateSlug && candidateTenantId) {
      // Persist as active for next time
      await (supabase as any)
        .from("user_active_tenant")
        .upsert({ user_id: userId, tenant_id: candidateTenantId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      return candidateSlug;
    }
  } catch (err) {
    console.error("resolveTenantSlug error:", err);
  }
  return null;
}
