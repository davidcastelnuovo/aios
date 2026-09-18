import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const carmen = readFileSync(new URL('./carmen.ts', import.meta.url), 'utf8');
const agent = readFileSync(new URL('../run-ai-agent/index.ts', import.meta.url), 'utf8');

test('private chats use session_only — never phone-scan chat_messages for background', () => {
  assert.match(carmen, /export function backgroundChatContextMode\(isGroup/);
  assert.match(carmen, /session_only/);
  assert.match(carmen, /skip private background history — session chat_id only/);
  // Private branch must not ilike sender_phone inside fetchRecentChatContext.
  const fnStart = carmen.indexOf('export async function fetchRecentChatContext');
  const fnEnd = carmen.indexOf('export function excludeCurrentTurnFromContext');
  const fn = carmen.slice(fnStart, fnEnd);
  assert.doesNotMatch(fn, /ilike\('sender_phone'/);
  assert.match(fn, /group_id/);
});

test('isolation note is injected on Carmen turns', () => {
  assert.match(carmen, /\[בידוד שיחה\] chat_id=/);
});

test('search_conversation_history defaults to current wa_notify chat_id', () => {
  assert.match(agent, /browse_all_chats/);
  assert.match(agent, /scopeGroupId/);
  assert.match(agent, /current_chat/);
});
