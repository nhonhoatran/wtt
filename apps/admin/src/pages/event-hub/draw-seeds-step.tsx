import { useTable } from '@refinedev/antd';
import { Button, Flex, Table, Tooltip, Typography } from 'antd';
import { useRef } from 'react';
import { useListPageSize } from '../../providers/use-list-page-size';
import type { DrawKind } from './draw-types';
import type { EntryRecord, EntrySubEvent } from './entry-labels';
import { EntrySeedCell } from './entry-seed-cell';
import { entriesResource } from './entry-table';

interface DrawSeedsStepProps {
  subEvent: EntrySubEvent;
  kind: DrawKind;
}

/** Seeds are saved cell by cell (blur / Enter), the same cell as the Đăng ký tab. */
export function DrawSeedsStep({ subEvent, kind }: DrawSeedsStepProps) {
  const pageSize = useListPageSize();
  const seedInputs = useRef(new Map<string, HTMLInputElement>());
  const stage = subEvent.hasQualifying ? [{ field: 'stage', operator: 'eq' as const, value: kind === 'QUALIFYING' ? 'QUALIFYING' : 'MAIN' }] : [];
  const { tableProps } = useTable<EntryRecord>({
    resource: entriesResource(subEvent.id),
    syncWithLocation: false,
    pagination: { pageSize },
    filters: { permanent: [{ field: 'status', operator: 'eq', value: 'CONFIRMED' }, ...stage] },
    sorters: { initial: [{ field: 'seed', order: 'asc' }] },
  });
  const rows = tableProps.dataSource ?? [];

  const moveFocus = (entry: EntryRecord, backwards: boolean) => {
    const editable = rows.filter((row) => seedInputs.current.has(row.id));
    const next = editable[editable.findIndex((row) => row.id === entry.id) + (backwards ? -1 : 1)];
    if (!next) return false;
    seedInputs.current.get(next.id)?.focus();
    return true;
  };

  return (
    <Flex vertical gap="small">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Typography.Text type="secondary">Nhập số hạt giống cho từng VĐV (để trống nếu không là hạt giống).</Typography.Text>
        <Tooltip title="Có khi có bảng xếp hạng">
          <span>
            <Button disabled>Gợi ý theo BXH</Button>
          </span>
        </Tooltip>
      </Flex>
      <Table<EntryRecord> {...tableProps} size="small" rowKey="id">
        <Table.Column<EntryRecord>
          title="Hạt giống"
          width={120}
          render={(_, entry) => (
            <EntrySeedCell
              entry={entry}
              register={(element) => (element ? seedInputs.current.set(entry.id, element) : seedInputs.current.delete(entry.id))}
              onTab={(backwards) => moveFocus(entry, backwards)}
            />
          )}
        />
        <Table.Column<EntryRecord> title="VĐV" render={(_, entry) => entry.competitor.displayName} />
        <Table.Column<EntryRecord>
          title="CLB"
          render={(_, entry) => [...new Set(entry.competitor.players.map((player) => player.club).filter(Boolean))].join(', ') || '—'}
        />
      </Table>
    </Flex>
  );
}
