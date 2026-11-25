import type { BracketData, DrawKind, DrawPreview, GroupsData } from './draw-types';

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

/** Same line for a draw that already exists, e.g. "32 VĐV · 8 bảng × 4 · 8 hạt giống · 2 đi tiếp mỗi bảng". */
export function drawViewSummaryText(kind: DrawKind, data: Partial<BracketData & GroupsData>): string {
  const parts: string[] = [];
  if (kind === 'GROUP') {
    const sizes = (data.groups ?? []).map((group) => group.members.length);
    const total = sizes.reduce((sum, size) => sum + size, 0);
    const spread = sizes.length === 0 ? '' : Math.min(...sizes) === Math.max(...sizes) ? ` × ${sizes[0]}` : ` × ${Math.min(...sizes)}-${Math.max(...sizes)}`;
    parts.push(`${total} VĐV`, `${sizes.length} bảng${spread}`);
    if (data.seedCount) parts.push(`${data.seedCount} hạt giống`);
    if (data.advancePerGroup) parts.push(`${data.advancePerGroup} đi tiếp mỗi bảng`);
    return parts.join(' · ');
  }
  const positions = data.positions ?? [];
  const players = positions.filter((position) => position.source === 'ENTRY').length;
  const byes = positions.filter((position) => position.source === 'BYE').length;
  if (players > 0) parts.push(`${players} VĐV`);
  if (data.size) parts.push(`nhánh ${data.size}`);
  if (byes > 0) parts.push(`${byes} BYE`);
  if (data.seedCount) parts.push(`${data.seedCount} hạt giống`);
  if (data.qualifierCount) parts.push(`${data.qualifierCount} suất vòng loại`);
  return parts.join(' · ');
}
