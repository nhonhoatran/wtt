import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchTimeText, pendingMatchStatus, resultsLink, todayText } from '../src/pages/dashboard/pending-match-status.ts';

const now = Date.parse('2026-11-25T03:00:00Z');

test('live matches are live whatever their time', () => {
  assert.equal(pendingMatchStatus({ status: 'LIVE', scheduledAt: '2026-11-25T08:00:00Z' }, now), 'LIVE');
});

test('scheduled matches past their start wait for a result, future ones are upcoming', () => {
  assert.equal(pendingMatchStatus({ status: 'SCHEDULED', scheduledAt: '2026-11-25T02:59:59Z' }, now), 'OVERDUE');
  assert.equal(pendingMatchStatus({ status: 'SCHEDULED', scheduledAt: '2026-11-25T03:00:00Z' }, now), 'UPCOMING');
  assert.equal(pendingMatchStatus({ status: 'SCHEDULED', scheduledAt: null }, now), 'UPCOMING');
});

test('time is shown in the event timezone and missing time is a dash', () => {
  assert.equal(matchTimeText('2026-11-25T02:40:00Z', 'Asia/Ho_Chi_Minh'), '09:40');
  assert.equal(matchTimeText(null, 'Asia/Ho_Chi_Minh'), '—');
});

test('today heading carries weekday and numeric date', () => {
  assert.equal(todayText(new Date('2026-11-25T03:00:00Z'), 'Asia/Ho_Chi_Minh'), 'Thứ Tư, 25/11/2026');
});

test('deep link', () => {
  assert.equal(resultsLink({ eventId: 'e 1', id: 'm1' }), '/results?event=e%201&match=m1');
});
