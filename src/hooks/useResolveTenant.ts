import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve a tenant slug for a user, with persistence to user_active_tenant if needed
 * Returns the slug string if found, otherwise null
 */
export async function resolveTenantSlug(userId: string, retries = 3): Promise<string | null> {
  let lastError: any = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Add small delay for subsequent retries to allow DB to settle
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }

      // 1) Try active tenant mapping first
      const { data: activeTenant, error: activeError } = await (supabase as any)
        .from("user_active_tenant")
        .select("tenant_id, tenants(slug, status)")
        .eq("user_id", userId)
        .maybeSingle();

      if (activeError) {
        console.warn(`Attempt ${attempt + 1}: Error fetching active tenant:`, activeError);
      }

      const activeSlug = (activeTenant as any)?.tenants?.slug as string | undefined;
      if (activeSlug) {
        console.log("✅ Resolved tenant from active tenant:", activeSlug);
        return activeSlug;
      }

      // 2) Fall back to first available tenant from memberships
      const { data: userTenants, error: tenantsError } = await (supabase as any)
        .from("tenant_users")
        .select("tenant_id, tenants(slug, status)")
        .eq("user_id", userId)
        .limit(10);

      if (tenantsError) {
        console.warn(`Attempt ${attempt + 1}: Error fetching user tenants:`, tenantsError);
        lastError = tenantsError;
        continue;
      }

      if (!userTenants || userTenants.length === 0) {
        console.warn(`Attempt ${attempt + 1}: No tenants found for user`);
        lastError = new Error("No tenants found");
        continue;
      }

      // Prefer marketingcaptain tenant if user is a member
      const mcTenant = (userTenants || []).find((t: any) => t?.tenants?.slug === 'marketingcaptain');
      const candidate: any = mcTenant || (userTenants || []).find((t: any) => t?.tenants?.status === "active") || (userTenants || [])[0];
      const candidateSlug = candidate?.tenants?.slug as string | undefined;
      const candidateTenantId = candidate?.tenant_id as string | undefined;

      if (candidateSlug && candidateTenantId) {
        // Persist as active for next time
        await (supabase as any)
          .from("user_active_tenant")
          .upsert({ user_id: userId, tenant_id: candidateTenantId, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
        
        console.log("✅ Resolved tenant from memberships:", candidateSlug);
        return candidateSlug;
      }
    } catch (err) {
      console.error(`Attempt ${attempt + 1}: resolveTenantSlug error:`, err);
      lastError = err;
    }
  }
  
  console.error("❌ Failed to resolve tenant after all retries. Last error:", lastError);
  return null;
}
