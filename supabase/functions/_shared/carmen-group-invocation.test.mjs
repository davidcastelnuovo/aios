import assert from 'node:assert/strict';
import test from 'node:test';

import { groupMessageInvokesCarmen } from './carmen.ts';

test('requires Carmen in every group message', () => {
  assert.equal(groupMessageInvokesCarmen('קארמן, תבדקי את הדוח'), true);
  assert.equal(groupMessageInvokesCarmen('כרמן מה מצב הקמפיין?'), true);
  assert.equal(groupMessageInvokesCarmen('קרמן תעני בבקשה'), true);
  assert.equal(groupMessageInvokesCarmen('מה מצב הקמפיין?'), false);
});

test('does not accept a partial-word match', () => {
  assert.equal(groupMessageInvokesCarmen('הכרמנית החדשה נראית טוב'), false);
  assert.equal(groupMessageInvokesCarmen('דיברנו על הקמפיין'), false);
});

test('accepts voice transcript prefix', () => {
  assert.equal(groupMessageInvokesCarmen('🎤 קארמן מה נשמע?'), true);
});
