import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractRepairCommand } from './extract-repair-command.ts';

test('finds the repair command printed by supabase db push, ignoring log timestamps', () => {
  const log = [
    '2026-08-17T14:16:05.3705761Z Remote migration versions not found in local migrations directory.',
    '2026-08-17T14:16:05.3705762Z supabase migration repair --status reverted 20260101000000 20260102000000',
  ].join('\n');
  assert.equal(extractRepairCommand(log), 'supabase migration repair --status reverted 20260101000000 20260102000000');
});

test('returns null when the log has no repair command', () => {
  assert.equal(extractRepairCommand('connection timeout'), null);
});
