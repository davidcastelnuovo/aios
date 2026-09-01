/**
 * Command Center access tiers stored in user_permissions (mutually exclusive modules).
 * Mirrors supabase/functions/_shared/command-center-access.mjs
 */

export type CommandCenterAccessTier = "full" | "sidecar" | "bugfix";

export const COMMAND_CENTER_PERMISSION_MODULES = {
  full: "command_center_full",
  sidecar: "command_center_sidecar",
  bugfix: "command_center_bugfix",
} as const;

export const COMMAND_CENTER_TIER_LABELS: Record<CommandCenterAccessTier, string> = {
  full: "גישה מלאה — מרכז בקרה + סיידבר",
  sidecar: "סיידבר בלבד",
  bugfix: "תיקוני באגים בלבד (Cursor)",
};

export const COMMAND_CENTER_TIER_DESCRIPTIONS: Record<CommandCenterAccessTier, string> = {
  full: "מרכז הפיקוד המלא + סיידבר תיקון מערכת + שליחת משימות פיתוח לכל הסוכנים",
  sidecar: "סיידבר תיקון מערכת בלבד — ללא כניסה ל-/command-center",
  bugfix: "סיידבר + שליחת תיקוני באגים מוגדרים ל-Cursor בלבד",
};

const TIER_ORDER: CommandCenterAccessTier[] = ["full", "sidecar", "bugfix"];

export function tierFromPermissionMap(
  permissions: Record<string, boolean> | null | undefined,
): CommandCenterAccessTier | null {
  if (!permissions) return null;
  for (const tier of TIER_ORDER) {
    if (permissions[COMMAND_CENTER_PERMISSION_MODULES[tier]] === true) return tier;
  }
  return null;
}

export function permissionRowsForTier(
  tier: CommandCenterAccessTier | null,
): Array<{ module: string; can_access: boolean }> {
  return TIER_ORDER.map((t) => ({
    module: COMMAND_CENTER_PERMISSION_MODULES[t],
    can_access: tier === t,
  }));
}

export function canAccessCommandCenterPage(tier: CommandCenterAccessTier | null): boolean {
  return tier === "full";
}

export function canAccessCommandCenterSidecar(tier: CommandCenterAccessTier | null): boolean {
  return tier === "full" || tier === "sidecar" || tier === "bugfix";
}

/** Maps CC tier to dev-escalation tier for Cursor/agent routing. */
export function devEscalationTierFromCommandCenter(
  tier: CommandCenterAccessTier | null,
): "full" | "bugfix" | null {
  if (tier === "full") return "full";
  if (tier === "bugfix") return "bugfix";
  return null;
}
