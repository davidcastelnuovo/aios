import { normalizeManusGroupsPayload } from './manus-wa-groups.mjs';

/**
 * Manus group sync — Carmen's WhatsApp ONLY.
 *
 * NEVER mix with Green API (operator phone), Meta Cloud API, or any other WA
 * connection. Source of truth: Manus Gateway list-groups.
 *
 * Exact call (required):
 *   GET {MANUS_GATEWAY_URL}/api/v1/instances/{instanceId}/groups
 *   Header: X-Api-Key: <Carmen instance key>
 * Without a valid key → 401 JSON. HTML SPA ⇒ wrong URL / path missing /api/v1.
 */

const BASE_URL = (Deno.env.get('MANUS_GATEWAY_URL') || 'https://whatsappgw-pzpyrrww.manus.space').replace(/\/$/, '');
const WORKER_SECRET = Deno.env.get('MANUS_GATEWAY_WORKER_SECRET') || '';
const MANUS_SYNC_TAG = 'manus_wa_sync';

function extractNextCursor(data) {
  const cursor = data?.nextCursor ?? data?.next_cursor ?? data?.cursor;
  return cursor ? String(cursor) : null;
}

function parseGatewayJson(text, url) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error(
      `Manus Gateway החזיר HTML במקום JSON (url=${url}). `
      + 'יש לקרוא בדיוק ל-/api/v1/instances/{id}/groups עם X-Api-Key תקין — אחרת מגיעים ל-SPA.',
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
    // 401 with JSON is the documented missing/invalid key response.
    let detail = text.slice(0, 280);
    try {
      const errJson = JSON.parse(text);
      detail = errJson.error || errJson.message || detail;
    } catch { /* keep raw */ }
    throw new Error(`Gateway groups ${res.status}: ${detail}`);
  }
  const data = parseGatewayJson(text, url);
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

/**
 * Prefer the documented instance API path + X-Api-Key only.
 * Admin worker-secret is optional fallback when configured.
 */
export async function fetchGroupsFromGateway(instanceId, apiKey) {
  const attempts = [];

  if (apiKey) {
    attempts.push({
      via: 'instance_api_key',
      run: () => fetchAllGroups(
        (cursor) => {
          // Exact path — do not omit /api/v1.
          let url = `${BASE_URL}/api/v1/instances/${instanceId}/groups`;
          if (cursor) url += `?cursor=${encodeURIComponent(cursor)}`;
          return url;
        },
        { 'X-Api-Key': apiKey },
      ),
    });
  }

  if (WORKER_SECRET) {
    attempts.push({
      via: 'admin_worker_secret',
      run: () => fetchAllGroups(
        (cursor) => {
          let url = `${BASE_URL}/api/admin/instances/${instanceId}/groups`;
          if (cursor) url += `?cursor=${encodeURIComponent(cursor)}`;
          return url;
        },
        { 'X-Worker-Secret': WORKER_SECRET },
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

/** Already-tagged Manus sync rows (from a prior Gateway sync). Never Green API dump. */
async function loadTaggedManusSyncGroups(supabaseSvc, tenantId) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseSvc
      .from('whatsapp_groups')
      .select('id, group_name, group_chat_id, is_blocked')
      .eq('tenant_id', tenantId)
      .eq('description', MANUS_SYNC_TAG)
      .or('is_blocked.is.null,is_blocked.eq.false')
      .order('group_name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }
  return rows.map((row) => ({
    id: row.group_chat_id,
    name: row.group_name || row.group_chat_id,
    dbId: row.id,
  }));
}

/**
 * Staging-safe fallback: ONLY groups with manus_wa message traffic.
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

      // Staging mocked / no key: NEVER overwrite a prior Gateway catalog with traffic-only.
      // Prefer already-tagged manus_wa_sync rows (from a Gateway seed). Else traffic only.
      const existingVia = settings?.manus_groups_sync?.via;
      const existingCount = settings?.manus_groups_sync?.count || 0;
      const tagged = await loadTaggedManusSyncGroups(supabaseSvc, integ.tenant_id);

      if (tagged.length > 0 && (existingVia === 'instance_api_key' || existingVia === 'admin_worker_secret' || tagged.length >= existingCount)) {
        const warning = mocked
          ? 'Staging: Manus מדומה (בלי api_key) — נשמרה רשימת Gateway קיימת (לא Green API, לא תעבורה חלקית)'
          : 'חסר api_key — נשמרה רשימת manus_wa_sync קיימת';
        const saved = await persistSyncCatalog(
          supabaseSvc, integ, settings, instanceId, tagged,
          existingVia || 'manus_wa_sync_tags',
          warning,
        );
        synced.push(...saved);
        warnings.push(warning);
        continue;
      }

      const trafficGroups = await loadManusTrafficGroups(supabaseSvc, integ.tenant_id);
      const warning = mocked
        ? 'Staging: Manus מדומה (בלי api_key) — רק תעבורת manus_wa. לסנכרון מלא מהאינסטנס צריך X-Api-Key.'
        : 'חסר Manus api_key / WORKER_SECRET — רק תעבורת manus_wa';
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
          error: 'אין api_key ל-Manus ואין תעבורת manus_wa. לא נטענו קבוצות Green API. '
            + 'נדרש GET /api/v1/instances/{id}/groups עם X-Api-Key.',
        });
      }
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
