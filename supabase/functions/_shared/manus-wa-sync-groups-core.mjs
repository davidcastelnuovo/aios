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

/**
 * Try admin path first (worker secret), then instance API key.
 * Paths match manage-manus-wa / docs: /api/admin/... and /api/v1/...
 */
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

  let lastErr = null;
  for (const attempt of attempts) {
    try {
      const { groups, lastRawCount } = await attempt.run();
      if (groups.length > 0) {
        return { groups, via: attempt.via };
      }
      // Empty after successful HTTP — keep trying other auth paths in case this
      // path is authorized but returns an empty/partial payload.
      if (lastRawCount === 0 || lastRawCount === null) {
        lastErr = new Error(`${attempt.via}: gateway returned 0 groups`);
        continue;
      }
      return { groups, via: attempt.via };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      console.warn('[manus-wa-sync-groups] attempt failed', attempt.via, lastErr.message);
    }
  }
  throw lastErr || new Error('סנכרון קבוצות מ-Gateway נכשל');
}

export async function syncManusGroupsForTenant(supabaseSvc, integrations) {
  const synced = [];
  const errors = [];

  for (const integ of integrations) {
    const settings = integ.settings || {};
    const instanceId = resolveInstanceId(integ);
    const apiKey = integ.api_key || '';
    if (!instanceId || !apiKey) {
      errors.push({
        integrationId: integ.id,
        error: `חסר instance_id או api_key בחיבור Manus (instance=${instanceId ? 'ok' : 'missing'}, key=${apiKey ? 'ok' : 'missing'})`,
      });
      continue;
    }

    try {
      const { groups, via } = await fetchGroupsFromGateway(instanceId, apiKey);
      const groupChatIds = [];
      const syncedCatalog = [];

      for (const g of groups) {
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
        if (row?.id) {
          groupChatIds.push(g.id);
          const entry = {
            groupChatId: g.id,
            groupId: row.id,
            name: row.group_name || g.name,
          };
          syncedCatalog.push(entry);
          synced.push({ integrationId: integ.id, ...entry });
        }
      }

      const mergedSettings = {
        ...settings,
        instance_id: instanceId,
        manus_groups_sync: {
          synced_at: new Date().toISOString(),
          group_chat_ids: groupChatIds,
          groups: syncedCatalog,
          count: groupChatIds.length,
          via,
          gateway: BASE_URL,
        },
      };
      const { error: settingsErr } = await supabaseSvc
        .from('tenant_integrations')
        .update({ settings: mergedSettings })
        .eq('id', integ.id);
      if (settingsErr) throw settingsErr;

      if (groups.length === 0) {
        errors.push({
          integrationId: integ.id,
          error: `Gateway החזיר 0 קבוצות (via=${via}, instance=${instanceId}). ודא שכרמן מחוברת וש-list-groups פעיל ב-Gateway.`,
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
      error: errors[0]?.error || 'סנכרון קבוצות נכשל — לא נשמרו קבוצות',
      errors,
    };
  }

  const uniqueGroups = [...new Map(synced.map((g) => [g.groupId, g])).values()];
  return {
    success: true,
    syncedCount: uniqueGroups.length,
    groups: uniqueGroups,
    errors: errors.length ? errors : undefined,
  };
}
