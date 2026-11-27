import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleDisciplineColor, scheduleDisciplineLegend } from '../src/pages/event-hub/schedule-discipline-colors.ts';

test('catalog hex colors normalize safely while absent/invalid values use the neutral fallback', () => {
  assert.equal(scheduleDisciplineColor('#abcdef'), '#ABCDEF');
  for (const value of [null, undefined, '', 'red', '#abc', '#12345678', 'url(https://example.invalid)']) assert.equal(scheduleDisciplineColor(value), undefined);
});

test('legend deduplicates discipline across sub-events, keeps text for null colors, and accepts older responses', () => {
  const singles = { id: 'singles', code: 'MS', name: 'Đơn nam', colorHex: '#123456' };
  const doubles = { id: 'doubles', code: 'MD', name: 'Đôi nam', colorHex: null };
  assert.deepEqual(scheduleDisciplineLegend([{ discipline: singles }, { discipline: doubles }, { discipline: singles }, {}]), [doubles, singles]);
});
