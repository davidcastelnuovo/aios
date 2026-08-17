/**
 * Client-safe helpers for tenant_integrations rows.
 *
 * Google OAuth integrations store access tokens in `api_key` and refresh tokens
 * in `settings.refresh_token`. Those must never reach the browser — only edge
 * functions (service role) should read them.
 *
 * Other integration types (Facebook, Green API, etc.) may still need `api_key`
 * on the frontend until those flows are migrated to edge functions.
 */

export const GOOGLE_INTEGRATION_TYPES = new Set([
  'google_analytics',
  'google_search_console',
  'google_ads',
]);

const SENSITIVE_SETTINGS_KEYS = [
  'refresh_token',
  'access_token',
  'api_token',
  'api_key',
  'token',
] as const;

/** Columns safe to fetch for Google integrations (no api_key). */
export const CLIENT_INTEGRATION_COLUMNS =
  'id, tenant_id, user_id, integration_type, is_active, settings, display_name, connection_visibility, shared_from_integration_id, auto_sync_enabled, last_sync_at, created_at, updated_at, instance_id, company_id, api_token_last_4';

export const CLIENT_INTEGRATION_COLUMNS_WITH_API_KEY =
  `${CLIENT_INTEGRATION_COLUMNS}, api_key`;

export type TenantIntegrationRow = {
  id: string;
  tenant_id: string;
  user_id?: string | null;
  integration_type: string;
  is_active?: boolean | null;
  api_key?: string | null;
  settings?: Record<string, unknown> | null;
  display_name?: string | null;
  connection_visibility?: string | null;
  shared_from_integration_id?: string | null;
  auto_sync_enabled?: boolean | null;
  last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
  instance_id?: string | null;
  company_id?: string | null;
  api_token_last_4?: string | null;
  [key: string]: unknown;
};

export type ClientIntegration = Omit<TenantIntegrationRow, 'api_key'> & {
  has_credential: boolean;
  api_key?: undefined;
  _isOwn?: boolean;
  _sharedByName?: string | null;
};

export function getClientIntegrationSelect(integrationType: string): string {
  return GOOGLE_INTEGRATION_TYPES.has(integrationType)
    ? CLIENT_INTEGRATION_COLUMNS
    : CLIENT_INTEGRATION_COLUMNS_WITH_API_KEY;
}

export function integrationHasCredential(row: TenantIntegrationRow): boolean {
  const settings =
    row.settings && typeof row.settings === 'object' ? row.settings : null;

  if (GOOGLE_INTEGRATION_TYPES.has(row.integration_type)) {
    return !!(
      row.api_key ||
      settings?.refresh_token ||
      settings?.google_email ||
      settings?.connected_at
    );
  }

  return !!row.api_key;
}

export function sanitizeIntegrationSettings(
  settings: Record<string, unknown> | null | undefined,
  integrationType: string,
): Record<string, unknown> | null {
  if (!settings || typeof settings !== 'object') return settings ?? null;
  if (!GOOGLE_INTEGRATION_TYPES.has(integrationType)) return settings;

  const sanitized = { ...settings };
  for (const key of SENSITIVE_SETTINGS_KEYS) {
    delete sanitized[key];
  }
  return sanitized;
}

export function toClientIntegration<T extends TenantIntegrationRow>(
  row: T,
  extras?: { _isOwn?: boolean; _sharedByName?: string | null },
): ClientIntegration {
  const has_credential = integrationHasCredential(row);
  const isGoogle = GOOGLE_INTEGRATION_TYPES.has(row.integration_type);

  const { api_key: _discardedApiKey, ...rest } = row;
  const result: ClientIntegration = {
    ...rest,
    has_credential,
    settings: sanitizeIntegrationSettings(
      row.settings as Record<string, unknown> | null | undefined,
      row.integration_type,
    ),
    ...(extras || {}),
  };

  if (!isGoogle && row.api_key != null) {
    (result as TenantIntegrationRow).api_key = row.api_key;
  }

  return result;
}

export function isGoogleIntegrationConnected(
  integration: { is_active?: boolean | null; has_credential?: boolean } | null | undefined,
): boolean {
  return !!(integration?.is_active && integration?.has_credential);
}
