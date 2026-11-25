import { Button, Empty, Flex, Result, Segmented, Select, Skeleton, Tag } from 'antd';
import { useSearchParams } from 'react-router';
import { PageHeader } from '../../components/page-header';
import { useCatalogRows } from '../../resources/events/use-catalog-options';
import { useRankingBoardActions } from './ranking-board-actions';
import { RankingBoardStats } from './ranking-board-stats';
import { RankingBoardTable } from './ranking-board-table';
import { boardSubtitle, resolveListId } from './ranking-board-labels';
import { useBoardSummary, useCurrentSnapshot } from './use-current-snapshot';

/** Up to this many lists show as pills; beyond it a searchable select keeps the header on one row. */
const MAX_PILL_LISTS = 6;

export function RankingBoardPage() {
  const [params, setParams] = useSearchParams();
  const lists = useCatalogRows('ranking-lists');
  const options = (lists.data ?? []).map((list) => ({ value: list.id, label: list.name }));
  const listId = resolveListId(params.get('list'), options.map((option) => option.value));
  const current = useCurrentSnapshot(listId);
  // Never show the previous list's data under the newly picked list while its own is loading.
  const snapshotLoading = current.isLoading || current.isPlaceholderData;
  const snapshot = !snapshotLoading && current.data?.rankingListId === listId ? current.data : null;
  const summaryQuery = useBoardSummary(snapshot?.id);
  const summary = summaryQuery.isPlaceholderData ? undefined : summaryQuery.data;
  const { actions, feedback } = useRankingBoardActions({ listId: listId ?? '', snapshot, summary });

  // A new list starts with clean table state, so only `list` is kept in the URL.
  const pick = (value: string) => setParams({ list: value });

  if (lists.isLoading) return <Skeleton active />;
  if (lists.error) return <Result status="error" title="Không tải được danh sách bảng xếp hạng" extra={<Button onClick={() => lists.refetch()}>Thử lại</Button>} />;
  if (!listId) return <Empty description="Chưa có bảng xếp hạng nào đang dùng" />;

  const picker =
    options.length > MAX_PILL_LISTS ? (
      <Select showSearch optionFilterProp="label" value={listId} options={options} onChange={pick} style={{ minWidth: 240 }} aria-label="Bảng xếp hạng" />
    ) : (
      <Segmented value={listId} options={options} onChange={(value) => pick(String(value))} />
    );

  return (
    <>
      <PageHeader
        title="Bảng xếp hạng"
        tags={snapshot && <Tag color={snapshot.status === 'DRAFT' ? 'orange' : 'green'}>{snapshot.status === 'DRAFT' ? 'Tạm tính' : 'Đã chốt'}</Tag>}
        subtitle={
          snapshot
            ? boardSubtitle({ ...snapshot, previous: summary?.previous ?? null })
            : snapshotLoading
              ? undefined
              : 'Bảng này chưa có bản tạm tính hay bản đã chốt nào'
        }
        actions={snapshotLoading ? undefined : actions}
      />
      <Flex vertical gap="middle">
        <div style={{ overflowX: 'auto' }}>{picker}</div>
        {feedback}
        {current.error && <Result status="error" title="Không tải được bảng xếp hạng" extra={<Button onClick={() => current.refetch()}>Thử lại</Button>} />}
        {snapshotLoading && <Skeleton active />}
        {!snapshotLoading && !current.error && !snapshot && (
          <Empty description="Chưa có bản tạm tính. Bấm “Tạo bản tạm tính” để tính bảng theo kết quả hiện có." />
        )}
        {snapshot && (
          <>
            <RankingBoardStats summary={summary} loading={summaryQuery.isLoading || summaryQuery.isPlaceholderData} />
            <RankingBoardTable key={snapshot.id} snapshotId={snapshot.id} hasPrevious={Boolean(summary?.previous)} />
          </>
        )}
      </Flex>
    </>
  );
}
