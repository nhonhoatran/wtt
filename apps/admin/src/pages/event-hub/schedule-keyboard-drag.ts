import { KeyboardCode, pointerWithin, rectIntersection, type CollisionDetection, type KeyboardCoordinateGetter, type KeyboardSensorOptions } from '@dnd-kit/core';

// Cross-axis distance weighs more so an arrow key prefers the next cell in the same row or column.
const CROSS_AXIS_WEIGHT = 2;
const MIN_STEP_PX = 1;

const ARROWS: string[] = [KeyboardCode.Up, KeyboardCode.Down, KeyboardCode.Left, KeyboardCode.Right];

// Space lifts a match; Enter keeps its click meaning (pick a match, then pick a cell). Tabbing away cancels.
export const SCHEDULE_KEYBOARD_CODES: KeyboardSensorOptions['keyboardCodes'] = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc, KeyboardCode.Tab],
  end: [KeyboardCode.Space, KeyboardCode.Enter],
};

const center = (rect: { left: number; top: number; width: number; height: number }) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

/** Arrow keys jump to the nearest enabled cell in that direction instead of moving a fixed number of pixels. */
export const nearestCellCoordinates: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects, droppableContainers } }) => {
  if (!ARROWS.includes(event.code)) return undefined;
  event.preventDefault();
  if (!collisionRect) return undefined;
  const from = center(collisionRect);
  let best: { x: number; y: number } | undefined;
  let bestScore = Infinity;
  for (const container of droppableContainers.getEnabled()) {
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const to = center(rect);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const vertical = event.code === KeyboardCode.Up || event.code === KeyboardCode.Down;
    const along = vertical ? dy : dx;
    const ahead = event.code === KeyboardCode.Up || event.code === KeyboardCode.Left ? along < -MIN_STEP_PX : along > MIN_STEP_PX;
    if (!ahead) continue;
    const score = Math.abs(along) + CROSS_AXIS_WEIGHT * Math.abs(vertical ? dx : dy);
    if (score < bestScore) {
      bestScore = score;
      best = to;
    }
  }
  return best && { x: best.x - collisionRect.width / 2, y: best.y - collisionRect.height / 2 };
};

/**
 * A keyboard drag has no pointer, so it drops only on a cell the held match overlaps: lifting from the unscheduled
 * panel and pressing Space again must not schedule into whichever cell happens to be nearest.
 */
export const scheduleCollisionDetection: CollisionDetection = (args) => (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args));
