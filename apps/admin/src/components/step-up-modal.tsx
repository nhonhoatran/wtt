import { Form, Input, Modal } from 'antd';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '../api/http-client';

type RunWithStepUp = <T>(action: () => Promise<T>) => Promise<T>;

const StepUpContext = createContext<RunWithStepUp | null>(null);

/**
 * Wraps a sensitive call: if the API answers STEP_UP_REQUIRED, asks for the password in a small
 * modal and retries the same call, so whatever the user was typing on the page stays untouched.
 */
export function StepUpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ password: string }>();
  const waiter = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  const run = useCallback<RunWithStepUp>(async (action) => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'STEP_UP_REQUIRED') throw error;
      await new Promise<void>((resolve, reject) => {
        waiter.current = { resolve, reject };
        form.resetFields();
        setOpen(true);
      });
      return action();
    }
  }, [form]);

  const submit = async () => {
    const { password } = await form.validateFields();
    setSubmitting(true);
    try {
      await apiFetch('/auth/step-up', { method: 'POST', body: { password } });
      setOpen(false);
      waiter.current?.resolve();
    } catch (error) {
      const message = error instanceof ApiError ? (error.errors?.password ?? error.message) : 'Không xác nhận được';
      form.setFields([{ name: 'password', errors: [message] }]);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = () => {
    setOpen(false);
    waiter.current?.reject(new Error('Đã hủy xác nhận mật khẩu'));
  };

  return (
    <StepUpContext.Provider value={run}>
      {children}
      <Modal
        open={open}
        title="Nhập lại mật khẩu để tiếp tục"
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={submitting}
        onOk={submit}
        onCancel={cancel}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          <Form.Item name="password" label="Mật khẩu của bạn" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password autoFocus autoComplete="current-password" />
          </Form.Item>
        </Form>
      </Modal>
    </StepUpContext.Provider>
  );
}

export function useStepUp(): RunWithStepUp {
  const run = useContext(StepUpContext);
  if (!run) throw new Error('useStepUp must be used inside StepUpProvider');
  return run;
}
