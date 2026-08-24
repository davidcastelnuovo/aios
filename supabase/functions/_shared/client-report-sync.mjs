/**
 * Keep client card connection fields in sync with assigned crm_tables report rows.
 * Mirrors src/config/clientChannels.ts mapping — tables are source of truth when assigned.
 */

/** @typedef {{ clientField: string, settingsKeys: string[], normalize: (raw: string) => string }} ReportTableMapping */

/** @type {Record<string, ReportTableMapping>} */
export const REPORT_TABLE_CLIENT_FIELD_MAP = Object.freeze({
  google_ads: {
    clientField: 'google_ads_account_id',
    settingsKeys: ['customer_id', 'account_id'],
    normalize: (raw) => String(raw).replace(/-/g, '').trim(),
  },
  facebook_insights: {
    clientField: 'meta_ads_account_id',
    settingsKeys: ['ad_account_id', 'account_id', 'meta_account_id'],
    normalize: normalizeMetaAdAccountId,
  },
  facebook_ecommerce: {
    clientField: 'meta_ads_account_id',
    settingsKeys: ['ad_account_id', 'account_id', 'meta_account_id'],
    normalize: normalizeMetaAdAccountId,
  },
  google_analytics: {
    clientField: 'ga_property_id',
    settingsKeys: ['property_id', 'ga_property_id'],
    normalize: (raw) => String(raw).trim(),
  },
  ahrefs: {
    clientField: 'ahrefs_domain',
    settingsKeys: ['targetDomain', 'domain', 'target_domain'],
    normalize: (raw) => String(raw).trim(),
  },
  google_search_console: {
    clientField: 'gsc_site_url',
    settingsKeys: ['site_url', 'gsc_site_url'],
    normalize: (raw) => String(raw).trim(),
  },
});

export function normalizeGoogleCustomerId(raw) {
  if (raw == null || raw === '') return null;
  const cleaned = String(raw).replace(/-/g, '').trim();
  return /^\d+$/.test(cleaned) ? cleaned : null;
}

export function normalizeMetaAdAccountId(raw) {
  if (raw == null || raw === '') return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/^act_/i, '');
  if (!/^\d+$/.test(digits)) return trimmed;
  return `act_${digits}`;
}

/**
 * @param {string|null|undefined} integrationType
 * @param {Record<string, unknown>|null|undefined} settings
 */
export function extractAccountIdFromReportTable(integrationType, settings) {
  const mapping = integrationType ? REPORT_TABLE_CLIENT_FIELD_MAP[integrationType] : null;
  if (!mapping) return null;
  const s = settings && typeof settings === 'object' ? settings : {};
  for (const key of mapping.settingsKeys) {
    const raw = s[key];
    if (raw == null || raw === '') continue;
    const normalized = mapping.normalize(String(raw));
    if (normalized) return normalized;
  }
  return null;
}

/**
 * @param {string|null|undefined} integrationType
 * @param {Record<string, unknown>|null|undefined} settings
 * @param {{ clientId?: string|null, tableId?: string|null }} ctx
 */
export function validateReportTableAccountId(integrationType, settings, ctx = {}) {
  const mapping = integrationType ? REPORT_TABLE_CLIENT_FIELD_MAP[integrationType] : null;
  if (!mapping) {
    return { ok: true, skipped: true, reason: 'unsupported_integration_type' };
  }
  const accountId = extractAccountIdFromReportTable(integrationType, settings);
  if (accountId) {
    return { ok: true, field: mapping.clientField, accountId };
  }
  return {
    ok: false,
    field: mapping.clientField,
    reason: 'missing_account_id',
    clientId: ctx.clientId ?? null,
    tableId: ctx.tableId ?? null,
    integrationType,
    expectedSettingsKeys: mapping.settingsKeys,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id?: string, client_id?: string|null, integration_type?: string|null, integration_settings?: Record<string, unknown>|null }} tableRow
 * @param {{ logPrefix?: string }} [opts]
 */
export async function syncClientCardFromReportTable(supabase, tableRow, opts = {}) {
  const logPrefix = opts.logPrefix || '[client-report-sync]';
  const { client_id: clientId, integration_type: integrationType, integration_settings: settings, id: tableId } = tableRow;

  if (!clientId || !integrationType) {
    return { skipped: true, reason: 'no_client_or_type' };
  }

  const mapping = REPORT_TABLE_CLIENT_FIELD_MAP[integrationType];
  if (!mapping) {
    return { skipped: true, reason: 'unsupported_integration_type', integrationType };
  }

  const validation = validateReportTableAccountId(integrationType, settings, { clientId, tableId });
  if (!validation.ok) {
    console.warn(`${logPrefix} assigned report table missing account id`, validation);
    return { skipped: true, reason: 'missing_account_id', validation };
  }

  const accountId = validation.accountId;
  const { data: client, error: fetchErr } = await supabase
    .from('clients')
    .select(`id, name, ${mapping.clientField}`)
    .eq('id', clientId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!client) {
    return { skipped: true, reason: 'client_not_found', clientId };
  }

  const current = client[mapping.clientField];
  if (current === accountId) {
    return { synced: false, reason: 'already_set', field: mapping.clientField, value: accountId, clientId };
  }

  const { error: updateErr } = await supabase
    .from('clients')
    .update({ [mapping.clientField]: accountId })
    .eq('id', clientId);
  if (updateErr) throw updateErr;

  console.log(`${logPrefix} updated client card from report table`, {
    tableId: tableId ?? null,
    clientId,
    clientName: client.name ?? null,
    integrationType,
    field: mapping.clientField,
    previous: current ?? null,
    value: accountId,
  });

  return {
    synced: true,
    field: mapping.clientField,
    value: accountId,
    previous: current ?? null,
    clientId,
    tableId: tableId ?? null,
  };
}

/**
 * Resolve Google Ads customer_id: assigned google_ads crm_table first, then clients.google_ads_account_id.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} clientId
 */
export async function googleResolveClientCustomerId(supabase, clientId) {
  const { data: tables } = await supabase
    .from('crm_tables')
    .select('integration_settings, last_sync_at')
    .eq('client_id', clientId)
    .eq('integration_type', 'google_ads')
    .order('last_sync_at', { ascending: false, nullsFirst: false });

  for (const t of tables || []) {
    const id = extractAccountIdFromReportTable('google_ads', t.integration_settings);
    if (id) return id;
  }

  const { data: cl } = await supabase
    .from('clients')
    .select('google_ads_account_id')
    .eq('id', clientId)
    .maybeSingle();
  if (cl?.google_ads_account_id) {
    return normalizeGoogleCustomerId(cl.google_ads_account_id);
  }
  return null;
}

/**
 * Build customer_id → client map from both client card fields and assigned google_ads tables.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} tenantIds
 */
export async function buildGoogleCustomerClientMap(supabase, tenantIds) {
  /** @type {Map<string, { id: string, name: string }>} */
  const map = new Map();

  const { data: linkedClients } = await supabase
    .from('clients')
    .select('id, name, google_ads_account_id')
    .in('tenant_id', tenantIds)
    .not('google_ads_account_id', 'is', null);

  for (const c of linkedClients || []) {
    const cid = normalizeGoogleCustomerId(c.google_ads_account_id);
    if (cid) map.set(cid, { id: c.id, name: c.name });
  }

  const { data: gTables } = await supabase
    .from('crm_tables')
    .select('client_id, integration_settings')
    .eq('integration_type', 'google_ads')
    .not('client_id', 'is', null);

  const tableClientIds = [...new Set((gTables || []).map((t) => t.client_id).filter(Boolean))];
  if (tableClientIds.length === 0) return map;

  const { data: tableClients } = await supabase
    .from('clients')
    .select('id, name, tenant_id')
    .in('id', tableClientIds)
    .in('tenant_id', tenantIds);

  const clientById = new Map((tableClients || []).map((c) => [c.id, c]));

  for (const t of gTables || []) {
    const customerId = extractAccountIdFromReportTable('google_ads', t.integration_settings);
    if (!customerId || map.has(customerId)) continue;
    const client = clientById.get(t.client_id);
    if (client?.id) map.set(customerId, { id: client.id, name: client.name });
  }

  return map;
}
