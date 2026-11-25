import { useTable } from '@refinedev/antd';
import { Card, Table, Typography } from 'antd';
import { Link } from 'react-router';
import { useListPageSize } from '../../providers/use-list-page-size';
import type { RankingListRecord } from '../../resources/ranking-lists/ranking-list-form';
import { COMPETITOR_KIND_LABELS } from './ranking-labels';
import type { CompetitorKind } from './ranking-rules-state';

/** Validity is a property of each ranking list, so it is listed here read-only with a link to edit it. */
export function RankingValidityCard({ kind }: { kind: CompetitorKind }) {
  const pageSize = useListPageSize();
  const { tableProps } = useTable<RankingListRecord>({
    resource: 'ranking-lists',
    syncWithLocation: false,
    pagination: { pageSize },
    sorters: { initial: [{ field: 'order', order: 'asc' }] },
    filters: { permanent: [{ field: 'competitorKind', operator: 'eq', value: kind }] },
  });
  return (
    <Card title="Thời hạn hiệu lực của điểm" styles={{ body: { padding: 0 } }}>
      <Typography.Paragraph type="secondary" style={{ margin: 0, padding: '12px 24px 0' }}>
        Điểm tự hết hạn sau số ngày đặt cho từng bảng xếp hạng, tính từ ngày kết thúc giải.
      </Typography.Paragraph>
      <Table<RankingListRecord> {...tableProps} rowKey="id" size="middle" locale={{ emptyText: `Chưa có bảng xếp hạng ${COMPETITOR_KIND_LABELS[kind].toLowerCase()}` }} scroll={{ x: 'max-content' }}>
        <Table.Column<RankingListRecord> key="name" title="Bảng xếp hạng" dataIndex="name" />
        <Table.Column<RankingListRecord> key="validityDays" title="Thời hạn" dataIndex="validityDays" align="right" render={(days: number) => `${days} ngày`} />
        <Table.Column<RankingListRecord> key="edit" title="" align="right" render={(_, row) => <Link to={`/ranking-lists/${row.id}/edit`}>Sửa</Link>} />
      </Table>
    </Card>
  );
}
