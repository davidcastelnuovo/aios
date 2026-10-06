import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeObservedPhone,
  pickCandidateStatus,
} from './carmen-observe-group-member.mjs';

test('normalizeObservedPhone drops group JID digits', () => {
  assert.equal(
    normalizeObservedPhone('120363420913931305', '120363420913931305@g.us'),
    null,
  );
});

test('normalizeObservedPhone keeps real mobile', () => {
  assert.equal(
    normalizeObservedPhone('972546656303@c.us', '120363420913931305@g.us'),
    '972546656303',
  );
});

test('pickCandidateStatus links known staff', () => {
  assert.equal(pickCandidateStatus({
    phone: '972546656303',
    matchedIdentity: { id: '1' },
    matchedCampaigner: null,
  }), 'approved');
  assert.equal(pickCandidateStatus({
    phone: '972599999999',
    matchedIdentity: null,
    matchedCampaigner: null,
  }), 'awaiting_approval');
  assert.equal(pickCandidateStatus({
    phone: null,
    matchedIdentity: null,
    matchedCampaigner: null,
  }), 'awaiting_identity');
});
