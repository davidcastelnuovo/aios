/**
 * Command Center access tiers in user_permissions (mutually exclusive module rows).
 * Keep in sync with src/lib/commandCenterAccess.ts
 */

export const COMMAND_CENTER_PERMISSION_MODULES = Object.freeze({
  full: "command_center_full",
  sidecar: "command_center_sidecar",
  bugfix: "command_center_bugfix",
});

const TIER_ORDER = ["full", "sidecar", "bugfix"];

/**
 * @param {Array<{ module?: string, can_access?: boolean }>|null|undefined} rows
 * @returns {'full'|'sidecar'|'bugfix'|null}
 */
export function commandCenterTierFromPermissionRows(rows) {
  if (!Array.isArray(rows)) return null;
  const map = Object.fromEntries(
    rows.filter((r) => r?.module).map((r) => [String(r.module), !!r.can_access]),
  );
  for (const tier of TIER_ORDER) {
    if (map[COMMAND_CENTER_PERMISSION_MODULES[tier]] === true) return tier;
  }
  return null;
}

/**
 * @param {'full'|'sidecar'|'bugfix'|null} tier
 * @returns {'full'|'bugfix'|null}
 */
export function devEscalationTierFromCommandCenter(tier) {
  if (tier === "full") return "full";
  if (tier === "bugfix") return "bugfix";
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|null|undefined} userId
 */
export async function loadCommandCenterPermissionRows(supabase, userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("user_permissions")
    .select("module, can_access")
    .eq("user_id", userId)
    .in("module", Object.values(COMMAND_CENTER_PERMISSION_MODULES));
  if (error) {
    console.warn("[command-center-access] permission load failed:", error.message);
    return [];
  }
  return data ?? [];
}
