import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nearestCellCoordinates, SCHEDULE_KEYBOARD_CODES, scheduleCollisionDetection } from '../src/pages/event-hub/schedule-keyboard-drag.ts';

const CELL = 100;
const rect = (col, row) => ({ left: col * CELL, top: row * CELL, width: CELL, height: CELL, right: (col + 1) * CELL, bottom: (row + 1) * CELL });
const grid = (cells) => ({
  droppableRects: new Map(cells.map(([id, col, row]) => [id, rect(col, row)])),
  droppableContainers: { getEnabled: () => cells.map(([id]) => ({ id })) },
});
const press = (code, context, from = rect(1, 1)) => {
  let prevented = false;
  const coords = nearestCellCoordinates({ code, preventDefault: () => { prevented = true; } }, { context: { collisionRect: from, ...context } });
  return { coords, prevented };
};

test('an arrow key moves to the next cell in the same row before a closer diagonal one', () => {
  const context = grid([['same-row', 3, 1], ['diagonal', 2, 2], ['behind', 0, 1]]);
  const { coords, prevented } = press('ArrowRight', context);
  assert.deepEqual(coords, { x: 3 * CELL, y: CELL });
  assert.equal(prevented, true);
});

test('each direction only looks ahead of the held match', () => {
  const context = grid([['up', 1, 0], ['down', 1, 2], ['left', 0, 1], ['right', 2, 1]]);
  assert.deepEqual(press('ArrowUp', context).coords, { x: CELL, y: 0 });
  assert.deepEqual(press('ArrowDown', context).coords, { x: CELL, y: 2 * CELL });
  assert.deepEqual(press('ArrowLeft', context).coords, { x: 0, y: CELL });
});

test('no cell ahead keeps the match where it is', () => {
  assert.equal(press('ArrowLeft', grid([['right', 2, 1]])).coords, undefined);
});

test('other keys are left to the sensor', () => {
  const { coords, prevented } = press('KeyA', grid([['right', 2, 1]]));
  assert.equal(coords, undefined);
  assert.equal(prevented, false);
});

test('Enter does not lift a match, so it keeps its pick-then-place meaning', () => {
  assert.deepEqual(SCHEDULE_KEYBOARD_CODES.start, ['Space']);
  assert.ok(SCHEDULE_KEYBOARD_CODES.end.includes('Enter'));
});

test('tabbing away cancels the drag instead of dropping the match', () => {
  assert.ok(SCHEDULE_KEYBOARD_CODES.cancel.includes('Tab'));
  assert.ok(!SCHEDULE_KEYBOARD_CODES.end.includes('Tab'));
});

test('a keyboard drag has no pointer and still finds the cell under the held match', () => {
  const { droppableRects, droppableContainers } = grid([['a', 0, 0], ['b', 2, 0]]);
  const collisions = scheduleCollisionDetection({
    active: { id: 'm' },
    collisionRect: rect(2, 0),
    droppableRects,
    droppableContainers: droppableContainers.getEnabled(),
    pointerCoordinates: null,
  });
  assert.equal(collisions[0]?.id, 'b');
});

test('a keyboard drag that does not overlap any cell drops nowhere', () => {
  const { droppableRects, droppableContainers } = grid([['a', 0, 0], ['b', 2, 0]]);
  const collisions = scheduleCollisionDetection({
    active: { id: 'm' },
    collisionRect: rect(5, 5),
    droppableRects,
    droppableContainers: droppableContainers.getEnabled(),
    pointerCoordinates: null,
  });
  assert.deepEqual(collisions, []);
});
