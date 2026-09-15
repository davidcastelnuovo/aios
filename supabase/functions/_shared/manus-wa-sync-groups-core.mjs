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
    throw new Error('Gateway החזיר תשובה לא תקינה (HTML במקום JSON) — בדוק instance_id ו-api_key');
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
    throw new Error(`Gateway groups failed: ${res.status} — ${text.slice(0, 300)}`);
  }
  const data = parseGatewayJson(text);
  return {
    groups: normalizeManusGroupsPayload(data),
    nextCursor: extractNextCursor(data),
  };
}

async function fetchAllGroupsFromGateway(buildUrl, headers) {
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

/** Fetch Carmen instance groups. Prefer admin worker secret when configured. */
export async function fetchGroupsFromGateway(instanceId, apiKey) {
  if (WORKER_SECRET) {
    try {
      const groups = await fetchAllGroupsFromGateway(
        (cursor) => {
          const url = new URL(`${BASE_URL}/api/admin/instances/${instanceId}/groups`);
          if (cursor) url.searchParams.set('cursor', cursor);
          return url.toString();
        },
        { 'X-Worker-Secret': WORKER_SECRET },
      );
      if (groups.length > 0) return { groups, via: 'admin_worker_secret' };
    } catch (adminErr) {
      console.warn('[manus-wa-sync-groups] admin groups failed, trying instance api key', adminErr);
    }
  }

  const groups = await fetchAllGroupsFromGateway(
    (cursor) => {
      const url = new URL(`${BASE_URL}/api/v1/instances/${instanceId}/groups`);
      if (cursor) url.searchParams.set('cursor', cursor);
      return url.toString();
    },
    { 'X-Api-Key': apiKey },
  );
  return { groups, via: 'instance_api_key' };
}

export async function syncManusGroupsForTenant(supabaseSvc, integrations) {
  const synced = [];
  const errors = [];

  for (const integ of integrations) {
    const settings = integ.settings || {};
    const instanceId = String(settings.instance_id || '');
    const apiKey = integ.api_key || '';
    if (!instanceId || !apiKey) {
      errors.push({ integrationId: integ.id, error: 'חסר instance_id או api_key בחיבור Manus' });
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
        manus_groups_sync: {
          synced_at: new Date().toISOString(),
          group_chat_ids: groupChatIds,
          groups: syncedCatalog,
          count: groupChatIds.length,
          via,
        },
      };
      await supabaseSvc
        .from('tenant_integrations')
        .update({ settings: mergedSettings })
        .eq('id', integ.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[manus-wa-sync-groups] integration failed', integ.id, msg);
      errors.push({ integrationId: integ.id, error: msg });
    }
  }

  if (!synced.length && errors.length) {
    return {
      success: false,
      error: errors[0]?.error || 'סנכרון קבוצות נכשל',
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
