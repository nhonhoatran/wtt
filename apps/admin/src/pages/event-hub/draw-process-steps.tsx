import { Grid, Steps, Typography } from 'antd';
import type { DrawKind, DrawRef } from './draw-types';

/** Step reached by a draw: none = still choosing seeds / groups in the wizard, draft = preview, published = all done. */
export function drawStepIndex(draw: DrawRef | undefined): number {
  if (!draw) return 0;
  return draw.status === 'DRAFT' ? 2 : 4;
}

interface DrawProcessStepsProps {
  kind: DrawKind;
  draw: DrawRef | undefined;
}

/** Four-step indicator derived from the draw state; steps 1-2 happen in the draw wizard. */
export function DrawProcessSteps({ kind, draw }: DrawProcessStepsProps) {
  const titles = ['Chọn hạt giống', kind === 'GROUP' ? 'Chia bảng' : 'Xếp nhánh', 'Xem trước', 'Công bố'];
  const index = drawStepIndex(draw);
  if (!Grid.useBreakpoint().sm) {
    return <Typography.Text type="secondary">{index >= titles.length ? `Đã xong cả ${titles.length} bước` : `Bước ${index + 1}/${titles.length}: ${titles[index]}`}</Typography.Text>;
  }
  return <Steps size="small" responsive={false} labelPlacement="vertical" current={index} items={titles.map((title) => ({ title }))} aria-label="Các bước bốc thăm" />;
}
