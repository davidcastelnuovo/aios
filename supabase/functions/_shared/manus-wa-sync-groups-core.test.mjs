import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = readFileSync(new URL('./manus-wa-sync-groups-core.mjs', import.meta.url), 'utf8');

test('manus sync core never loads full whatsapp_groups without provider filter', () => {
  assert.match(core, /provider.*manus_wa|eq\('provider', 'manus_wa'\)/);
  assert.doesNotMatch(core, /loadLocalGroupCatalog/);
  assert.match(core, /staging_manus_traffic_only|manus_traffic_fallback/);
  assert.match(core, /Never scan the full whatsapp_groups|NEVER mix with Green API/i);
});

test('manus sync uses exact /api/v1/instances/{id}/groups + X-Api-Key', () => {
  assert.match(core, /\/api\/v1\/instances\/\$\{instanceId\}\/groups/);
  assert.match(core, /'X-Api-Key': apiKey/);
  assert.match(core, /Without a valid key → 401 JSON|HTML SPA/);
  assert.match(core, /preserve|tagged|manus_wa_sync/i);
});
