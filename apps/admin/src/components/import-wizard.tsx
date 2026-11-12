import { DownloadOutlined, InboxOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Modal, Progress, Steps, Typography, Upload, theme } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { apiUrl } from '../api/api-url';
import { ApiError, apiFetch } from '../api/http-client';
import { putImportFile } from '../api/upload-import-file';
import { formatFileSize } from '../resources/imports/import-labels';

const STEP_ITEMS = [{ title: 'Tải mẫu' }, { title: 'Tải file lên' }, { title: 'Kiểm tra & nhập' }];

export function ImportStepsBar({ current }: { current: number }) {
  return <Steps size="small" current={current} items={STEP_ITEMS} />;
}

interface ImportWizardProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
}

/** Steps 1–2 live here; step 3 is the job page /imports/:id, which survives a reload while the worker checks the file. */
export function ImportWizard({ eventId, open, onClose }: ImportWizardProps) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep(0);
    setProgress(null);
    setError(null);
  };

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
      onClose();
      navigate(`/imports/${job.id}`);
    } catch (failure) {
      setProgress(null);
      setError(failure instanceof ApiError || failure instanceof Error ? failure.message : 'Không tải được file lên');
    }
  };

  const uploading = progress !== null;

  return (
    <Modal open={open} title="Import danh sách đăng ký từ Excel" footer={null} closable={!uploading} maskClosable={!uploading} keyboard={!uploading} onCancel={onClose} afterClose={reset} width={640} destroyOnHidden>
      <Flex vertical gap={token.margin}>
        <ImportStepsBar current={step} />
        {step === 0 && (
          <>
            <Typography.Paragraph style={{ margin: 0 }}>
              File mẫu có sẵn mã nội dung của giải này và danh sách VĐV đã có (kèm mã) để tra. Điền mỗi dòng một đăng ký; dòng đánh đôi điền cả VĐV 2.
            </Typography.Paragraph>
            <Flex gap="small" wrap>
              <Button icon={<DownloadOutlined />} href={apiUrl(`/admin/imports/template?eventId=${encodeURIComponent(eventId)}`)} onClick={() => setStep(1)}>
                Tải file mẫu
              </Button>
              <Button type="primary" autoFocus onClick={() => setStep(1)}>
                Đã có file, tiếp tục
              </Button>
            </Flex>
          </>
        )}
        {step === 1 && (
          <>
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
              <p className="ant-upload-hint">Sau khi tải lên, hệ thống tự kiểm tra từng dòng; bạn xem lại trước khi nhập.</p>
            </Upload.Dragger>
            {uploading && <Progress percent={progress} status="active" />}
            <Flex justify="start">
              <Button onClick={() => setStep(0)} disabled={uploading}>
                Quay lại
              </Button>
            </Flex>
          </>
        )}
      </Flex>
    </Modal>
  );
}
