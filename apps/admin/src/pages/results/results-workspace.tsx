import { App, Flex, Table } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { nextOnTable } from './match-slot-order';
import { matchNavigation, type NavTarget } from './match-navigation';
import { MatchScoreDrawer } from './match-score-drawer';
import { firstOpenMatch, type MatchListItem } from './match-types';
import { ResultsFilters } from './results-filters';
import { resultsColumns } from './results-match-columns';
import type { PickerEvent } from './use-results-event';
import { useResultsList } from './use-results-list';

const MATCH_PARAM = 'match';

/** Match list plus the score drawer for one event; the `?match=` param deep-links straight into a match. */
export function ResultsWorkspace({ event }: { event: PickerEvent }) {
  const list = useResultsList(event);
  const { rows, matches, page, pageSize, schedule } = list;
  const { message } = App.useApp();
  const [params, setParams] = useSearchParams();
  const [openId, setOpenState] = useState<string | null>(() => params.get(MATCH_PARAM));
  const nextId = firstOpenMatch(rows)?.id;
  const total = matches.data?.total ?? 0;

  const setOpenId = (id: string | null) => {
    setOpenState(id);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set(MATCH_PARAM, id);
        else next.delete(MATCH_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  const navigation = useMemo(
    () => matchNavigation((rows ?? []).map((row) => row.id), openId, page, pageSize, total),
    [rows, openId, page, pageSize, total],
  );

  const goTo = async (target: NavTarget | null) => {
    if (!target) return;
    if (target.kind === 'row') return setOpenId(target.id);
    try {
      const result = await list.fetchPage(target.page);
      const ordered = list.order(result.data);
      const pick = target.pick === 'first' ? ordered[0] : ordered.at(-1);
      list.setPage(target.page);
      setOpenId(pick?.id ?? null);
    } catch {
      void message.error('Không tải được trang kế tiếp, thử lại sau');
    }
  };

  // Players stay at the table they just played on, so its next match comes first; the list order is the fallback.
  const openNext = async (finishedTableId: string | null) => {
    const fresh = await matches.refetch();
    let sameTable: MatchListItem | undefined;
    if (finishedTableId) {
      sameTable = await nextOnTable({ eventId: event.id, tableId: finishedTableId, sessionId: schedule.sessionId, pageSize }).catch(() => undefined);
    }
    const fallback = firstOpenMatch(fresh.data ? list.order(fresh.data.data) : undefined);
    setOpenId((sameTable ?? fallback)?.id ?? null);
  };

  const onForeignMatch = () => {
    void message.warning('Trận này không thuộc giải đang chọn');
    setOpenId(null);
  };

  return (
    <Flex vertical gap="middle">
      <ResultsFilters list={list} />
      <Table<MatchListItem>
        rowKey="id"
        scroll={{ x: true }}
        size="middle"
        loading={matches.isFetching}
        dataSource={rows}
        locale={{ emptyText: matches.isError ? 'Không tải được danh sách trận' : 'Không có trận nào' }}
        rowClassName={(row) => (row.id === nextId ? 'ant-table-row-selected' : '')}
        pagination={{ current: page, pageSize, total, showSizeChanger: false, onChange: list.setPage }}
        onRow={(row) => ({
          onClick: () => setOpenId(row.id),
          onKeyDown: (keyEvent) => keyEvent.key === 'Enter' && setOpenId(row.id),
          tabIndex: 0,
          style: { cursor: 'pointer' },
        })}
        columns={resultsColumns(event.timezone, nextId)}
      />
      <MatchScoreDrawer
        matchId={openId}
        eventId={event.id}
        timeZone={event.timezone}
        navigation={navigation && { ...navigation, scope: list.status === 'OPEN' ? 'chờ kết quả' : 'trong danh sách' }}
        onNavigate={(direction) => void goTo(direction === 'prev' ? navigation?.prev ?? null : navigation?.next ?? null)}
        onClose={() => setOpenId(null)}
        onForeignMatch={onForeignMatch}
        onStarted={() => void matches.refetch()}
        onConfirmed={(tableId) => void openNext(tableId)}
        onReload={() => void matches.refetch()}
      />
    </Flex>
  );
}
