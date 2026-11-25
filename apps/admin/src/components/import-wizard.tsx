import { InboxOutlined } from '@ant-design/icons';
import { Alert, Flex, Progress, Upload, theme } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { ApiError, apiFetch } from '../api/http-client';
import { putImportFile } from '../api/upload-import-file';
import { formatFileSize } from '../resources/imports/import-labels';

interface ImportUploadStepProps {
  eventId: string;
  /** The file is stored and queued for checking; the host follows the job from here. */
  onJobCreated: (jobId: string) => void;
}

/** Step 1 of the Excel import: pick a file, upload it, hand the job id to the host. */
export function ImportUploadStep({ eventId, onJobCreated }: ImportUploadStepProps) {
  const { token } = theme.useToken();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const upload = async (file: File) => {
    setError(null);
    setProgress(0);
    try {
      const job = (
        await apiFetch<{ data: { id: string; maxBytes: number } }>('/admin/imports', {
          method: 'POST',
          body: { eventId, fileName: file.name, fileSize: file.size },
        })
      ).data;
      if (file.size > job.maxBytes) throw new Error(`File ${formatFileSize(file.size)} vượt giới hạn ${formatFileSize(job.maxBytes)}. Chia nhỏ file rồi thử lại.`);
      await putImportFile(job.id, file, setProgress);
      await apiFetch(`/admin/imports/${job.id}/uploaded`, { method: 'POST', body: {} });
      if (mounted.current) onJobCreated(job.id);
    } catch (failure) {
      if (!mounted.current) return;
      setProgress(null);
      setError(failure instanceof ApiError || failure instanceof Error ? failure.message : 'Không tải được file lên');
    }
  };

  const uploading = progress !== null;

  return (
    <Flex vertical gap={token.margin}>
      {error && <Alert type="error" showIcon message={error} />}
      <Upload.Dragger
        accept=".xlsx"
        multiple={false}
        showUploadList={false}
        disabled={uploading}
        beforeUpload={(file) => {
          void upload(file);
          return false;
        }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Kéo file Excel (.xlsx) vào đây hoặc bấm để chọn</p>
        <p className="ant-upload-hint">Chưa có file? Bấm "Tải file mẫu" ở trên. Sau khi tải lên, hệ thống tự kiểm tra từng dòng; bạn xem lại trước khi nhập.</p>
      </Upload.Dragger>
      {uploading && <Progress percent={progress} status="active" />}
    </Flex>
  );
}
