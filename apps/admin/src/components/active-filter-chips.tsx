import { Flex, Tag, Typography } from 'antd';

export interface ActiveFilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

/** "Đang lọc:" row; each chip removes only its own filter. Renders nothing when no filter is applied. */
export function ActiveFilterChips({ chips }: { chips: ActiveFilterChip[] }) {
  if (chips.length === 0) return null;
  return (
    <Flex wrap align="center" gap="small" aria-label="Bộ lọc đang áp dụng" style={{ flexBasis: '100%' }}>
      <Typography.Text type="secondary">Đang lọc:</Typography.Text>
      {chips.map((chip) => (
        <Tag key={chip.key} closable onClose={chip.onClear} style={{ marginInlineEnd: 0 }}>
          {chip.label}
        </Tag>
      ))}
    </Flex>
  );
}
