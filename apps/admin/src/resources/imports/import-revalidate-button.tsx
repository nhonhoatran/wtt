import { apiFetch } from '../../api/http-client';
import { ConfirmActionButton } from '../../components/confirm-action-button';

interface ImportRevalidateButtonProps {
  importId: string;
  onStarted: () => Promise<unknown>;
}

export function ImportRevalidateButton({ importId, onStarted }: ImportRevalidateButtonProps) {
  const run = async () => {
    await apiFetch(`/admin/imports/${importId}/validate`, { method: 'POST', body: {} });
    await onStarted();
  };

  return (
    <ConfirmActionButton
      label="Kiểm tra lại"
      title="Kiểm tra lại file này?"
      content="Hệ thống đọc lại file và kiểm tra từ đầu; các lựa chọn VĐV đã chọn sẽ phải chọn lại."
      okText="Kiểm tra lại"
      onConfirm={run}
    />
  );
}
