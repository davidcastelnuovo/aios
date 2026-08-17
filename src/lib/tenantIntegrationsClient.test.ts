import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getClientIntegrationSelect,
  integrationHasCredential,
  isGoogleIntegrationConnected,
  sanitizeIntegrationSettings,
  toClientIntegration,
} from './tenantIntegrationsClient.ts';

test('getClientIntegrationSelect omits api_key for Google types', () => {
  assert.ok(!getClientIntegrationSelect('google_ads').includes('api_key'));
  assert.ok(getClientIntegrationSelect('facebook_lead_ads').includes('api_key'));
});

test('sanitizeIntegrationSettings strips OAuth secrets for Google', () => {
  const sanitized = sanitizeIntegrationSettings(
    {
      google_email: 'ads@example.com',
      refresh_token: 'secret-refresh',
      access_token: 'secret-access',
      connected_at: '2026-01-01T00:00:00Z',
    },
    'google_ads',
  );

  assert.equal(sanitized?.google_email, 'ads@example.com');
  assert.equal(sanitized?.refresh_token, undefined);
  assert.equal(sanitized?.access_token, undefined);
});

test('sanitizeIntegrationSettings leaves non-Google settings intact', () => {
  const settings = { page_name: 'My Page', api_token: 'make-token' };
  assert.deepEqual(sanitizeIntegrationSettings(settings, 'make_api'), settings);
});

test('toClientIntegration removes api_key for Google and keeps has_credential', () => {
  const client = toClientIntegration({
    id: 'int-1',
    tenant_id: 'tenant-1',
    integration_type: 'google_analytics',
    is_active: true,
    api_key: 'ya29.secret-access-token',
    settings: {
      refresh_token: '1//secret-refresh',
      google_email: 'ga@example.com',
    },
  });

  assert.equal(client.has_credential, true);
  assert.equal(client.api_key, undefined);
  assert.equal((client.settings as Record<string, unknown>)?.refresh_token, undefined);
  assert.equal((client.settings as Record<string, unknown>)?.google_email, 'ga@example.com');
});

test('toClientIntegration keeps api_key for Facebook integrations', () => {
  const client = toClientIntegration({
    id: 'fb-1',
    tenant_id: 'tenant-1',
    integration_type: 'facebook_lead_ads',
    is_active: true,
    api_key: 'EAAB-page-token',
    settings: { page_name: 'Demo Page' },
  });

  assert.equal(client.has_credential, true);
  assert.equal((client as { api_key?: string }).api_key, 'EAAB-page-token');
});

test('integrationHasCredential is false when Google row has no tokens or email', () => {
  assert.equal(
    integrationHasCredential({
      id: 'x',
      tenant_id: 't',
      integration_type: 'google_ads',
      is_active: true,
      settings: {},
    }),
    false,
  );
});

test('isGoogleIntegrationConnected requires active + credential', () => {
  assert.equal(isGoogleIntegrationConnected({ is_active: true, has_credential: true }), true);
  assert.equal(isGoogleIntegrationConnected({ is_active: true, has_credential: false }), false);
  assert.equal(isGoogleIntegrationConnected({ is_active: false, has_credential: true }), false);
});
