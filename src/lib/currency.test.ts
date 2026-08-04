import assert from 'node:assert/strict';
import test from 'node:test';
import { formatCurrency, formatUnitCost } from './currency.ts';

test('formatCurrency defaults to whole units (spend / totals)', () => {
  assert.match(formatCurrency(566.4, 'USD'), /566/);
  assert.doesNotMatch(formatCurrency(566.4, 'USD'), /566\.4/);
});

test('formatUnitCost keeps cents so CPC does not collapse to $0', () => {
  // $566 spend / 1.9K clicks ≈ $0.30 — whole-unit formatting showed "$0".
  const cpc = 566 / 1900;
  assert.match(formatUnitCost(cpc, 'USD'), /0\.30/);
  assert.doesNotMatch(formatCurrency(cpc, 'USD'), /0\.30/);
});

test('formatUnitCost still formats larger unit costs with two decimals', () => {
  assert.match(formatUnitCost(1.95, 'USD'), /1\.95/);
});
