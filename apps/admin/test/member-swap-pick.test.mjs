import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickForSwap } from '../src/pages/event-hub/member-swap-pick.ts';

test('first click picks a member', () => {
  assert.deepEqual(pickForSwap(null, 'a'), { picked: 'a', swap: null });
});

test('clicking the picked member again cancels', () => {
  assert.deepEqual(pickForSwap('a', 'a'), { picked: null, swap: null });
});

test('clicking a different member completes the swap and clears the pick', () => {
  assert.deepEqual(pickForSwap('a', 'b'), { picked: null, swap: ['a', 'b'] });
});
