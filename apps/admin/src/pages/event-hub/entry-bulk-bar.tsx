import { DownOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Flex, Typography, theme } from 'antd';
import { ApiError, apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';
import { QUOTA_OPTIONS, showWarnings, type EntryStage, type EntryWriteResult, type QuotaType } from './entry-labels';

interface EntryBulkBarProps {
  ids: string[];
  hasQualifying: boolean;
  onDone: () => Promise<unknown>;
  onClear: () => void;
}

type BulkBody = { action: 'withdraw' } | { action: 'setStage'; stage: EntryStage } | { action: 'setQuota'; quotaType: QuotaType };

export function EntryBulkBar({ ids, hasQualifying, onDone, onClear }: EntryBulkBarProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();

  const send = async (body: BulkBody) => {
    const res = await apiFetch<EntryWriteResult<{ updated: number }>>('/admin/entries/bulk', { method: 'POST', body: { ids, ...body } });
    message.success(`Đã cập nhật ${res.data.updated} đăng ký`);
    showWarnings(message, res.warnings);
    await onDone();
  };
  const run = (body: BulkBody) => () =>
    void send(body).catch((error: unknown) => message.error(error instanceof ApiError ? error.message : 'Không thực hiện được'));

  return (
    <Flex
      gap="small"
      align="center"
      wrap
      style={{ padding: token.paddingXS, background: token.colorPrimaryBg, borderRadius: token.borderRadius }}
    >
      <Typography.Text strong>Đã chọn {ids.length}</Typography.Text>
      <ConfirmActionButton
        label="Rút"
        title={`Rút ${ids.length} đăng ký?`}
        content="Đăng ký đã rút vẫn nằm trong danh sách (hiện mờ) và khôi phục được."
        okText="Rút"
        danger
        buttonProps={{ size: 'small' }}
        onConfirm={() => send({ action: 'withdraw' })}
      />
      {hasQualifying && (
        <>
          <Button size="small" onClick={run({ action: 'setStage', stage: 'QUALIFYING' })}>
            Chuyển vòng loại
          </Button>
          <Button size="small" onClick={run({ action: 'setStage', stage: 'MAIN' })}>
            Chuyển vòng chính
          </Button>
        </>
      )}
      <Dropdown
        trigger={['click']}
        menu={{ items: QUOTA_OPTIONS.map((option) => ({ key: option.value, label: option.label, onClick: run({ action: 'setQuota', quotaType: option.value }) })) }}
      >
        <Button size="small">
          Đổi suất <DownOutlined />
        </Button>
      </Dropdown>
      <Button size="small" type="link" onClick={onClear}>
        Bỏ chọn
      </Button>
    </Flex>
  );
}
