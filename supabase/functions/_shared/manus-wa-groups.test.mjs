import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManusGroupsPayload } from './manus-wa-groups.mjs';

test('normalizeManusGroupsPayload: standard groups array', () => {
  const out = normalizeManusGroupsPayload({
    groups: [
      { id: '120363@g.us', name: 'Ops', participantsCount: 5 },
    ],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '120363@g.us');
  assert.equal(out[0].name, 'Ops');
});

test('normalizeManusGroupsPayload: nested data.groups', () => {
  const out = normalizeManusGroupsPayload({
    data: { groups: [{ jid: '99@g.us', subject: 'Client' }] },
  });
  assert.equal(out[0].id, '99@g.us');
  assert.equal(out[0].name, 'Client');
});

test('normalizeManusGroupsPayload: filters non-group ids', () => {
  const out = normalizeManusGroupsPayload({
    groups: [{ id: '972501234567@c.us', name: 'private' }, { id: '1@g.us', name: 'g' }],
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '1@g.us');
});
