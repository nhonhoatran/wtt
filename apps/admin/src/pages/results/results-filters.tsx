import { Flex, Input, Select } from 'antd';
import { sessionDatedLabel } from '../event-hub/schedule-types';
import { subEventTitle } from '../event-hub/sub-event-labels';
import { STATUS_FILTER_OPTIONS } from './match-types';
import type { ResultsList } from './use-results-list';

const SUB_EVENT_SELECT_MIN_WIDTH = 200;
const SESSION_SELECT_MIN_WIDTH = 220;
const TABLE_SELECT_MIN_WIDTH = 140;
const STATUS_SELECT_WIDTH = 150;
const SEARCH_WIDTH = 260;

export function ResultsFilters({ list }: { list: ResultsList }) {
  const { schedule } = list;
  return (
    <Flex wrap gap="small">
      <Select
        aria-label="Nội dung"
        allowClear
        placeholder="Tất cả nội dung"
        value={list.subEventId}
        options={list.subEvents.map((row) => ({ value: row.id, label: subEventTitle(row) }))}
        onChange={list.onSubEvent}
        style={{ minWidth: SUB_EVENT_SELECT_MIN_WIDTH }}
      />
      <Select
        aria-label="Buổi thi đấu"
        allowClear
        placeholder="Tất cả buổi"
        value={schedule.sessionId}
        options={schedule.sessions.map((row) => ({ value: row.id, label: sessionDatedLabel(row) }))}
        onChange={list.onSession}
        style={{ minWidth: SESSION_SELECT_MIN_WIDTH }}
      />
      <Select aria-label="Bàn" allowClear placeholder="Tất cả bàn" value={schedule.tableId} options={schedule.tables} onChange={list.onTable} style={{ minWidth: TABLE_SELECT_MIN_WIDTH }} />
      <Select aria-label="Trạng thái" value={list.status} options={STATUS_FILTER_OPTIONS} onChange={list.onStatus} style={{ width: STATUS_SELECT_WIDTH }} />
      <Input.Search allowClear placeholder="Tên VĐV hoặc số trận" value={list.search} onChange={(event) => list.onSearch(event.target.value)} style={{ width: SEARCH_WIDTH }} />
    </Flex>
  );
}
