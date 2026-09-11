import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildGroupSenderContextNote,
  managerGroupAccessViaAllowedPhones,
  phonesMatch,
  resolveGroupParticipantPhone,
} from './carmen-group-sender.mjs';

const GROUP = '120363425732219862@g.us';
const GROUP_DIGITS = '120363425732219862';
const DAVID = '972507677613';
const ANA = '972545612156';

test('resolveGroupParticipantPhone rejects group JID as sender', () => {
  assert.equal(
    resolveGroupParticipantPhone({
      groupChatId: GROUP,
      phoneNumber: GROUP_DIGITS,
      sourcePhoneNumber: null,
      senderWid: null,
      selfWid: null,
      isOutgoing: false,
    }),
    null,
  );
});

test('resolveGroupParticipantPhone returns participant from sender wid', () => {
  assert.equal(
    resolveGroupParticipantPhone({
      groupChatId: GROUP,
      phoneNumber: GROUP_DIGITS,
      sourcePhoneNumber: null,
      senderWid: `${DAVID}@c.us`,
      selfWid: '972549696673@c.us',
      isOutgoing: false,
    }),
    DAVID,
  );
});

test('resolveGroupParticipantPhone prefers sourcePhoneNumber when wid missing', () => {
  assert.equal(
    resolveGroupParticipantPhone({
      groupChatId: GROUP,
      phoneNumber: GROUP_DIGITS,
      sourcePhoneNumber: ANA,
      senderWid: null,
      selfWid: null,
      isOutgoing: false,
    }),
    ANA,
  );
});

test('buildGroupSenderContextNote includes participant_phone', () => {
  const note = buildGroupSenderContextNote(DAVID, 'דוד');
  assert.match(note, /participant_phone=972507677613/);
  assert.match(note, /sender_name=דוד/);
  assert.match(note, /group_id/);
});

test('managerGroupAccessViaAllowedPhones: David yes, Ana no', () => {
  const allowed = [DAVID, ANA];
  assert.equal(
    managerGroupAccessViaAllowedPhones({
      phoneDigits: DAVID,
      allowedPhones: allowed,
      isManager: true,
    }),
    true,
  );
  assert.equal(
    managerGroupAccessViaAllowedPhones({
      phoneDigits: ANA,
      allowedPhones: allowed,
      isManager: false,
    }),
    false,
  );
  assert.equal(
    managerGroupAccessViaAllowedPhones({
      phoneDigits: ANA,
      allowedPhones: allowed,
      isManager: true,
    }),
    true,
  );
});

test('phonesMatch uses last-9 policy', () => {
  assert.equal(phonesMatch('0507677613', DAVID), true);
  assert.equal(phonesMatch(DAVID, '972507677613'), true);
});

test('green-api group insert stores participant phone not group id', () => {
  const source = readFileSync(
    new URL('../green-api-webhook/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /resolveGroupParticipantPhone/);
  assert.match(source, /sender_phone: participantPhone/);
  assert.match(source, /sender_phone: statusParticipantPhone/);
});

test('manus group path persists chat_messages with authorPhone', () => {
  const source = readFileSync(
    new URL('../manus-wa-webhook/index.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /\[manus-wa group\] chat_messages saved/);
  assert.match(source, /sender_phone: authorPhone/);
});

test('carmen group identity runs on all channels', () => {
  const source = readFileSync(
    new URL('./carmen.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /if \(isGroup\) \{[\s\S]*resolveCarmenGroupIdentity/);
  assert.doesNotMatch(source, /if \(isGroup && sourceChannel === 'own_instance'\)/);
});
