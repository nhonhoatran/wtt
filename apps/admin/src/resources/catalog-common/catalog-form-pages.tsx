import { Create, Edit, useForm } from '@refinedev/antd';
import { Form, Switch } from 'antd';
import type { ReactNode } from 'react';
import { useInvalidateCatalogOptions } from '../events/use-catalog-options';

export const FORM_MAX_WIDTH = 560;

interface CreatePageProps {
  resource: string;
  title: string;
  saveText: string;
  initialValues?: Record<string, unknown>;
  /** Where to go after saving; venues continue to their edit page to add tables. */
  redirect?: 'list' | 'edit';
  /** Called with the API response after a successful save, e.g. to show write warnings. */
  onSaved?: (response: unknown) => void;
  children: ReactNode;
}

export function CatalogCreatePage({ resource, title, saveText, initialValues, redirect = 'list', onSaved, children }: CreatePageProps) {
  const invalidateOptions = useInvalidateCatalogOptions();
  const { formProps, saveButtonProps } = useForm({ resource, action: 'create',
    redirect,
    onMutationSuccess: (response) => {
      void invalidateOptions();
      onSaved?.(response);
    },
  });
  return (
    <Create title={title} saveButtonProps={{ ...saveButtonProps, children: saveText }}>
      <Form {...formProps} layout="vertical" initialValues={{ isActive: true, ...initialValues }} style={{ maxWidth: FORM_MAX_WIDTH }}>
        {children}
      </Form>
    </Create>
  );
}

interface EditPageProps<T> {
  resource: string;
  title: (record?: T) => string;
  children: (record?: T) => ReactNode;
  /** Rendered below the form, e.g. venue tables. */
  footer?: (record?: T) => ReactNode;
  /** Called with the API response after a successful save, e.g. to show write warnings. */
  onSaved?: (response: unknown) => void;
}

export function CatalogEditPage<T extends object>({ resource, title, children, footer, onSaved }: EditPageProps<T>) {
  const invalidateOptions = useInvalidateCatalogOptions();
  const { formProps, saveButtonProps, query } = useForm<T>({ resource, action: 'edit',
    redirect: 'list',
    onMutationSuccess: (response) => {
      void invalidateOptions();
      onSaved?.(response);
    },
  });
  const record = query?.data?.data;
  return (
    <Edit title={title(record)} saveButtonProps={saveButtonProps} deleteButtonProps={{ hidden: true }}>
      <Form {...formProps} layout="vertical" style={{ maxWidth: FORM_MAX_WIDTH }}>
        {children(record)}
      </Form>
      {footer?.(record)}
    </Edit>
  );
}

export function IsActiveField({ extra }: { extra?: string }) {
  return (
    <Form.Item name="isActive" label="Hiển thị" valuePropName="checked" extra={extra ?? 'Tắt để ẩn khỏi danh sách chọn mà vẫn giữ dữ liệu cũ.'}>
      <Switch checkedChildren="Hiện" unCheckedChildren="Ẩn" />
    </Form.Item>
  );
}
