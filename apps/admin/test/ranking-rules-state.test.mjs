import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cellKey, changedRuleCells, copyRuleColumn, editsInScope, invalidRuleCells, isValidRulePoints, originalRuleValue, ruleCellValue, updateRuleCell, updateScopedRuleEdits, visibleEventTypes } from '../src/pages/ranking/ranking-rules-state.ts';

const cell = (eventTypeId, stageCode, points) => ({ eventTypeId, stageCode, points });
const originals = (...cells) => new Map(cells.map((item) => [cellKey(item.eventTypeId, item.stageCode), item.points]));
const pending = (...cells) => Object.fromEntries(cells.map((item) => [cellKey(item.eventTypeId, item.stageCode), item]));

test('editing one matrix cell keeps other event types and rounds independent', () => {
  const baseline = originals(cell('major', 'W', 1000), cell('club', 'W', 125));
  const edits = pending(cell('major', 'F', 600));
  const updated = updateRuleCell(edits, baseline, 'club', 'W', 200);
  assert.deepEqual(Object.values(updated), [cell('major', 'F', 600), cell('club', 'W', 200)]);
  assert.equal(ruleCellValue(updated, baseline, 'major', 'W'), 1000);
  assert.equal(ruleCellValue(updated, baseline, 'club', 'W'), 200);
  assert.equal(ruleCellValue(updated, baseline, 'club', 'SF'), null);
});

test('restoring stored points removes that pending change without discarding another edit', () => {
  const baseline = originals(cell('major', 'W', 1000));
  const edits = pending(cell('major', 'W', 1200), cell('major', 'F', 600));
  assert.deepEqual(updateRuleCell(edits, baseline, 'major', 'W', 1000), pending(cell('major', 'F', 600)));
});

test('clearing a changed existing cell restores the stored rule rather than deleting or zeroing it', () => {
  const baseline = originals(cell('major', 'W', 1000));
  const edits = updateRuleCell(pending(cell('major', 'W', 1200)), baseline, 'major', 'W', null);
  assert.deepEqual(edits, {});
  assert.equal(ruleCellValue(edits, baseline, 'major', 'W'), 1000);
});

test('clearing a new cell removes the pending rule and leaves the original cell blank', () => {
  const baseline = originals();
  const edits = updateRuleCell(pending(cell('club', 'SF', 50)), baseline, 'club', 'SF', null);
  assert.deepEqual(edits, {});
  assert.equal(ruleCellValue(edits, baseline, 'club', 'SF'), null);
});

test('explicit zero replaces a nonzero rule and creates a rule in a previously blank cell', () => {
  const baseline = originals(cell('major', 'W', 1000));
  const first = updateRuleCell({}, baseline, 'major', 'W', 0);
  const edits = updateRuleCell(first, baseline, 'club', 'SF', 0);
  assert.equal(ruleCellValue(edits, baseline, 'major', 'W'), 0);
  assert.equal(ruleCellValue(edits, baseline, 'club', 'SF'), 0);
  assert.deepEqual(Object.values(edits), [cell('major', 'W', 0), cell('club', 'SF', 0)]);
});

test('a stored zero does not become an unsaved change when entered again', () => {
  assert.deepEqual(updateRuleCell({}, originals(cell('club', 'GROUP', 0)), 'club', 'GROUP', 0), {});
});

test('copying a column includes zero and the source changes that have not yet been saved', () => {
  const baseline = originals(cell('major', 'W', 1000), cell('major', 'F', 600), cell('club', 'F', 50));
  const edits = pending(cell('major', 'W', 1200), cell('major', 'F', 0));
  const copied = copyRuleColumn(edits, baseline, ['W', 'F'], 'major', 'club');
  assert.equal(ruleCellValue(copied, baseline, 'club', 'W'), 1200);
  assert.equal(ruleCellValue(copied, baseline, 'club', 'F'), 0);
  assert.equal(ruleCellValue(copied, baseline, 'major', 'W'), 1200);
});

test('blank source cells leave stored and unsaved destination values unchanged', () => {
  const baseline = originals(cell('club', 'W', 125), cell('club', 'F', 75));
  const edits = pending(cell('club', 'F', 100));
  const copied = copyRuleColumn(edits, baseline, ['W', 'F', 'SF'], 'major', 'club');
  assert.deepEqual(copied, edits);
  assert.equal(ruleCellValue(copied, baseline, 'club', 'W'), 125);
  assert.equal(ruleCellValue(copied, baseline, 'club', 'F'), 100);
  assert.equal(ruleCellValue(copied, baseline, 'club', 'SF'), null);
});

test('copying a value equal to the target baseline removes a superseded target edit', () => {
  const baseline = originals(cell('major', 'W', 125), cell('club', 'W', 125));
  const copied = copyRuleColumn(pending(cell('club', 'W', 200)), baseline, ['W'], 'major', 'club');
  assert.deepEqual(copied, {});
});

test('cell updates and column copies preserve the inputs used for discard and baseline comparison', () => {
  const baseline = originals(cell('major', 'W', 1000), cell('major', 'F', 600));
  const entry = Object.freeze(cell('major', 'W', 1200));
  const edits = Object.freeze(pending(entry));
  const beforeBaseline = [...baseline.entries()];
  updateRuleCell(edits, baseline, 'major', 'W', null);
  copyRuleColumn(edits, baseline, ['W', 'F'], 'major', 'club');
  assert.deepEqual(edits, pending(cell('major', 'W', 1200)));
  assert.deepEqual([...baseline.entries()], beforeBaseline);
});

for (const nextScope of ['DOUBLES|MAIN|', 'SINGLES|QUALIFYING|', 'SINGLES|MAIN|2026-12-01']) {
  test(`switching to ${nextScope} hides old edits and starts new edits with a clean baseline`, () => {
    const baseline = originals(cell('major', 'W', 400));
    const state = { scope: 'SINGLES|MAIN|', edits: pending(cell('major', 'W', 1200)) };
    assert.deepEqual(editsInScope(state, nextScope), {});
    const updated = updateScopedRuleEdits(state, nextScope, (edits) => updateRuleCell(edits, baseline, 'club', 'F', 50));
    assert.equal(updated.scope, nextScope);
    assert.deepEqual(updated.edits, pending(cell('club', 'F', 50)));
    assert.deepEqual(editsInScope(updated, state.scope), {});
    assert.deepEqual(state.edits, pending(cell('major', 'W', 1200)));
  });
}

test('updates in the current scope retain pending changes and discard clears that scope', () => {
  const scope = 'SINGLES|MAIN|';
  const state = { scope, edits: pending(cell('major', 'W', 1200)) };
  const updated = updateScopedRuleEdits(state, scope, (edits) => updateRuleCell(edits, originals(), 'club', 'F', 50));
  assert.deepEqual(Object.values(updated.edits), [cell('major', 'W', 1200), cell('club', 'F', 50)]);
  assert.deepEqual(updateScopedRuleEdits(updated, scope, () => ({})), { scope, edits: {} });
});

test('saving at a future effective date excludes values already provided by that version', () => {
  const edits = [cell('major', 'W', 1200), cell('club', 'F', 100)];
  const today = [cell('major', 'W', 1000), cell('club', 'F', 75)];
  const future = [cell('major', 'W', 1200), cell('club', 'F', 75)];
  assert.deepEqual(changedRuleCells(edits, today), edits);
  assert.deepEqual(changedRuleCells(edits, future), [cell('club', 'F', 100)]);
});

test('future-version diff distinguishes an explicit zero from a missing cell and compares each round and event type', () => {
  const edits = [cell('major', 'W', 0), cell('club', 'W', 0), cell('club', 'F', 0)];
  const baseline = [cell('major', 'W', 0), cell('club', 'F', 100)];
  assert.deepEqual(changedRuleCells(edits, baseline), [cell('club', 'W', 0), cell('club', 'F', 0)]);
});

test('a future version with all edited values already in force produces no write cells', () => {
  const edits = [cell('major', 'W', 1200), cell('club', 'F', 100)];
  assert.deepEqual(changedRuleCells(edits, edits), []);
  assert.deepEqual(changedRuleCells([], edits), []);
});

test('negative and fractional points are invalid while zero and whole numbers are valid', () => {
  assert.deepEqual([-5, 1.5, 0, 10].map(isValidRulePoints), [false, false, true, true]);
});

test('invalid cells list only pending edits that break the points rule', () => {
  const edits = pending(cell('major', 'W', -5), cell('major', 'F', 600), cell('club', 'W', 2.5));
  assert.deepEqual(invalidRuleCells(edits), [cell('major', 'W', -5), cell('club', 'W', 2.5)]);
  assert.deepEqual(invalidRuleCells({}), []);
});

test('original value ignores unsaved edits and is null for a blank cell', () => {
  const baseline = originals(cell('major', 'W', 1000));
  assert.equal(originalRuleValue(baseline, 'major', 'W'), 1000);
  assert.equal(originalRuleValue(baseline, 'major', 'F'), null);
});

test('inactive event types stay visible only when hiding them would conceal a stored rule', () => {
  const eventType = (id, isActive) => ({ id, code: id, name: id, isActive, tier: null });
  const active = eventType('active', true);
  const retiredWithRule = eventType('retired-used', false);
  const retiredWithoutRule = eventType('retired-empty', false);
  const matrix = {
    competitorKind: 'SINGLES', drawKind: 'MAIN', asOf: '2026-11-20',
    eventTypes: [active, retiredWithRule, retiredWithoutRule], stageCodes: ['W'],
    cells: [{ ...cell(retiredWithRule.id, 'W', 0), effectiveFrom: '2026-11-01' }], versions: [],
  };
  assert.deepEqual(visibleEventTypes(matrix), [active, retiredWithRule]);
});
