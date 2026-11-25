import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeDraft, confirmBlockReason, gameRuleHint } from '../src/pages/results/score-draft.ts';

const format = { name: 'BO5', bestOf: 5, pointsPerGame: 11, winBy: 2 };
const game = (a, b) => ({ a, b });
const blank = () => Array.from({ length: 5 }, () => game('', ''));

test('rule hint is built from the format with examples', () => {
  assert.match(gameRuleHint(format), /đạt 11 điểm và hơn 2 điểm \(ví dụ 11–9, 12–10\)/);
  assert.match(gameRuleHint({ ...format, pointsPerGame: 21, winBy: 1 }), /đạt 21 điểm và hơn 1 điểm \(ví dụ 21–20\)/);
});

test('a bad game names the game, the rule and an example', () => {
  const draft = blank();
  draft[0] = game('11', '10');
  const analysis = analyzeDraft(draft, format);
  assert.match(analysis.gameErrors[1], /^Ván 1: 11–10 chưa đủ cách 2 điểm\. Quy tắc: .*ví dụ 11–9/);
  assert.equal(confirmBlockReason(draft, analysis), 'Sửa ván 1 để xác nhận');
});

test('block reason covers empty, half-filled and unfinished matches, and clears when valid', () => {
  assert.equal(confirmBlockReason(blank(), analyzeDraft(blank(), format)), 'Nhập tỷ số các ván để xác nhận');
  const half = blank();
  half[0] = game('11', '');
  assert.equal(confirmBlockReason(half, analyzeDraft(half, format)), 'Nhập đủ điểm hai bên ở ván 1 để xác nhận');
  const unfinished = blank();
  unfinished[0] = game('11', '5');
  assert.match(confirmBlockReason(unfinished, analyzeDraft(unfinished, format)), /nhập tiếp ván 2$/);
  const won = [game('11', '5'), game('11', '6'), game('11', '7'), game('', ''), game('', '')];
  assert.equal(confirmBlockReason(won, analyzeDraft(won, format)), null);
});
