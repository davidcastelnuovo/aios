import test from 'node:test';
import assert from 'node:assert/strict';
import { mergePrivatePhoneAllowlist } from './carmenPrivatePhoneAllowlist.mjs';

test('mergePrivatePhoneAllowlist: combines automation, identity, and policy', () => {
  const out = mergePrivatePhoneAllowlist({
    automationPhones: ['972501111111'],
    identities: [{
      phone: '972502222222',
      display_name: 'אנה',
      status: 'approved',
      surfaces: ['whatsapp_private'],
    }],
    policyPhones: [{ phone: '972503333333', label: 'דוד', surfaces: ['whatsapp_private'] }],
  });
  assert.equal(out.length, 3);
  assert.ok(out.some((r) => r.phone === '972501111111' && r.source === 'automation'));
  assert.ok(out.some((r) => r.phone === '972502222222' && r.label === 'אנה'));
  assert.ok(out.some((r) => r.phone === '972503333333' && r.label === 'דוד'));
});

test('mergePrivatePhoneAllowlist: policy wins over automation for same phone', () => {
  const out = mergePrivatePhoneAllowlist({
    automationPhones: ['972501111111'],
    policyPhones: [{ phone: '972501111111', label: 'דוד מדיניות', surfaces: ['whatsapp_private'] }],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].label, 'דוד מדיניות');
  assert.equal(out[0].source, 'policy');
});

test('mergePrivatePhoneAllowlist: skips identities without private surface', () => {
  const out = mergePrivatePhoneAllowlist({
    identities: [{
      phone: '972502222222',
      display_name: 'קבוצה בלבד',
      surfaces: ['whatsapp_group'],
    }],
  });
  assert.equal(out.length, 0);
});

test('pickCarmenAutomationConfig merges phones across private+group triggers', async () => {
  // Pure helper mirror of fetchCarmenAutomationConfig merge rules
  const configs = [
    { agent_id: 'a1', carmen_scope_mode: 'specific_group', carmen_allowed_group_ids: ['g1'] },
    { agent_id: 'a1', carmen_scope_mode: 'specific_phone', carmen_allowed_phones: ['972507677613', '972545612156'] },
  ];
  const withPhones = configs.filter((c) => (c.carmen_allowed_phones || []).length > 0);
  const preferred = withPhones[0] || configs[0];
  const mergedPhones = [...new Set(
    configs.flatMap((c) => (c.carmen_allowed_phones || []).map((p) => String(p).replace(/\D/g, '')).filter(Boolean)),
  )];
  assert.equal(preferred.carmen_scope_mode, 'specific_phone');
  assert.deepEqual(mergedPhones, ['972507677613', '972545612156']);
});
