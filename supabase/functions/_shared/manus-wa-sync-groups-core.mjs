import { normalizeManusGroupsPayload } from './manus-wa-groups.mjs';

/**
 * Manus group sync — Carmen's WhatsApp ONLY.
 *
 * NEVER mix with Green API (operator phone), Meta Cloud API, or any other WA
 * connection. Source of truth for membership is Manus Gateway list-groups.
 * Staging mocked Manus has no tokens — fallback is manus_wa chat traffic only,
 * never the full whatsapp_groups table (that includes Green API groups).
 */

const BASE_URL = Deno.env.get('MANUS_GATEWAY_URL') || 'https://whatsappgw-pzpyrrww.manus.space';
const WORKER_SECRET = Deno.env.get('MANUS_GATEWAY_WORKER_SECRET') || '';
const MANUS_SYNC_TAG = 'manus_wa_sync';

function extractNextCursor(data) {
  const cursor = data?.nextCursor ?? data?.next_cursor ?? data?.cursor;
  return cursor ? String(cursor) : null;
}

function parseGatewayJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      'Manus Gateway עדיין לא מחזיר list-groups (קיבלנו HTML במקום JSON). '
      + 'צריך ש-Manus יפעיל GET /api/v1/instances/{id}/groups. '
      + 'עד אז AIOS מציג רק קבוצות עם תעבורת manus_wa — לא Green API.',
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error(`Gateway החזיר JSON לא תקין: ${trimmed.slice(0, 180)}`);
  }
}

async function fetchGroupsPage(url, headers) {
  const res = await fetch(url, { method: 'GET', headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Gateway groups ${res.status}: ${text.slice(0, 280)}`);
  }
  const data = parseGatewayJson(text);
  return {
    groups: normalizeManusGroupsPayload(data),
    nextCursor: extractNextCursor(data),
  };
}

async function fetchAllGroups(buildUrl, headers) {
  const byId = new Map();
  let cursor;
  for (let page = 0; page < 100; page++) {
    const { groups, nextCursor } = await fetchGroupsPage(buildUrl(cursor), headers);
    for (const g of groups) byId.set(g.id, g);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return [...byId.values()];
}

function resolveInstanceId(integ) {
  const settings = integ.settings || {};
  return String(
    integ.instance_id
    || settings.instance_id
    || settings.instanceId
    || '',
  ).trim();
}

function isMockedIntegration(integ) {
  const settings = integ.settings || {};
  return settings.mocked === true || settings.mock === true;
}

/** Admin worker secret first, then instance API key. Never Green API. */
export async function fetchGroupsFromGateway(instanceId, apiKey) {
  const attempts = [];

  if (WORKER_SECRET) {
    attempts.push({
      via: 'admin_worker_secret',
      run: () => fetchAllGroups(
        (cursor) => {
          const url = new URL(`${BASE_URL}/api/admin/instances/${instanceId}/groups`);
          if (cursor) url.searchParams.set('cursor', cursor);
          return url.toString();
        },
        { 'X-Worker-Secret': WORKER_SECRET },
      ),
    });
  }

  if (apiKey) {
    attempts.push({
      via: 'instance_api_key',
      run: () => fetchAllGroups(
        (cursor) => {
          const url = new URL(`${BASE_URL}/api/v1/instances/${instanceId}/groups`);
          if (cursor) url.searchParams.set('cursor', cursor);
          return url.toString();
        },
        { 'X-Api-Key': apiKey },
      ),
    });
  }

  if (!attempts.length) {
    throw new Error('אין דרך לגשת ל-Manus Gateway (חסר api_key וגם MANUS_GATEWAY_WORKER_SECRET)');
  }

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const groups = await attempt.run();
      if (groups.length > 0) return { groups, via: attempt.via };
      lastErr = new Error(`${attempt.via}: Gateway החזיר 0 קבוצות`);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn('[manus-wa-sync-groups] attempt failed', attempt.via, lastErr.message);
    }
  }
  throw lastErr || new Error('סנכרון קבוצות מ-Manus Gateway נכשל');
}

/**
 * Staging-safe fallback: ONLY groups that already have manus_wa message traffic.
 * Never scan the full whatsapp_groups table — that mixes Green API operator groups.
 */
async function loadManusTrafficGroups(supabaseSvc, tenantId) {
  const { data: manusMsgs, error: msgErr } = await supabaseSvc
    .from('chat_messages')
    .select('group_id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'manus_wa')
    .not('group_id', 'is', null);
  if (msgErr) throw msgErr;

  const ids = [...new Set((manusMsgs || []).map((m) => m.group_id).filter(Boolean).map(String))];
  if (!ids.length) return [];

  const rows = [];
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await supabaseSvc
      .from('whatsapp_groups')
      .select('id, group_name, group_chat_id, is_blocked')
      .eq('tenant_id', tenantId)
      .in('id', chunk)
      .or('is_blocked.is.null,is_blocked.eq.false');
    if (error) throw error;
    rows.push(...(data || []));
  }

  return rows.map((row) => ({
    id: row.group_chat_id,
    name: row.group_name || row.group_chat_id,
    dbId: row.id,
  }));
}

async function clearStaleManusSyncTags(supabaseSvc, tenantId, keepGroupIds) {
  const keep = new Set((keepGroupIds || []).map(String));
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseSvc
      .from('whatsapp_groups')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('description', MANUS_SYNC_TAG)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    const stale = data.map((r) => r.id).filter((id) => !keep.has(String(id)));
    if (stale.length) {
      const { error: clearErr } = await supabaseSvc
        .from('whatsapp_groups')
        .update({ description: null, updated_at: new Date().toISOString() })
        .in('id', stale);
      if (clearErr) throw clearErr;
    }
    if (data.length < pageSize) break;
  }
}

async function persistSyncCatalog(supabaseSvc, integ, settings, instanceId, groups, via, warning) {
  const groupChatIds = [];
  const syncedCatalog = [];
  const synced = [];
  const keepIds = [];

  for (const g of groups) {
    let rowId = g.dbId || null;
    let rowName = g.name;

    if (!rowId) {
      const { data: row, error: upsertErr } = await supabaseSvc
        .from('whatsapp_groups')
        .upsert(
          {
            tenant_id: integ.tenant_id,
            group_chat_id: g.id,
            group_name: g.name || g.id,
            description: MANUS_SYNC_TAG,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'tenant_id,group_chat_id' },
        )
        .select('id, group_name, group_chat_id')
        .maybeSingle();
      if (upsertErr) throw upsertErr;
      rowId = row?.id || null;
      rowName = row?.group_name || g.name;
    } else {
      await supabaseSvc
        .from('whatsapp_groups')
        .update({ description: MANUS_SYNC_TAG, updated_at: new Date().toISOString() })
        .eq('id', rowId);
    }

    if (!rowId) continue;
    keepIds.push(rowId);
    groupChatIds.push(g.id);
    const entry = { groupChatId: g.id, groupId: rowId, name: rowName || g.name };
    syncedCatalog.push(entry);
    synced.push({ integrationId: integ.id, ...entry });
  }

  // Drop manus_wa_sync tags that are not in this Manus-only catalog
  // (prevents Green API groups from sticking around after a bad sync).
  await clearStaleManusSyncTags(supabaseSvc, integ.tenant_id, keepIds);

  const mergedSettings = {
    ...settings,
    instance_id: instanceId || settings.instance_id || null,
    manus_groups_sync: {
      synced_at: new Date().toISOString(),
      group_chat_ids: groupChatIds,
      groups: syncedCatalog,
      count: groupChatIds.length,
      via,
      gateway: BASE_URL,
      warning: warning || null,
    },
  };
  const { error: settingsErr } = await supabaseSvc
    .from('tenant_integrations')
    .update({ settings: mergedSettings })
    .eq('id', integ.id);
  if (settingsErr) throw settingsErr;

  return synced;
}

export async function syncManusGroupsForTenant(supabaseSvc, integrations) {
  const synced = [];
  const errors = [];
  const warnings = [];

  for (const integ of integrations) {
    const settings = integ.settings || {};
    const instanceId = resolveInstanceId(integ);
    const apiKey = integ.api_key || '';
    const mocked = isMockedIntegration(integ);
    const canCallGateway = Boolean(WORKER_SECRET || apiKey);

    try {
      if (canCallGateway && instanceId) {
        const { groups, via } = await fetchGroupsFromGateway(instanceId, apiKey);
        const saved = await persistSyncCatalog(
          supabaseSvc, integ, settings, instanceId, groups, via, null,
        );
        synced.push(...saved);
        if (!groups.length) {
          errors.push({
            integrationId: integ.id,
            error: `Manus Gateway החזיר 0 קבוצות (via=${via}, instance=${instanceId})`,
          });
        }
        continue;
      }

      // Staging mocked Manus: NO tokens, and MUST NOT read Green API groups.
      // Only groups with confirmed manus_wa traffic are allowed.
      if (mocked || !canCallGateway) {
        const trafficGroups = await loadManusTrafficGroups(supabaseSvc, integ.tenant_id);
        const warning = mocked
          ? 'Staging: Manus מדומה (בלי api_key) — רק קבוצות עם תעבורת manus_wa (לא Green API)'
          : 'חסר Manus api_key / WORKER_SECRET — רק קבוצות עם תעבורת manus_wa';
        const saved = await persistSyncCatalog(
          supabaseSvc,
          integ,
          settings,
          instanceId,
          trafficGroups,
          mocked ? 'staging_manus_traffic_only' : 'manus_traffic_fallback',
          warning,
        );
        synced.push(...saved);
        warnings.push(warning);
        if (!trafficGroups.length) {
          errors.push({
            integrationId: integ.id,
            error: 'אין תעבורת manus_wa לקבוצות, ואין גישה ל-Manus Gateway. לא נטענו קבוצות Green API בכוונה.',
          });
        }
        continue;
      }

      errors.push({
        integrationId: integ.id,
        error: `חסר instance_id לחיבור Manus (instance=${instanceId || 'missing'})`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[manus-wa-sync-groups] integration failed', integ.id, msg);
      errors.push({ integrationId: integ.id, error: msg });
    }
  }

  if (!synced.length) {
    return {
      success: false,
      error: errors[0]?.error || 'סנכרון קבוצות Manus נכשל — לא נשמרו קבוצות',
      errors,
    };
  }

  const uniqueGroups = [...new Map(synced.map((g) => [g.groupId, g])).values()];
  return {
    success: true,
    syncedCount: uniqueGroups.length,
    groups: uniqueGroups,
    warning: warnings[0] || undefined,
    errors: errors.length ? errors : undefined,
  };
}
