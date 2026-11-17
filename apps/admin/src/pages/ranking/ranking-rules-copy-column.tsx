import { CopyOutlined } from '@ant-design/icons';
import { Button, Flex, Popover, Select, Typography } from 'antd';
import { useState } from 'react';
import type { RuleEventType } from './use-ranking-rules-matrix';

const PICKER_WIDTH = 240;

interface CopyColumnProps {
  eventTypes: RuleEventType[];
  onCopy: (fromId: string, toId: string) => void;
  disabled?: boolean;
}

/** Fills the target column from the source column in the editor only; nothing is saved. */
export function RankingRulesCopyColumn({ eventTypes, onCopy, disabled }: CopyColumnProps) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string>();
  const [to, setTo] = useState<string>();
  const options = eventTypes.map((eventType) => ({ value: eventType.id, label: eventType.name }));

  const apply = () => {
    if (!from || !to) return;
    onCopy(from, to);
    setOpen(false);
  };

  return (
    <Popover
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      title="Sao chép cột"
      content={
        <Flex vertical gap="small" style={{ width: PICKER_WIDTH }}>
          <Typography.Text type="secondary">Chép điểm từ hạng giải (ô trống ở cột nguồn được bỏ qua)</Typography.Text>
          <Select value={from} onChange={setFrom} options={options.filter((option) => option.value !== to)} placeholder="Hạng giải nguồn" aria-label="Hạng giải nguồn" />
          <Typography.Text type="secondary">sang hạng giải</Typography.Text>
          <Select value={to} onChange={setTo} options={options.filter((option) => option.value !== from)} placeholder="Hạng giải đích" aria-label="Hạng giải đích" />
          <Button type="primary" disabled={!from || !to} onClick={apply}>
            Sao chép
          </Button>
        </Flex>
      }
    >
      <Button icon={<CopyOutlined />} disabled={disabled}>Sao chép cột từ…</Button>
    </Popover>
  );
}
