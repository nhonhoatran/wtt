import type { DrawKind } from '../event-hub/draw-types';
import { roundTitle } from '../event-hub/draw-labels';

export const RULE_DRAW_LABELS: Record<DrawKind, string> = { MAIN: 'Nhánh chính', QUALIFYING: 'Vòng loại', GROUP: 'Vòng bảng' };
export const RULE_DRAW_OPTIONS = (Object.keys(RULE_DRAW_LABELS) as DrawKind[]).map((value) => ({ value, label: RULE_DRAW_LABELS[value] }));

/** Codes come from the engine: W, F, SF, QF, R16.., QF-n (qualifying, counted back from its final), GROUP, GROUP-n (group rank). */
export function stageLabel(code: string): string {
  if (code === 'W') return 'Vô địch';
  if (code === 'GROUP') return 'Vòng bảng';
  const groupRank = /^GROUP-(\d+)$/.exec(code);
  if (groupRank) return `Vòng bảng – hạng ${groupRank[1]}`;
  const qualifying = /^QF-(\d+)$/.exec(code);
  if (qualifying) {
    const back = Number(qualifying[1]) - 1;
    return back === 0 ? 'Vòng loại – vòng cuối' : `Vòng loại – trước vòng cuối ${back} vòng`;
  }
  return roundTitle(code);
}

export const stageLabelWithCode = (code: string) => `${stageLabel(code)} (${code})`;
