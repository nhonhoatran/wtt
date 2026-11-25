import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countConflictedMatches } from '../src/pages/event-hub/schedule-conflict-count.ts';

test('counts only matches that carry conflicts', () => {
  const matches = [{ conflicts: [{ kind: 'TABLE_OVERLAP' }] }, { conflicts: [] }, {}, { conflicts: [{}, {}] }];
  assert.equal(countConflictedMatches(matches), 2);
});

test('empty list has no conflicts', () => {
  assert.equal(countConflictedMatches([]), 0);
});
