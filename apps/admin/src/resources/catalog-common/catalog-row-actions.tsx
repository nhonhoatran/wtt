import { MoreOutlined } from '@ant-design/icons';
import { EditButton } from '@refinedev/antd';
import { useInvalidate } from '@refinedev/core';
import { App, Button, Dropdown, Space, type MenuProps } from 'antd';
import { apiFetch } from '../../api/http-client';
import { useConfirmAction } from '../../components/confirm-action-button';
import { useInvalidateCatalogOptions } from '../events/use-catalog-options';
import { useCatalogAccess } from './catalog-access';

export interface CatalogRowActionsProps {
  /** Refine resource name, which is also the /admin/<resource> API path. */
  resource: string;
  record: { id: string; isActive: boolean; isDefault?: boolean };
  /** Shown in confirm texts. */
  name: string;
  /** Rows that can be the single default show "Đặt làm mặc định". */
  supportsDefault?: boolean;
  /** Permission resource checked for edit/hide/delete; defaults to "tournaments". */
  permission?: string;
}

export function CatalogRowActions({ resource, record, name, supportsDefault, permission }: CatalogRowActionsProps) {
  const { message } = App.useApp();
  const invalidate = useInvalidate();
  const invalidateOptions = useInvalidateCatalogOptions();
  const confirm = useConfirmAction();
  const { canUpdate, canDelete } = useCatalogAccess(permission);
  const path = `/admin/${resource}/${record.id}`;

  const refresh = () => Promise.all([invalidate({ resource, invalidates: ['list', 'detail'], id: record.id }), invalidateOptions()]);
  const patch = async (body: Record<string, unknown>, done: string) => {
    await apiFetch(path, { method: 'PATCH', body });
    await refresh();
    message.success(done);
  };
  const setActive = (isActive: boolean) => patch({ isActive }, isActive ? `Đã hiện lại "${name}"` : `Đã ẩn "${name}"`);

  const items: NonNullable<MenuProps['items']> = [];
  if (canUpdate && supportsDefault && !record.isDefault && record.isActive) {
    items.push({
      key: 'default',
      label: 'Đặt làm mặc định',
      onClick: () =>
        confirm({
          title: `Đặt "${name}" làm mặc định?`,
          okText: 'Đặt mặc định',
          onConfirm: () => patch({ isDefault: true }, `Đã đặt "${name}" làm mặc định`),
        }),
    });
  }
  if (canUpdate) {
    items.push(
      record.isActive
        ? {
            key: 'hide',
            label: 'Ẩn',
            onClick: () =>
              confirm({
                title: `Ẩn "${name}"?`,
                content: 'Mục bị ẩn không được chọn cho dữ liệu mới, dữ liệu cũ vẫn giữ nguyên.',
                okText: 'Ẩn',
                onConfirm: () => setActive(false),
              }),
          }
        : { key: 'show', label: 'Hiện lại', onClick: () => void setActive(true).catch((e: Error) => message.error(e.message)) },
    );
  }
  if (canDelete) {
    items.push({
      key: 'delete',
      danger: true,
      label: 'Xóa',
      onClick: () =>
        confirm({
          title: `Xóa "${name}"?`,
          content: 'Không khôi phục được sau khi xóa.',
          okText: 'Xóa',
          danger: true,
          onConfirm: async () => {
            await apiFetch(path, { method: 'DELETE' });
            await refresh();
            message.success(`Đã xóa "${name}"`);
          },
          onHide: () => setActive(false),
        }),
    });
  }

  return (
    <Space size="small">
      {canUpdate && <EditButton hideText size="small" resource={resource} recordItemId={record.id} />}
      {items.length > 0 && (
        <Dropdown menu={{ items }} trigger={['click']}>
          <Button size="small" icon={<MoreOutlined />} aria-label="Thao tác khác" />
        </Dropdown>
      )}
    </Space>
  );
}
