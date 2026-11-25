import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSameClubGroups, sameClubSummary } from '../src/pages/event-hub/same-club-groups.ts';

const entry = (id, ...clubs) => ({
  id,
  displayName: `Entry ${id}`,
  players: clubs.map((club, index) => ({ id: `${id}-${index}`, fullName: `P ${id}${index}`, club })),
});
const group = (code, ...entries) => ({ id: `g${code}`, code, members: entries.map((item) => ({ entryId: item.id, slot: 1, entry: item })) });

test('flags two entries of the same club ignoring case, accents and spacing', () => {
  const result = findSameClubGroups([group('C', entry('1', 'CLB Sao Vàng'), entry('2', ' clb  sao vang '), entry('3', 'CLB Biển Xanh'))]);
  assert.equal(result.length, 1);
  assert.equal(result[0].groupCode, 'C');
  assert.equal(result[0].club, 'CLB Sao Vàng');
  assert.deepEqual(result[0].entries.map((item) => item.id), ['1', '2']);
  assert.equal(sameClubSummary(result), 'Bảng C có 2 VĐV cùng CLB (CLB Sao Vàng)');
});

test('ignores blank or missing clubs', () => {
  assert.deepEqual(findSameClubGroups([group('A', entry('1', null), entry('2', null), entry('3', '  '), entry('4', ''))]), []);
});

test('a doubles pair from one club is not a conflict, two pairs sharing a club are', () => {
  assert.deepEqual(findSameClubGroups([group('A', entry('1', 'Sao Vàng', 'Sao Vàng'), entry('2', 'Biển Xanh', 'Biển Xanh'))]), []);
  const result = findSameClubGroups([group('A', entry('1', 'Sao Vàng', 'Biển Xanh'), entry('2', 'Biển Xanh', 'Tây Đô'))]);
  assert.equal(result.length, 1);
  assert.equal(result[0].club, 'Biển Xanh');
});

test('the same club in different groups is fine and a swap removes the conflict', () => {
  assert.deepEqual(findSameClubGroups([group('A', entry('1', 'X')), group('B', entry('2', 'X'))]), []);
  assert.equal(findSameClubGroups([group('A', entry('1', 'X'), entry('2', 'x'))]).length, 1);
  assert.deepEqual(findSameClubGroups([group('A', entry('1', 'X'), entry('3', 'Y')), group('B', entry('2', 'x'))]), []);
});
