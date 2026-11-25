import assert from 'node:assert/strict';
import { test } from 'node:test';
import { boardSubtitle, formatDelta, movementKind, pointsDelta, publishConfirmLines, resolveListId } from '../src/pages/ranking/ranking-board-labels.ts';

test('movementKind separates newcomers from unchanged and says nothing without a previous period', () => {
  assert.equal(movementKind(null, true), 'new');
  assert.equal(movementKind(3, true), 'up');
  assert.equal(movementKind(-1, true), 'down');
  assert.equal(movementKind(0, true), 'same');
  assert.equal(movementKind(null, false), 'none');
});

test('pointsDelta counts a newcomer score as the gain and is null without a previous period', () => {
  assert.equal(pointsDelta(700, 1000, true), -300);
  assert.equal(pointsDelta(1000, 700, true), 300);
  assert.equal(pointsDelta(450, null, true), 450);
  assert.equal(pointsDelta(450, null, false), null);
});

test('formatDelta signs the number with + or a true minus and keeps zero plain', () => {
  assert.equal(formatDelta(300), '+300');
  assert.equal(formatDelta(-300), '−300');
  assert.equal(formatDelta(0), '0');
  assert.equal(formatDelta(null), '—');
});

test('boardSubtitle for a draft names the as-of day, creation time and previous period', () => {
  const text = boardSubtitle({
    status: 'DRAFT',
    asOfDate: '2026-11-25T00:00:00.000Z',
    createdAt: '2026-11-25T03:05:00.000Z',
    publishedAt: null,
    previous: { id: 'p', asOfDate: '2026-11-18T00:00:00.000Z', publishedAt: '2026-11-18T09:00:00.000Z' },
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(text, 'Bản tạm tính ngày 25/11/2026 · tạo lúc 10:05 · Kỳ trước chốt ngày 18/11/2026');
});

test('boardSubtitle for a published board without a previous period says so', () => {
  const text = boardSubtitle({
    status: 'PUBLISHED',
    asOfDate: '2026-11-25',
    createdAt: '2026-11-25T03:05:00.000Z',
    publishedAt: '2026-11-25T04:30:00.000Z',
    previous: null,
    timeZone: 'Asia/Ho_Chi_Minh',
  });
  assert.equal(text, 'Đã chốt ngày 25/11/2026 · lúc 11:30 · Chưa có kỳ trước để so sánh');
});

test('publishConfirmLines states the rank changes, and that the publish cannot be undone', () => {
  const withPrevious = publishConfirmLines({ listName: 'Đơn nam', asOfDate: '2026-11-25', rows: 40, changed: 12, newcomers: 3, hasPrevious: true });
  assert.match(withPrevious[0], /Đơn nam ngày 25\/11\/2026 có 40 VĐV\. So với kỳ trước: 12 VĐV đổi hạng, 3 VĐV mới\./);
  assert.match(withPrevious[2], /Không thể sửa hay xóa/);
  const first = publishConfirmLines({ listName: 'Đơn nam', asOfDate: '2026-11-25', rows: 40, changed: 0, newcomers: 0, hasPrevious: false });
  assert.match(first[0], /kỳ đầu tiên/);
});

test('resolveListId keeps a valid ?list= and falls back to the first list', () => {
  assert.equal(resolveListId('b', ['a', 'b']), 'b');
  assert.equal(resolveListId('gone', ['a', 'b']), 'a');
  assert.equal(resolveListId(null, ['a', 'b']), 'a');
  assert.equal(resolveListId('a', []), null);
});
