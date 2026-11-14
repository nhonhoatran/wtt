import { DownloadOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Space } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { apiUrl } from '../../api/api-url';

// The shared warning labels say "Đã lưu", but a refresh saves nothing.
const REFRESH_DELAYED_TEXT = 'Đã gửi yêu cầu, trang công khai có thể cập nhật chậm hơn';

interface ScheduleActionsProps {
  eventId: string;
  sessionId: string | undefined;
  canUpdate: boolean;
}

export const printSheetsPath = (eventId: string, sessionId: string, tableId?: string) =>
  `/events/${eventId}/print/match-sheets?${new URLSearchParams({ sessionId, ...(tableId && { tableId }) })}`;

/** Print, public-site refresh and Excel export buttons of the schedule tab. */
export function ScheduleActions({ eventId, sessionId, canUpdate }: ScheduleActionsProps) {
  const { message } = App.useApp();
  const [refreshing, setRefreshing] = useState(false);

  const refreshPublic = async () => {
    setRefreshing(true);
    try {
      const res = await apiFetch<{ warnings?: string[] }>(`/admin/events/${eventId}/revalidate`, { method: 'POST' });
      if (res.warnings?.length) message.warning(REFRESH_DELAYED_TEXT);
      else message.success('Đã gửi yêu cầu làm mới trang công khai');
    } catch (error) {
      message.error(error instanceof ApiError ? error.message : 'Không làm mới được trang công khai');
    } finally {
      setRefreshing(false);
    }
  };

  const exportLink = (kind: 'schedule' | 'results', label: string) => ({
    key: kind,
    label: <a href={apiUrl(`/admin/exports/${kind}?${new URLSearchParams({ eventId })}`)}>{label}</a>,
  });

  return (
    <Space wrap>
      {sessionId && (
        <Button icon={<PrinterOutlined />} href={printSheetsPath(eventId, sessionId)} target="_blank">
          In phiếu trận
        </Button>
      )}
      {canUpdate && (
        <Button icon={<ReloadOutlined />} loading={refreshing} onClick={() => void refreshPublic()}>
          Làm mới trang công khai
        </Button>
      )}
      <Dropdown menu={{ items: [exportLink('schedule', 'Lịch thi đấu'), exportLink('results', 'Kết quả')] }}>
        <Button icon={<DownloadOutlined />}>Xuất Excel</Button>
      </Dropdown>
    </Space>
  );
}
