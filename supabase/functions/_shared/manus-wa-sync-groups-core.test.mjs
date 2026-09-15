import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeManusGroupsPayload } from './manus-wa-groups.mjs';

test('normalizeManusGroupsPayload keeps member groups without explicit isMember', () => {
  const out = normalizeManusGroupsPayload({
    groups: [
      { id: '120363423897814166@g.us', name: 'PPC - DMM', participantsCount: 7 },
      { id: '120363351341871673@g.us', name: 'PPC פרומו', participantsCount: 8 },
    ],
  });
  assert.equal(out.length, 2);
});
