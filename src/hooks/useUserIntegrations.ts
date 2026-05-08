import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Fetches integrations the current user has access to:
 * 1. Own integrations (user_id = currentUserId)
 * 2. Shared integrations (via integration_user_permissions)
 * 
 * Returns combined list with ownership info.
 *
 * Pass `tenantIds` (multiple) instead of `tenantId` to look up across a
 * shared-agency scope (e.g. SEO reports for a client whose home tenant
 * differs from where the GSC/GA integration was created). RLS still applies.
 */
export function useUserIntegrations(
  tenantId: string | string[] | undefined,
  integrationType: string,
  options?: { enabled?: boolean; returnAll?: boolean }
) {
  const { userId } = useCurrentUser();

  // Normalize to a stable, deduped array of tenant IDs
  const tenantIds = Array.isArray(tenantId)
    ? Array.from(new Set(tenantId.filter(Boolean)))
    : tenantId
      ? [tenantId]
      : [];
  const enabled = options?.enabled !== false && tenantIds.length > 0 && !!userId;

  // Stable cache key fragment
  const tenantsKey = tenantIds.slice().sort().join(",");

  return useQuery({
    queryKey: ['user-integrations', tenantsKey, integrationType, userId],
    queryFn: async () => {
      if (tenantIds.length === 0 || !userId) return [];

      // Tenant-scoped integrations: visible to all members of the tenant
      // (e.g. Google Analytics is shared across the organization)
      // All Google integrations are now tenant-scoped: any member of the tenant
      // who has access to reports/dashboards can see the data — no per-user privacy.
      const TENANT_SCOPED_TYPES = new Set(['google_analytics', 'google_search_console', 'google_ads']);
      const isTenantScoped = TENANT_SCOPED_TYPES.has(integrationType);

      // 1. Fetch user's own integrations (or all tenant integrations for tenant-scoped types)
      let ownQuery = supabase
        .from('tenant_integrations')
        .select('*')
        .in('tenant_id', tenantIds)
        .eq('integration_type', integrationType)
        .eq('is_active', true);

      if (!isTenantScoped) {
        ownQuery = ownQuery.eq('user_id', userId);
      }

      const { data: ownIntegrations, error: ownError } = await ownQuery;

      if (ownError) throw ownError;

      // For tenant-scoped types, mark _isOwn correctly based on actual ownership
      if (isTenantScoped) {
        const sharedOwnerIds = (ownIntegrations || [])
          .map(i => i.user_id)
          .filter((id): id is string => !!id && id !== userId);

        let ownerProfiles: Record<string, string> = {};
        if (sharedOwnerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', sharedOwnerIds);
          if (profiles) {
            ownerProfiles = Object.fromEntries(profiles.map(p => [p.id, p.full_name || '']));
          }
        }

        return (ownIntegrations || []).map(i => ({
          ...i,
          _isOwn: i.user_id === userId,
          _sharedByName: i.user_id && i.user_id !== userId ? (ownerProfiles[i.user_id] || null) : null,
        }));
      }

      // 2. Fetch shared integrations via permissions (for user-scoped types)
      const { data: permissions, error: permError } = await supabase
        .from('integration_user_permissions')
        .select('integration_id')
        .eq('user_id', userId);

      if (permError) throw permError;

      const sharedIntegrationIds = (permissions || []).map(p => p.integration_id);

      let sharedIntegrations: any[] = [];
      if (sharedIntegrationIds.length > 0) {
        const { data: shared, error: sharedError } = await supabase
          .from('tenant_integrations')
          .select('*')
          .in('tenant_id', tenantIds)
          .eq('integration_type', integrationType)
          .eq('is_active', true)
          .in('id', sharedIntegrationIds);

        if (sharedError) throw sharedError;
        sharedIntegrations = shared || [];
      }

      // 3. Get owner profiles for shared integrations
      const sharedOwnerIds = sharedIntegrations
        .map(i => i.user_id)
        .filter((id): id is string => !!id && id !== userId);
      
      let ownerProfiles: Record<string, string> = {};
      if (sharedOwnerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', sharedOwnerIds);
        
        if (profiles) {
          ownerProfiles = Object.fromEntries(profiles.map(p => [p.id, p.full_name || '']));
        }
      }

      // 4. Combine and deduplicate
      const ownIds = new Set((ownIntegrations || []).map(i => i.id));
      const combined = [
        ...(ownIntegrations || []).map(i => ({ ...i, _isOwn: true, _sharedByName: null as string | null })),
        ...sharedIntegrations
          .filter(i => !ownIds.has(i.id))
          .map(i => ({ 
            ...i, 
            _isOwn: false, 
            _sharedByName: i.user_id ? (ownerProfiles[i.user_id] || null) : null 
          })),
      ];

      return combined;
    },
    enabled,
  });
}

/**
 * Check if user has ANY active integration of a given type (own or shared).
 */
export function useHasIntegrationAccess(
  tenantId: string | string[] | undefined,
  integrationType: string
) {
  const { data: integrations } = useUserIntegrations(tenantId, integrationType);
  return (integrations || []).length > 0;
}
