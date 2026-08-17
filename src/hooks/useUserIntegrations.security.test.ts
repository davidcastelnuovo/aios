import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getClientIntegrationSelect,
  toClientIntegration,
} from '../lib/tenantIntegrationsClient.ts';

const GOOGLE_TYPES = ['google_ads', 'google_analytics', 'google_search_console'] as const;

function assertNoSecrets(payload: unknown, label: string) {
  const json = JSON.stringify(payload);
  assert.ok(!json.includes('ya29.'), `${label}: access token leaked`);
  assert.ok(!json.includes('1//secret'), `${label}: refresh token leaked`);
  assert.ok(!json.includes('"api_key"'), `${label}: api_key field leaked`);
  assert.ok(!json.includes('refresh_token'), `${label}: refresh_token field leaked`);
}

for (const integrationType of GOOGLE_TYPES) {
  test(`useUserIntegrations pipeline strips secrets for ${integrationType}`, () => {
    const select = getClientIntegrationSelect(integrationType);
    assert.ok(!select.includes('api_key'), `${integrationType} select must omit api_key`);

    const dbRow = {
      id: `int-${integrationType}`,
      tenant_id: 'tenant-arba',
      user_id: 'user-owner',
      integration_type: integrationType,
      is_active: true,
      api_key: 'ya29.super-secret-access-token',
      settings: {
        refresh_token: '1//secret-refresh-token',
        google_email: 'ads@arba.co.il',
        connected_at: '2026-01-15T10:00:00Z',
        needs_reauth: false,
        client_sites: { 'client-1': 'https://example.com/' },
        available_sites: [{ siteUrl: 'https://example.com/', permissionLevel: 'siteOwner' }],
      },
      display_name: null,
      connection_visibility: null,
      shared_from_integration_id: null,
      auto_sync_enabled: true,
      last_sync_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
      instance_id: null,
      company_id: null,
      api_token_last_4: null,
    };

  // Mirrors useUserIntegrations tenant-scoped mapping.
    const clientRows = [
      toClientIntegration(dbRow, { _isOwn: true, _sharedByName: null }),
      toClientIntegration(
        { ...dbRow, id: `shared-${integrationType}`, user_id: 'other-user' },
        { _isOwn: false, _sharedByName: 'David' },
      ),
    ];

    assert.equal(clientRows[0].has_credential, true);
    assert.equal(clientRows[0]._isOwn, true);
    assert.equal((clientRows[0].settings as Record<string, unknown>)?.google_email, 'ads@arba.co.il');
    assertNoSecrets(clientRows, integrationType);
  });
}

test('facebook integrations still expose api_key for legacy frontend flows', () => {
  const select = getClientIntegrationSelect('facebook_lead_ads');
  assert.ok(select.includes('api_key'));

  const client = toClientIntegration({
    id: 'fb-1',
    tenant_id: 'tenant-1',
    integration_type: 'facebook_lead_ads',
    is_active: true,
    api_key: 'EAAB-legacy-page-token',
    settings: { page_name: 'Demo Page' },
  });

  assert.equal((client as { api_key?: string }).api_key, 'EAAB-legacy-page-token');
  assert.equal(client.has_credential, true);
});
