import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankingDateOnly, rankingPointsExpired } from '../src/pages/ranking/ranking-date-labels.ts';

test('date columns keep their calendar day instead of converting UTC midnight to local time', () => {
  assert.equal(rankingDateOnly('2026-11-27T00:00:00.000Z'), '2026-11-27');
  assert.equal(rankingDateOnly('2026-11-27'), '2026-11-27');
});

test('expiry follows the API business day, including equality and an unavailable clock', () => {
  assert.equal(rankingPointsExpired('2026-11-26T00:00:00.000Z', '2026-11-27'), true);
  assert.equal(rankingPointsExpired('2026-11-27T00:00:00.000Z', '2026-11-27'), true);
  assert.equal(rankingPointsExpired('2026-11-28T00:00:00.000Z', '2026-11-27'), false);
  assert.equal(rankingPointsExpired('2026-11-26T00:00:00.000Z', undefined), false);
});
