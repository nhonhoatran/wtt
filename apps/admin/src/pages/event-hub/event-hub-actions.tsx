import { App, Space } from 'antd';
import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import type { EventRecord } from '../../resources/events/event-labels';

interface EventHubActionsProps {
  event: EventRecord;
  canUpdate: boolean;
  canPublish: boolean;
  onChanged: () => Promise<unknown>;
}

/** Publish and cancel are state flips on the API; both are reversible, cancelling is the one marked as risky. */
export function EventHubActions({ event, canUpdate, canPublish, onChanged }: EventHubActionsProps) {
  const { message } = App.useApp();
  const run = (action: string, done: string) => async () => {
    await apiFetch(`/admin/events/${event.id}/${action}`, { method: 'POST' });
    await onChanged();
    message.success(done);
  };
  const published = event.publishStatus === 'PUBLISHED';

  return (
    <Space wrap>
      {canPublish &&
        (published ? (
          <ConfirmActionButton
            label="Bỏ công bố"
            title="Bỏ công bố giải?"
            content="Giải sẽ ẩn khỏi site công khai."
            okText="Bỏ công bố"
            onConfirm={run('unpublish', 'Đã bỏ công bố')}
          />
        ) : (
          <ConfirmActionButton
            label="Công bố"
            title="Công bố giải?"
            content="Giải sẽ hiện trên site công khai."
            okText="Công bố"
            buttonProps={{ type: 'primary' }}
            onConfirm={run('publish', 'Đã công bố giải')}
          />
        ))}
      {canUpdate &&
        (event.isCancelled ? (
          <ConfirmActionButton
            label="Bỏ hủy"
            title="Bỏ hủy giải?"
            content="Giải quay lại trạng thái theo ngày diễn ra."
            okText="Bỏ hủy"
            onConfirm={run('uncancel', 'Đã bỏ hủy giải')}
          />
        ) : (
          <ConfirmActionButton
            label="Hủy giải"
            title="Hủy giải?"
            content="Giải sẽ chuyển sang trạng thái Đã hủy."
            okText="Hủy giải"
            danger
            onConfirm={run('cancel', 'Đã hủy giải')}
          />
        ))}
    </Space>
  );
}
