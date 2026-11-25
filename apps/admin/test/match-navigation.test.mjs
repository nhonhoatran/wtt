import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchNavigation } from '../src/pages/results/match-navigation.ts';

const ids = ['a', 'b', 'c'];

test('middle row links both neighbours on the same page', () => {
  const nav = matchNavigation(ids, 'b', 1, 3, 9);
  assert.deepEqual(nav.prev, { kind: 'row', id: 'a' });
  assert.deepEqual(nav.next, { kind: 'row', id: 'c' });
  assert.equal(nav.position, 2);
  assert.equal(nav.total, 9);
});

test('first row of page 1 has no previous, last row of the last page has no next', () => {
  assert.equal(matchNavigation(ids, 'a', 1, 3, 6).prev, null);
  assert.equal(matchNavigation(ids, 'c', 2, 3, 6).next, null);
  assert.equal(matchNavigation(ids, 'c', 1, 3, 3).next, null);
});

test('page edges point to the neighbouring page', () => {
  assert.deepEqual(matchNavigation(ids, 'a', 2, 3, 9).prev, { kind: 'page', page: 1, pick: 'last' });
  assert.deepEqual(matchNavigation(ids, 'c', 2, 3, 9).next, { kind: 'page', page: 3, pick: 'first' });
  assert.equal(matchNavigation(ids, 'a', 2, 3, 9).position, 4);
});

test('a match that is not on the page gets no navigation', () => {
  assert.equal(matchNavigation(ids, 'z', 1, 3, 9), null);
  assert.equal(matchNavigation(ids, null, 1, 3, 9), null);
});
