import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventProgressSteps, remainingStepsText } from '../src/pages/event-hub/event-progress-steps.ts';

const empty = {
  subEvents: 0,
  entries: { confirmed: 0, subEventsReady: 0 },
  draws: { subEventsDone: 0, subEventsStarted: 0, total: 0 },
  matches: { total: 0, scheduled: 0, official: 0 },
};
const statuses = (progress) => eventProgressSteps(progress).map((step) => step.status);

test('empty event: only the info step is done', () => {
  assert.deepEqual(statuses(empty), ['finish', 'wait', 'wait', 'wait', 'wait']);
  assert.equal(remainingStepsText(eventProgressSteps(empty)), 'Còn 4 bước chưa xong');
});

test('sub-events without entries keep the entries step waiting', () => {
  assert.deepEqual(statuses({ ...empty, subEvents: 3 }), ['finish', 'finish', 'wait', 'wait', 'wait']);
});

test('partial entries and draws show counts in the caption', () => {
  const steps = eventProgressSteps({
    subEvents: 5,
    entries: { confirmed: 20, subEventsReady: 3 },
    draws: { subEventsDone: 1, subEventsStarted: 2, total: 5 },
    matches: { total: 10, scheduled: 4, official: 0 },
  });
  assert.deepEqual(steps.map((step) => step.status), ['finish', 'finish', 'process', 'process', 'process']);
  assert.equal(steps[2].caption, 'Đang làm · 3/5 nội dung đủ VĐV');
  assert.equal(steps[3].caption, 'Đang làm · 1/5 nội dung đã công bố');
  assert.equal(steps[4].caption, 'Đang làm · 4/10 trận');
});

test('everything done reports no remaining steps', () => {
  const steps = eventProgressSteps({
    subEvents: 2,
    entries: { confirmed: 16, subEventsReady: 2 },
    draws: { subEventsDone: 2, subEventsStarted: 2, total: 2 },
    matches: { total: 9, scheduled: 9, official: 3 },
  });
  assert.ok(steps.every((step) => step.status === 'finish'));
  assert.equal(remainingStepsText(steps), 'Đã xong cả 5 bước chuẩn bị');
});

test('schedule is never done while there are no matches', () => {
  const steps = eventProgressSteps({ ...empty, subEvents: 1, draws: { subEventsDone: 1, subEventsStarted: 1, total: 1 } });
  assert.equal(steps[4].status, 'wait');
});

test('steps map to hub tab segments', () => {
  assert.deepEqual(eventProgressSteps(empty).map((step) => step.tab), ['info', 'sub-events', 'entries', 'draws', 'schedule']);
});

test('schedule is not done while some sub-event draws are missing, even if all existing matches are scheduled', () => {
  const steps = eventProgressSteps({
    subEvents: 5,
    entries: { confirmed: 40, subEventsReady: 5 },
    draws: { subEventsDone: 1, subEventsStarted: 1, total: 5 },
    matches: { total: 7, scheduled: 7, official: 0 },
  });
  assert.equal(steps[3].status, 'process');
  assert.equal(steps[4].status, 'process');
  assert.equal(steps[4].caption, 'Đang làm · 7/7 trận');
  assert.equal(remainingStepsText(steps), 'Còn 2 bước chưa xong');
});
