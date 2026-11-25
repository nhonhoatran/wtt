import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Grid, Skeleton, Steps, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { eventProgressSteps, remainingStepsText, type EventProgress } from './event-progress-steps';

interface EventProgressStepperProps {
  eventId: string;
  progress: EventProgress | undefined;
  loading: boolean;
}

/** Preparation indicator: each step opens its tab; it never gates publishing. */
export function EventProgressStepper({ eventId, progress, loading }: EventProgressStepperProps) {
  const navigate = useNavigate();
  const wide = Grid.useBreakpoint().md ?? false;
  const [collapsedByUser, setCollapsedByUser] = useState<boolean>();

  if (!progress) {
    return loading ? <Card size="small"><Skeleton active paragraph={{ rows: 1 }} /></Card> : null;
  }
  const steps = eventProgressSteps(progress);
  const allDone = steps.every((step) => step.status === 'finish');
  const collapsed = collapsedByUser ?? allDone;
  const current = Math.max(0, steps.findIndex((step) => step.status !== 'finish'));

  return (
    <Card size="small" aria-label="Tiến độ chuẩn bị">
      <Flex justify="space-between" align="center" gap="small" wrap>
        <Flex align="baseline" gap="small" wrap>
          <Typography.Text strong>Tiến độ chuẩn bị</Typography.Text>
          <Typography.Text type="secondary">{remainingStepsText(steps)}</Typography.Text>
        </Flex>
        <Button type="text" size="small" aria-expanded={!collapsed} icon={collapsed ? <DownOutlined /> : <UpOutlined />} onClick={() => setCollapsedByUser(!collapsed)}>
          {collapsed ? 'Mở rộng' : 'Thu gọn'}
        </Button>
      </Flex>
      {!collapsed && (
        <Steps
          style={{ marginTop: 16 }}
          size="small"
          direction={wide ? 'horizontal' : 'vertical'}
          current={current}
          onChange={(index) => navigate(`/events/${eventId}/${steps[index]!.tab}`)}
          items={steps.map((step) => ({ title: step.title, description: step.caption, status: step.status }))}
        />
      )}
    </Card>
  );
}
