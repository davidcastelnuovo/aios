/**
 * Carmen conversation access — policy merge, surface checks, dev tier resolution.
 * Used by carmen.ts (WhatsApp) and run-ai-agent (Command Center + dev escalation).
 */

import { managerGroupAccessViaAllowedPhones, phoneTail, phonesMatch } from './carmen-group-sender.mjs';
import { getDevEscalationTier as getHardcodedDevTier } from './dev-escalation-auth.mjs';

export const SURFACE_PRIVATE = 'whatsapp_private';
export const SURFACE_GROUP = 'whatsapp_group';
export const SURFACE_CC = 'command_center';

/** @typedef {{ phone: string, label?: string, campaigner_id?: string, client_id?: string, dev_escalation_tier?: string|null, surfaces?: string[] }} PolicyPhoneEntry */

export function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** Parse private_phones jsonb into normalized entries. */
export function parsePolicyPhones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const phone = normalizePhoneDigits(row?.phone);
      if (!phone || phone.length < 9) return null;
      return {
        phone,
        label: row?.label ? String(row.label) : undefined,
        campaigner_id: row?.campaigner_id || null,
        client_id: row?.client_id || null,
        dev_escalation_tier: row?.dev_escalation_tier || null,
        surfaces: Array.isArray(row?.surfaces) && row.surfaces.length
          ? row.surfaces.map(String)
          : [SURFACE_PRIVATE],
      };
    })
    .filter(Boolean);
}

/** Phone list strings only (backward compat with carmen_allowed_phones). */
export function policyPhoneList(entries) {
  return [...new Set((entries || []).map((e) => e.phone).filter(Boolean))];
}

/**
 * Merge automation configuration with optional carmen_access_policies row.
 * Policy wins when present; automation remains fallback.
 */
export function mergeCarmenScopeConfig(automationCfg = {}, policy = null, groupChatIds = []) {
  const cfg = automationCfg || {};
  const policyPhones = policy ? parsePolicyPhones(policy.private_phones) : [];
  const policyPhoneStrings = policyPhoneList(policyPhones);

  let scopeMode = cfg.carmen_scope_mode || 'all';
  let allowedPhones = Array.isArray(cfg.carmen_allowed_phones)
    ? cfg.carmen_allowed_phones.map((p) => normalizePhoneDigits(p)).filter(Boolean)
    : [];
  let allowedGroups = [];
  const cfgGroups = cfg.carmen_allowed_group_ids?.length
    ? cfg.carmen_allowed_group_ids
    : (cfg.carmen_allowed_group_id ? [cfg.carmen_allowed_group_id]
      : (Array.isArray(cfg.carmen_allowed_groups) ? cfg.carmen_allowed_groups : []));
  allowedGroups = [...cfgGroups];

  let openMemberGroups = cfg.carmen_open_member_groups === true;
  let requireDirectAddress = policy?.require_direct_address !== false;

  if (policy) {
    if (policyPhoneStrings.length > 0) {
      allowedPhones = policyPhoneStrings;
      if (scopeMode === 'all') scopeMode = 'specific_phone';
    }
    if (Array.isArray(policy.allowed_group_ids) && policy.allowed_group_ids.length > 0) {
      allowedGroups = [...groupChatIds];
      scopeMode = scopeMode === 'specific_phone' ? 'specific_group' : (scopeMode === 'all' ? 'specific_group' : scopeMode);
    }
    openMemberGroups = policy.open_member_groups === true;
  }

  return {
    scopeMode,
    allowedPhones,
    allowedGroups,
    openMemberGroups,
    requireDirectAddress,
    policyPhones,
    denyMessageHe: policy?.deny_message_he || null,
    hasPolicy: !!policy,
  };
}

export function isPhoneOnPolicyList(phoneDigits, allowedPhones) {
  const d = normalizePhoneDigits(phoneDigits);
  if (!d) return false;
  return (allowedPhones || []).some((p) => phonesMatch(d, p));
}

export function identityAllowsSurface(identity, surface) {
  const surfaces = Array.isArray(identity?.surfaces) ? identity.surfaces : [SURFACE_PRIVATE, SURFACE_GROUP];
  return surfaces.includes(surface);
}

/**
 * Resolve dev escalation tier: DB identity / CC row → hardcoded fallback.
 * @returns {'full'|'bugfix'|null}
 */
export function resolveDevEscalationTier(identity = {}, dbTier = null) {
  if (dbTier === 'full' || dbTier === 'bugfix') return dbTier;
  if (identity?.dev_escalation_tier === 'full' || identity?.dev_escalation_tier === 'bugfix') {
    return identity.dev_escalation_tier;
  }
  return getHardcodedDevTier(identity);
}

export function devTierFromPolicyPhone(policyPhones, phoneDigits) {
  const d = normalizePhoneDigits(phoneDigits);
  const entry = (policyPhones || []).find((p) => phonesMatch(d, p.phone));
  return entry?.dev_escalation_tier || null;
}

/** Load dev escalation tier from DB rows, then hardcoded fallback. */
export async function loadDevEscalationTierFromDb(
  supabase,
  { tenantId, agentId, userId, campaignerId, phone },
) {
  if (tenantId && agentId && userId) {
    const { data: cc } = await supabase
      .from('carmen_command_center_access')
      .select('dev_escalation_tier')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
      .eq('user_id', userId)
      .maybeSingle();
    if (cc?.dev_escalation_tier === 'full' || cc?.dev_escalation_tier === 'bugfix') {
      return cc.dev_escalation_tier;
    }
  }
  if (tenantId && agentId && campaignerId) {
    const { data: ccCamp } = await supabase
      .from('carmen_command_center_access')
      .select('dev_escalation_tier')
      .eq('tenant_id', tenantId)
      .eq('agent_id', agentId)
      .eq('campaigner_id', campaignerId)
      .maybeSingle();
    if (ccCamp?.dev_escalation_tier === 'full' || ccCamp?.dev_escalation_tier === 'bugfix') {
      return ccCamp.dev_escalation_tier;
    }
  }
  const digits = normalizePhoneDigits(phone);
  if (tenantId && digits) {
    const tail = phoneTail(digits);
    const { data: identities } = await supabase
      .from('carmen_whatsapp_identities')
      .select('phone, dev_escalation_tier, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .or(`phone.eq.${digits},phone.ilike.%${tail}`)
      .limit(5);
    const row = (identities || []).find((r) => phoneTail(r.phone) === tail);
    if (row?.dev_escalation_tier === 'full' || row?.dev_escalation_tier === 'bugfix') {
      return row.dev_escalation_tier;
    }
    if (tenantId && agentId) {
      const { data: policy } = await supabase
        .from('carmen_access_policies')
        .select('private_phones')
        .eq('tenant_id', tenantId)
        .eq('agent_id', agentId)
        .maybeSingle();
      const tier = devTierFromPolicyPhone(parsePolicyPhones(policy?.private_phones), digits);
      if (tier === 'full' || tier === 'bugfix') return tier;
    }
  }
  return getHardcodedDevTier({ userId, campaignerId, phone });
}

/**
 * Groups where Carmen's Manus WA bot has been seen (chat_messages or active group session).
 * Excludes groups registered only via operator Green API mirror.
 */
export async function fetchManusConnectedGroupIds(supabase, tenantId) {
  const ids = new Set();
  if (!tenantId) return ids;

  const { data: manusMsgs } = await supabase
    .from('chat_messages')
    .select('group_id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'manus_wa')
    .not('group_id', 'is', null);
  for (const row of manusMsgs || []) {
    if (row.group_id) ids.add(String(row.group_id));
  }

  const { data: sessions } = await supabase
    .from('carmen_whatsapp_sessions')
    .select('chat_id')
    .eq('tenant_id', tenantId)
    .like('chat_id', '%@g.us');
  const chatIds = [...new Set((sessions || []).map((s) => s.chat_id).filter(Boolean))];
  if (chatIds.length > 0) {
    const { data: groups } = await supabase
      .from('whatsapp_groups')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('group_chat_id', chatIds);
    for (const g of groups || []) ids.add(String(g.id));
  }

  return ids;
}

/** Filter policy group UUIDs to Manus-connected groups only. */
export async function filterPolicyGroupsToManus(supabase, tenantId, allowedGroupIds) {
  const raw = Array.isArray(allowedGroupIds) ? allowedGroupIds.map(String).filter(Boolean) : [];
  if (!raw.length) return [];
  const manusIds = await fetchManusConnectedGroupIds(supabase, tenantId);
  return raw.filter((id) => manusIds.has(id));
}

export { managerGroupAccessViaAllowedPhones, phoneTail, phonesMatch };
