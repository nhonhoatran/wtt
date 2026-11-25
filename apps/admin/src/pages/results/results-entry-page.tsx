import { Button, Empty, Flex, Result, Select, Skeleton, Typography } from 'antd';
import { useSearchParams } from 'react-router';
import { ResultsWorkspace } from './results-workspace';
import { useResultsEvent } from './use-results-event';

const EVENT_SELECT_MIN_WIDTH = 260;

export function ResultsEntryPage() {
  const events = useResultsEvent();
  const { selected } = events;
  const [, setParams] = useSearchParams();

  if (events.isLoading) return <Skeleton active />;
  if (events.isError) return <Result status="error" title="Không tải được danh sách giải" extra={<Button onClick={() => events.refetch()}>Thử lại</Button>} />;
  if (!selected) return <Empty description="Chưa có giải nào" />;

  return (
    <Flex vertical gap="middle">
      <Typography.Title level={3} style={{ margin: 0 }}>
        Nhập tỷ số
      </Typography.Title>
      <Select
        aria-label="Giải đấu"
        value={selected.id}
        options={events.options.map((event) => ({ value: event.id, label: event.name }))}
        onChange={(id) => {
          events.select(id);
          setParams({ event: id }, { replace: true });
        }}
        style={{ minWidth: EVENT_SELECT_MIN_WIDTH, maxWidth: '100%', alignSelf: 'flex-start' }}
        showSearch
        filterOption={false}
        onSearch={events.onSearch}
        loading={events.searching}
      />
      <ResultsWorkspace key={selected.id} event={selected} />
    </Flex>
  );
}
