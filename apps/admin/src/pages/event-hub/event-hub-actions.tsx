import { EditOutlined, EllipsisOutlined, EyeOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Tooltip, type MenuProps } from 'antd';
import { useNavigate } from 'react-router';
import { apiFetch } from '../../api/http-client';
import { publicEventUrl } from '../../api/public-site-url';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { ConfirmActionButton, useConfirmAction } from '../../components/confirm-action-button';
import type { EventRecord } from '../../resources/events/event-labels';

interface EventHubActionsProps {
  event: EventRecord;
  activeTab: string;
  canUpdate: boolean;
  canPublish: boolean;
  onChanged: () => Promise<unknown>;
}

const DRAFT_PREVIEW_HINT = 'Công bố giải để xem trên trang công khai';

/** Publish is the primary action of a draft; unpublish and cancel are state flips kept in the "…" menu behind a confirm. */
export function EventHubActions({ event, activeTab, canUpdate, canPublish, onChanged }: EventHubActionsProps) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const confirm = useConfirmAction();
  const run = (action: string, done: string) => async () => {
    const response = await apiFetch(`/admin/events/${event.id}/${action}`, { method: 'POST' });
    await onChanged();
    message.success(done);
    showWarnings(message, warningsOf(response));
  };
  const published = event.publishStatus === 'PUBLISHED';
  const publicUrl = publicEventUrl(event.slug);

  const menuItems: NonNullable<MenuProps['items']> = [];
  if (canPublish && published) {
    menuItems.push({
      key: 'unpublish',
      label: 'Bỏ công bố',
      onClick: () => confirm({ title: 'Bỏ công bố giải?', content: 'Giải sẽ ẩn khỏi site công khai.', okText: 'Bỏ công bố', onConfirm: run('unpublish', 'Đã bỏ công bố') }),
    });
  }
  if (canUpdate) {
    menuItems.push(
      event.isCancelled
        ? {
            key: 'uncancel',
            label: 'Bỏ hủy giải',
            onClick: () => confirm({ title: 'Bỏ hủy giải?', content: 'Giải quay lại trạng thái theo ngày diễn ra.', okText: 'Bỏ hủy', onConfirm: run('uncancel', 'Đã bỏ hủy giải') }),
          }
        : {
            key: 'cancel',
            label: 'Hủy giải',
            danger: true,
            onClick: () => confirm({ title: 'Hủy giải?', content: 'Giải sẽ chuyển sang trạng thái Đã hủy.', okText: 'Hủy giải', danger: true, onConfirm: run('cancel', 'Đã hủy giải') }),
          },
    );
  }

  return (
    <>
      {publicUrl &&
        (published ? (
          <Button icon={<EyeOutlined />} href={publicUrl} target="_blank" rel="noopener noreferrer">
            Xem trang giải
          </Button>
        ) : (
          <Tooltip title={DRAFT_PREVIEW_HINT}>
            <span>
              <Button icon={<EyeOutlined />} disabled aria-label={`Xem trang giải. ${DRAFT_PREVIEW_HINT}`}>
                Xem trang giải
              </Button>
            </span>
          </Tooltip>
        ))}
      {canUpdate && activeTab !== 'info' && (
        <Button icon={<EditOutlined />} onClick={() => navigate(`/events/${event.id}/info`)}>
          Sửa thông tin
        </Button>
      )}
      {canPublish && !published && (
        <ConfirmActionButton
          label="Công bố giải"
          title="Công bố giải?"
          content="Giải sẽ hiện trên site công khai."
          okText="Công bố"
          buttonProps={{ type: 'primary' }}
          onConfirm={run('publish', 'Đã công bố giải')}
        />
      )}
      {menuItems.length > 0 && (
        <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
          <Button icon={<EllipsisOutlined />} aria-label="Thao tác khác" />
        </Dropdown>
      )}
    </>
  );
}
