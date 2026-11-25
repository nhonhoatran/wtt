import { DownloadOutlined, FileExcelOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Space } from 'antd';
import { apiUrl } from '../../api/api-url';

interface EntriesToolbarProps {
  eventId: string;
  subEventId: string;
  canCreate: boolean;
  addOpen: boolean;
  importOpen: boolean;
  onToggleAdd: () => void;
  onToggleImport: () => void;
}

export function EntriesToolbar({ eventId, subEventId, canCreate, addOpen, importOpen, onToggleAdd, onToggleImport }: EntriesToolbarProps) {
  const templateHref = apiUrl(`/admin/imports/template?eventId=${encodeURIComponent(eventId)}`);
  const exportHref = apiUrl(`/admin/exports/entries?${new URLSearchParams({ eventId, subEventId })}`);
  return (
    <Space wrap>
      <Button icon={<FileExcelOutlined />} href={templateHref}>
        Tải file mẫu
      </Button>
      <Button icon={<DownloadOutlined />} href={exportHref}>
        Xuất Excel
      </Button>
      {canCreate && (
        <>
          <Button icon={<UploadOutlined />} type={importOpen ? 'primary' : 'default'} aria-pressed={importOpen} onClick={onToggleImport}>
            Nhập từ Excel
          </Button>
          <Button type={addOpen ? 'default' : 'primary'} icon={<PlusOutlined />} aria-expanded={addOpen} onClick={onToggleAdd}>
            Thêm VĐV
          </Button>
        </>
      )}
    </Space>
  );
}
