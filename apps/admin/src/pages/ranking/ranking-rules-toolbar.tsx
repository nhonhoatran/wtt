import { Flex, Segmented, Select } from 'antd';
import dayjs from 'dayjs';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { COMPETITOR_KIND_OPTIONS } from './ranking-labels';
import { RULE_DRAW_OPTIONS } from './ranking-stage-labels';
import type { CompetitorKind } from './ranking-rules-state';
import type { DrawKind } from '../event-hub/draw-types';

export const CURRENT_VERSION = '';
const VERSION_SELECT_WIDTH = 180;

interface RankingRulesToolbarProps {
  kind: CompetitorKind;
  draw: DrawKind;
  asOf: string;
  versions: string[];
  onKind: (value: CompetitorKind) => void;
  onDraw: (value: DrawKind) => void;
  onVersion: (value: string) => void;
}

export function RankingRulesToolbar({ kind, draw, asOf, versions, onKind, onDraw, onVersion }: RankingRulesToolbarProps) {
  const versionOptions = [
    { value: CURRENT_VERSION, label: 'Hiện hành' },
    ...versions.map((version) => ({ value: version, label: dayjs(version).format(DISPLAY_DATE_FORMAT) })),
  ];
  return (
    <Flex wrap gap="small" align="center">
      <Segmented<CompetitorKind> value={kind} options={COMPETITOR_KIND_OPTIONS as { value: CompetitorKind; label: string }[]} onChange={onKind} aria-label="Đơn hoặc đôi" />
      <Segmented<DrawKind> value={draw} options={RULE_DRAW_OPTIONS} onChange={onDraw} aria-label="Loại nhánh đấu" />
      <Select value={asOf} options={versionOptions} onChange={onVersion} style={{ width: VERSION_SELECT_WIDTH }} aria-label="Xem phiên bản" />
    </Flex>
  );
}
