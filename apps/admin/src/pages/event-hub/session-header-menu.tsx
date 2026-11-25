import { EllipsisOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { useConfirmAction } from '../../components/confirm-action-button';
import type { SessionRecord } from './schedule-types';

interface SessionHeaderMenuProps {
  session: SessionRecord;
  onAdd: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}

/** "..." menu next to the session pills: add, edit and delete a session. */
export function SessionHeaderMenu({ session, onAdd, onEdit, onDelete }: SessionHeaderMenuProps) {
  const confirm = useConfirmAction();
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'add', label: 'Thêm buổi thi đấu', onClick: onAdd },
          { key: 'edit', label: 'Sửa buổi này', onClick: onEdit },
          {
            key: 'delete',
            label: 'Xóa buổi này',
            danger: true,
            onClick: () =>
              confirm({ title: `Xóa buổi ${session.code}?`, content: 'Chỉ xóa được buổi chưa có trận nào.', okText: 'Xóa buổi', danger: true, onConfirm: onDelete }),
          },
        ],
      }}
    >
      <Button icon={<EllipsisOutlined />} aria-label="Quản lý buổi thi đấu" />
    </Dropdown>
  );
}
