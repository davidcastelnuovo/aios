import assert from 'node:assert/strict';
import test from 'node:test';
import { isQueryResolving, shouldShowQueryError } from './queryUi.ts';

test('background refetch is "resolving" but must not drive full-page blank alone', () => {
  // isFetching=true with cached data is normal — UI should keep showing data.
  assert.equal(isQueryResolving(false, false, true), true);
  // First load (pending, no data yet) is the only case that should blank the page.
  assert.equal(isQueryResolving(true, true, true), true);
  assert.equal(isQueryResolving(false, false, false), false);
});

test('shouldShowQueryError hides errors while a fetch is in flight', () => {
  assert.equal(shouldShowQueryError(true, true, false, false), false);
  assert.equal(shouldShowQueryError(true, false, false, false), true);
  assert.equal(shouldShowQueryError(false, false, false, false), false);
});

test('shouldShowQueryError hides cached errors until this observer has fetched', () => {
  assert.equal(shouldShowQueryError(true, false, false, false, false), false);
  assert.equal(shouldShowQueryError(true, false, false, false, true), true);
});
