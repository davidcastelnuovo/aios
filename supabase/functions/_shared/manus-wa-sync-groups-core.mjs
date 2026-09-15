import { normalizeManusGroupsPayload } from './manus-wa-groups.mjs';

const BASE_URL = Deno.env.get('MANUS_GATEWAY_URL') || 'https://whatsappgw-pzpyrrww.manus.space';
const WORKER_SECRET = Deno.env.get('MANUS_GATEWAY_WORKER_SECRET') || '';

function extractNextCursor(data) {
  const cursor = data?.nextCursor ?? data?.next_cursor ?? data?.cursor;
  return cursor ? String(cursor) : null;
}

function parseGatewayJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed || trimmed.startsWith('<')) {
    throw new Error('Gateway החזיר HTML במקום JSON — בדוק MANUS_GATEWAY_URL / instance_id');
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
    rawCount: Array.isArray(data?.groups) ? data.groups.length
      : Array.isArray(data?.data?.groups) ? data.data.groups.length
      : Array.isArray(data) ? data.length : null,
  };
}

async function fetchAllGroups(buildUrl, headers) {
  const byId = new Map();
  let cursor;
  let lastRawCount = null;
  for (let page = 0; page < 100; page++) {
    const { groups, nextCursor, rawCount } = await fetchGroupsPage(buildUrl(cursor), headers);
    lastRawCount = rawCount;
    for (const g of groups) byId.set(g.id, g);
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
  }
  return { groups: [...byId.values()], lastRawCount };
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

/** Admin worker secret first, then instance API key. */
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
    throw new Error('אין דרך לגשת ל-Gateway (חסר api_key וגם MANUS_GATEWAY_WORKER_SECRET)');
  }

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const { groups, lastRawCount } = await attempt.run();
      if (groups.length > 0) return { groups, via: attempt.via };
      lastErr = new Error(`${attempt.via}: gateway returned 0 groups (rawCount=${lastRawCount})`);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn('[manus-wa-sync-groups] attempt failed', attempt.via, lastErr.message);
    }
  }
  throw lastErr || new Error('סנכרון קבוצות מ-Gateway נכשל');
}

async function loadLocalGroupCatalog(supabaseSvc, tenantId) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseSvc
      .from('whatsapp_groups')
      .select('id, group_name, group_chat_id, is_blocked')
      .eq('tenant_id', tenantId)
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

async function persistSyncCatalog(supabaseSvc, integ, settings, instanceId, groups, via, warning) {
  const groupChatIds = [];
  const syncedCatalog = [];
  const synced = [];

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
            description: 'manus_wa_sync',
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
      // Keep local rows discoverable as Manus-sourced for the permissions UI.
      await supabaseSvc
        .from('whatsapp_groups')
        .update({ description: 'manus_wa_sync', updated_at: new Date().toISOString() })
        .eq('id', rowId);
    }

    if (!rowId) continue;
    groupChatIds.push(g.id);
    const entry = { groupChatId: g.id, groupId: rowId, name: rowName || g.name };
    syncedCatalog.push(entry);
    synced.push({ integrationId: integ.id, ...entry });
  }

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
            error: `Gateway החזיר 0 קבוצות (via=${via}, instance=${instanceId})`,
          });
        }
        continue;
      }

      // Staging / mocked Manus has no WhatsApp tokens by design.
      // Fall back to the tenant's existing whatsapp_groups so permissions UI works.
      if (mocked || !canCallGateway) {
        const localGroups = await loadLocalGroupCatalog(supabaseSvc, integ.tenant_id);
        const warning = mocked
          ? 'Staging: חיבור Manus מדומה (בלי api_key) — נטענו קבוצות מהמערכת, לא מה-Gateway החי'
          : 'חסר api_key / WORKER_SECRET — נטענו קבוצות מהמערכת המקומית';
        const saved = await persistSyncCatalog(
          supabaseSvc,
          integ,
          settings,
          instanceId,
          localGroups,
          mocked ? 'staging_mocked_local_catalog' : 'local_catalog_fallback',
          warning,
        );
        synced.push(...saved);
        warnings.push(warning);
        if (!localGroups.length) {
          errors.push({
            integrationId: integ.id,
            error: 'אין קבוצות מקומיות לטעון, וגם אין גישה ל-Gateway',
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
      error: errors[0]?.error || 'סנכרון קבוצות נכשל — לא נשמרו קבוצות',
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
