import assert from 'node:assert/strict';
import test from 'node:test';

import {
  mergeCarmenScopeConfig,
  parsePolicyPhones,
  policyPhoneList,
  resolveDevEscalationTier,
  identityAllowsSurface,
  SURFACE_GROUP,
  SURFACE_PRIVATE,
} from './carmen-access-policy.mjs';

test('mergeCarmenScopeConfig: policy phones override automation', () => {
  const merged = mergeCarmenScopeConfig(
    { carmen_scope_mode: 'all', carmen_allowed_phones: ['111'] },
    { private_phones: [{ phone: '972507677613', surfaces: ['whatsapp_private'] }], require_direct_address: true },
    [],
  );
  assert.equal(merged.scopeMode, 'specific_phone');
  assert.deepEqual(merged.allowedPhones, ['972507677613']);
  assert.equal(merged.hasPolicy, true);
});

test('mergeCarmenScopeConfig: policy groups use resolved chat ids', () => {
  const merged = mergeCarmenScopeConfig(
    {},
    { allowed_group_ids: ['uuid-1'], open_member_groups: false },
    ['120363@g.us'],
  );
  assert.equal(merged.scopeMode, 'specific_group');
  assert.deepEqual(merged.allowedGroups, ['120363@g.us']);
});

test('identityAllowsSurface respects surfaces array', () => {
  assert.equal(identityAllowsSurface({ surfaces: [SURFACE_PRIVATE] }, SURFACE_GROUP), false);
  assert.equal(identityAllowsSurface({ surfaces: [SURFACE_PRIVATE, SURFACE_GROUP] }, SURFACE_GROUP), true);
});

test('resolveDevEscalationTier prefers DB tier over hardcode', () => {
  assert.equal(resolveDevEscalationTier({}, 'bugfix'), 'bugfix');
});

test('parsePolicyPhones normalizes entries', () => {
  const rows = parsePolicyPhones([{ phone: '0507677613', dev_escalation_tier: 'full' }]);
  assert.equal(rows[0].phone, '0507677613');
  assert.equal(policyPhoneList(rows)[0], '0507677613');
});
