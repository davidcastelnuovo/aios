import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import {
  canAccessCommandCenterPage,
  canAccessCommandCenterSidecar,
  COMMAND_CENTER_PERMISSION_MODULES,
  type CommandCenterAccessTier,
  devEscalationTierFromCommandCenter,
  tierFromPermissionMap,
} from "@/lib/commandCenterAccess";
import { getDevEscalationTier as getLegacyDevTier } from "@/lib/devEscalationAccess";

// Owners who may use the ORG OpenAI key without a personal key (legacy).
export const COMMAND_CENTER_ALLOWLIST = ["david.castelnuovo@gmail.com"];

export type CommandCenterAccessState = {
  loading: boolean;
  /** Any Command Center surface (page or sidecar). */
  allowed: boolean;
  tier: CommandCenterAccessTier | null;
  canCommandCenterPage: boolean;
  canSidecar: boolean;
  canManageSettings: boolean;
  devEscalationTier: "full" | "bugfix" | null;
};

function legacyEmailOrApiKeyAccess(email: string, hasApiKey: boolean): boolean {
  if (COMMAND_CENTER_ALLOWLIST.includes(email)) return true;
  return hasApiKey;
}

export function useCommandCenterAccess(): CommandCenterAccessState {
  const { userId, user } = useCurrentUser();
  const { isOwner, isSuperAdmin, campaignerId } = useUserRole();
  const email = user?.email;

  const { data, isPending } = useQuery({
    queryKey: ["command-center-access", userId],
    queryFn: async () => {
      if (!userId) return { permissions: {} as Record<string, boolean>, hasApiKey: false };

      const [{ data: perms, error: permErr }, { data: keyRow }] = await Promise.all([
        supabase
          .from("user_permissions")
          .select("module, can_access")
          .eq("user_id", userId)
          .in("module", Object.values(COMMAND_CENTER_PERMISSION_MODULES)),
        (supabase as any).from("user_api_keys").select("user_id").limit(1).maybeSingle(),
      ]);

      if (permErr) throw permErr;

      const permissions: Record<string, boolean> = {};
      perms?.forEach((p) => {
        permissions[p.module] = p.can_access;
      });

      return { permissions, hasApiKey: !!keyRow };
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  return useMemo(() => {
    const loading = !userId || isPending;
    if (loading) {
      return {
        loading: true,
        allowed: false,
        tier: null,
        canCommandCenterPage: false,
        canSidecar: false,
        canManageSettings: false,
        devEscalationTier: null,
      };
    }

    const emailLower = email?.toLowerCase() ?? "";
    const dbTier = tierFromPermissionMap(data?.permissions);
    const legacyAllowed = legacyEmailOrApiKeyAccess(emailLower, !!data?.hasApiKey);

    // Explicit DB tier wins; otherwise owners/super-admins + legacy allowlist → full.
    let tier: CommandCenterAccessTier | null = dbTier;
    if (!tier && (isOwner || isSuperAdmin || legacyAllowed)) {
      tier = "full";
    }

    const canCommandCenterPage = canAccessCommandCenterPage(tier);
    const canSidecar = canAccessCommandCenterSidecar(tier);
    const allowed = canCommandCenterPage || canSidecar;

    const legacyDev = getLegacyDevTier({
      userId: userId ?? null,
      campaignerId: campaignerId ?? null,
      phone: user?.phone ?? null,
    });
    const devEscalationTier = legacyDev ?? devEscalationTierFromCommandCenter(tier);

    return {
      loading: false,
      allowed,
      tier,
      canCommandCenterPage,
      canSidecar,
      canManageSettings: isOwner || isSuperAdmin,
      devEscalationTier,
    };
  }, [
    userId,
    isPending,
    data,
    email,
    isOwner,
    isSuperAdmin,
    campaignerId,
    user?.phone,
  ]);
}
