import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchTableLabel, tableDisplayName } from '../src/pages/event-hub/table-display-name.ts';

test('display name is used as-is, a bare code gets the "Bàn" prefix', () => {
  assert.equal(tableDisplayName({ code: 'T1', displayName: 'Bàn 1' }), 'Bàn 1');
  assert.equal(tableDisplayName({ code: 'T1', displayName: ' Sân chính ' }), 'Sân chính');
  assert.equal(tableDisplayName({ code: 'T1', displayName: '' }), 'Bàn T1');
  assert.equal(tableDisplayName({ code: 'T1' }), 'Bàn T1');
  assert.equal(tableDisplayName({ code: null, displayName: null }), null);
});

test('match table label: API name that is just the code still gets the prefix', () => {
  assert.equal(matchTableLabel({ tableCode: 'T1', tableName: 'Bàn 1' }), 'Bàn 1');
  assert.equal(matchTableLabel({ tableCode: 'T1', tableName: 'T1' }), 'Bàn T1');
  assert.equal(matchTableLabel({ tableCode: 'T1', tableName: null }), 'Bàn T1');
  assert.equal(matchTableLabel({}), null);
});
