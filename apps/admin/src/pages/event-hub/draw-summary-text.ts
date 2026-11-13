import type { DrawKind, DrawPreview } from './draw-types';

/** One-line live summary, e.g. "51 VĐV → nhánh 64 · 13 BYE · 16 hạt giống". */
export function drawSummaryText(kind: DrawKind, preview: DrawPreview): string {
  const players = `${preview.params.entryCount} VĐV`;
  if (kind === 'GROUP') {
    const sizes = preview.sectionSizes.length > 0 ? ` (${preview.sectionSizes.join(', ')} VĐV)` : '';
    return [`${players} → ${preview.groupCount ?? preview.params.groupCount ?? '?'} bảng${sizes}`, `${preview.params.advancePerGroup ?? '?'} đi tiếp mỗi bảng`, `${preview.seedCount} hạt giống`].join(' · ');
  }
  const parts = [`${players} → nhánh ${preview.size ?? '?'}`, `${preview.byeCount} BYE`, `${preview.seedCount} hạt giống`];
  if (preview.qualifierSlots > 0) parts.push(`${preview.qualifierSlots} suất vòng loại`);
  return parts.join(' · ');
}
