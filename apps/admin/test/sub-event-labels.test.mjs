import assert from 'node:assert/strict';
import { test } from 'node:test';
import { entryUnit, matchFormatSummary } from '../src/pages/event-hub/sub-event-labels.ts';

test('matchFormatSummary builds the text from the numbers', () => {
  assert.equal(matchFormatSummary({ bestOf: 5, pointsPerGame: 11, winBy: 2 }), '5 ván, ván 11 điểm, cách biệt 2');
  assert.equal(matchFormatSummary({ bestOf: 3, pointsPerGame: 21, winBy: 1 }), '3 ván, ván 21 điểm, cách biệt 1');
});

test('entryUnit follows the competitor kind', () => {
  assert.equal(entryUnit('SINGLES'), 'VĐV');
  assert.equal(entryUnit('DOUBLES'), 'cặp');
});
