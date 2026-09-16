/**
 * Observe members speaking in Carmen's Manus groups.
 * Manus-only membership catalog — never treat Green API operator groups as Carmen's.
 *
 * Writes carmen_whatsapp_identity_candidates (seen phone/LID per group).
 * Auto-marks candidate approved when phone already matches an approved
 * carmen_whatsapp_identities row or an active campaigner (no access widening).
 */

import { phoneTail, phonesMatch } from './carmen-group-sender.mjs';

export function normalizeObservedPhone(phone, groupChatId) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const groupDigits = String(groupChatId || '').split('@')[0].replace(/\D/g, '');
  if (groupDigits && digits === groupDigits) return null;
  if (phoneTail(digits).length < 9) return null;
  return digits;
}

export function pickCandidateStatus({ phone, matchedIdentity, matchedCampaigner }) {
  if (!phone) return 'awaiting_identity';
  if (matchedIdentity || matchedCampaigner) return 'approved';
  return 'awaiting_approval';
}

/**
 * @param {any} supabase service-role client
 * @param {{
 *   tenantId: string,
 *   groupId?: string | null,
 *   groupChatId: string,
 *   phone?: string | null,
 *   whatsappLid?: string | null,
 *   whatsappName?: string | null,
 *   source?: string,
 * }} args
 */
export async function observeManusGroupMember(supabase, args) {
  const tenantId = args.tenantId;
  const groupChatId = String(args.groupChatId || '').trim();
  if (!tenantId || !groupChatId) {
    return { observed: false, reason: 'missing_tenant_or_group' };
  }

  const phone = normalizeObservedPhone(args.phone, groupChatId);
  const lid = args.whatsappLid ? String(args.whatsappLid).trim() : null;
  if (!phone && !lid) {
    return { observed: false, reason: 'unresolved_member' };
  }

  // Never map Carmen's own Manus number as a group "member".
  if (phone) {
    const { data: manusRows } = await supabase
      .from('tenant_integrations')
      .select('settings')
      .eq('tenant_id', tenantId)
      .eq('integration_type', 'manus_wa')
      .eq('is_active', true)
      .limit(5);
    const isSelfBot = (manusRows || []).some((row) => {
      const bot = String(row?.settings?.phone_number || '').replace(/\D/g, '');
      return bot && phonesMatch(bot, phone);
    });
    if (isSelfBot) {
      return { observed: false, reason: 'self_bot_phone' };
    }
  }

  let groupId = args.groupId || null;
  if (!groupId) {
    const { data: wg } = await supabase
      .from('whatsapp_groups')
      .select('id, description')
      .eq('tenant_id', tenantId)
      .eq('group_chat_id', groupChatId)
      .maybeSingle();
    groupId = wg?.id || null;
  }

  // Prefer linking against existing approved identity / active campaigner (no new grants).
  let matchedIdentity = null;
  let matchedCampaigner = null;
  if (phone) {
    const tail = phoneTail(phone);
    const { data: identities } = await supabase
      .from('carmen_whatsapp_identities')
      .select('id, phone, display_name, entity_type, entity_id, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .or(`phone.eq.${phone},phone.ilike.%${tail}`)
      .limit(5);
    matchedIdentity = (identities || []).find((row) => phonesMatch(row.phone, phone)) || null;

    if (!matchedIdentity) {
      const { data: campaigners } = await supabase
        .from('campaigners')
        .select('id, full_name, phone, active')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .limit(200);
      matchedCampaigner = (campaigners || []).find((row) => phonesMatch(row.phone, phone)) || null;
    }
  }

  const status = pickCandidateStatus({ phone, matchedIdentity, matchedCampaigner });
  const displayName = args.whatsappName
    || matchedIdentity?.display_name
    || matchedCampaigner?.full_name
    || null;

  const row = {
    tenant_id: tenantId,
    group_id: groupId,
    group_chat_id: groupChatId,
    phone,
    whatsapp_lid: lid,
    whatsapp_name: displayName ? String(displayName).slice(0, 200) : null,
    status,
    updated_at: new Date().toISOString(),
  };

  // Unique indexes are partial (phone NOT NULL / lid NOT NULL) — upsert via select+update/insert.
  let existing = null;
  if (phone) {
    const { data } = await supabase
      .from('carmen_whatsapp_identity_candidates')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('group_chat_id', groupChatId)
      .eq('phone', phone)
      .maybeSingle();
    existing = data;
  } else if (lid) {
    const { data } = await supabase
      .from('carmen_whatsapp_identity_candidates')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('group_chat_id', groupChatId)
      .eq('whatsapp_lid', lid)
      .maybeSingle();
    existing = data;
  }

  if (existing?.id) {
    // Never downgrade an approved candidate if a later turn lacks identity match.
    const nextStatus = existing.status === 'approved' ? 'approved' : status;
    const { error } = await supabase
      .from('carmen_whatsapp_identity_candidates')
      .update({
        ...row,
        status: nextStatus,
        phone: phone || undefined,
        whatsapp_lid: lid || undefined,
      })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('carmen_whatsapp_identity_candidates')
      .insert(row);
    if (error) throw error;
  }

  return {
    observed: true,
    phone,
    lid,
    status,
    linked: Boolean(matchedIdentity || matchedCampaigner),
    identityId: matchedIdentity?.id || null,
    campaignerId: matchedCampaigner?.id || matchedIdentity?.entity_id || null,
    displayName,
    source: args.source || 'manus_wa',
  };
}

/** True when this group is part of Carmen's Manus membership catalog. */
export async function isCarmenManusGroup(supabase, tenantId, groupId, groupChatId) {
  if (groupId) {
    const { data } = await supabase
      .from('whatsapp_groups')
      .select('id, description, group_chat_id')
      .eq('tenant_id', tenantId)
      .eq('id', groupId)
      .maybeSingle();
    if (data?.description === 'manus_wa_sync') return true;
    if (data?.group_chat_id) groupChatId = data.group_chat_id;
  }
  if (!groupChatId) return false;

  const { data: integ } = await supabase
    .from('tenant_integrations')
    .select('settings')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'manus_wa')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const sync = integ?.settings?.manus_groups_sync || {};
  const ids = Array.isArray(sync.group_chat_ids) ? sync.group_chat_ids.map(String) : [];
  if (ids.includes(String(groupChatId))) return true;
  const groups = Array.isArray(sync.groups) ? sync.groups : [];
  return groups.some((g) => String(g?.groupChatId || g?.id || '') === String(groupChatId));
}

/** Compact roster note for Carmen's group prompt. */
export async function buildObservedGroupMembersNote(supabase, tenantId, groupChatId, limit = 12) {
  const { data } = await supabase
    .from('carmen_whatsapp_identity_candidates')
    .select('phone, whatsapp_name, status, updated_at')
    .eq('tenant_id', tenantId)
    .eq('group_chat_id', groupChatId)
    .not('phone', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  const rows = data || [];
  if (!rows.length) return '';
  const lines = rows.map((r) => {
    const name = r.whatsapp_name || 'ללא שם';
    const link = r.status === 'approved' ? 'מזוהה' : 'נצפה';
    return `${name} (${r.phone}, ${link})`;
  });
  return `\n\n[חברים שנצפו בקבוצת Manus זו] ${lines.join('; ')}. כשפונים אליך — השתמש ב-participant_phone לזיהוי, לא בשם תצוגה בלבד.`;
}
