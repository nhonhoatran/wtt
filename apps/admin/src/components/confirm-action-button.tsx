import { App, Button, type ButtonProps } from 'antd';
import { useCallback, type ReactNode } from 'react';
import { ApiError } from '../api/http-client';

/** Vietnamese names for the dependant counts the API returns with a 409 IN_USE. Unknown keys are shown raw. */
const DEPENDANT_LABELS: Record<string, string> = {
  events: 'giải',
  subEvents: 'nội dung thi đấu',
  eventTypes: 'hạng giải',
  tables: 'bàn',
  matches: 'trận đấu',
  registrations: 'lượt đăng ký',
};

export interface ConfirmActionOptions {
  title: string;
  content?: ReactNode;
  okText: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  /** When given, an IN_USE refusal offers "Ẩn thay vì xóa" which runs this. */
  onHide?: () => Promise<void>;
}

function DependantList({ dependants }: { dependants: Record<string, number> }) {
  const entries = Object.entries(dependants);
  return (
    <>
      <p>Mục này đang được dùng bởi:</p>
      <ul>
        {entries.map(([key, count]) => (
          <li key={key}>
            {count} {DEPENDANT_LABELS[key] ?? key}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Opens a confirm modal; a 409 IN_USE answer turns into a second modal that offers hiding instead. */
export function useConfirmAction(): (options: ConfirmActionOptions) => void {
  const { modal, message } = App.useApp();

  return useCallback(
    (options: ConfirmActionOptions) => {
      const fail = (error: unknown) => message.error(error instanceof ApiError ? error.message : 'Không thực hiện được');

      const offerHide = (error: ApiError) => {
        const content = <DependantList dependants={error.dependants ?? {}} />;
        if (!options.onHide) {
          modal.info({ title: 'Không xóa được vì đang được dùng', content, okText: 'Đã hiểu' });
          return;
        }
        const hide = options.onHide;
        modal.confirm({
          title: 'Không xóa được vì đang được dùng',
          content,
          okText: 'Ẩn thay vì xóa',
          cancelText: 'Đóng',
          onOk: async () => {
            try {
              await hide();
            } catch (hideError) {
              fail(hideError);
            }
          },
        });
      };

      modal.confirm({
        title: options.title,
        content: options.content,
        okText: options.okText,
        cancelText: 'Hủy',
        okButtonProps: { danger: options.danger },
        onOk: async () => {
          try {
            await options.onConfirm();
          } catch (error) {
            if (error instanceof ApiError && error.statusCode === 409 && error.code === 'IN_USE') offerHide(error);
            else fail(error);
          }
        },
      });
    },
    [modal, message],
  );
}

export interface ConfirmActionButtonProps {
  label: ReactNode;
  title: string;
  content?: ReactNode;
  okText: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onHide?: () => Promise<void>;
  buttonProps?: ButtonProps;
}

export function ConfirmActionButton({ label, title, content, okText, danger, onConfirm, onHide, buttonProps }: ConfirmActionButtonProps) {
  const confirm = useConfirmAction();
  return (
    <Button {...buttonProps} danger={danger ?? buttonProps?.danger} onClick={() => confirm({ title, content, okText, danger, onConfirm, onHide })}>
      {label}
    </Button>
  );
}
