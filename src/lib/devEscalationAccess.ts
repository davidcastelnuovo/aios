/**
 * Frontend mirror of supabase/functions/_shared/dev-escalation-auth.mjs
 * (keep IDs in sync). Role alone is never enough.
 */

export type DevEscalationTier = "full" | "bugfix" | null;

const FULL = {
  user_ids: ["ac7b2493-dcfa-47d8-80cc-b3900a406c46"],
  campaigner_ids: ["3d58377d-1518-4067-82d7-34bb615d3039"],
  phone_suffixes: ["507677613"],
} as const;

const BUGFIX = {
  user_ids: ["52eb35b4-0899-4927-b118-6cc07c164e3d"],
  campaigner_ids: ["d6cd8d62-701e-4040-897b-cd07e119a9bd"],
  phone_suffixes: ["545612156"],
} as const;

function normalizePhoneSuffix(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

function matches(
  identity: { userId?: string | null; campaignerId?: string | null; phone?: string | null },
  allowlist: typeof FULL,
): boolean {
  if (identity.userId && allowlist.user_ids.includes(identity.userId as never)) return true;
  if (identity.campaignerId && allowlist.campaigner_ids.includes(identity.campaignerId as never)) return true;
  const suffix = normalizePhoneSuffix(identity.phone);
  if (suffix && allowlist.phone_suffixes.includes(suffix as never)) return true;
  return false;
}

export function getDevEscalationTier(identity: {
  userId?: string | null;
  campaignerId?: string | null;
  phone?: string | null;
}): DevEscalationTier {
  if (matches(identity, FULL)) return "full";
  if (matches(identity, BUGFIX)) return "bugfix";
  return null;
}

export function canDispatchDevTask(tier: DevEscalationTier): boolean {
  return tier === "full" || tier === "bugfix";
}
