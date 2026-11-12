import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Flex, Form, Result, Skeleton, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../api/http-client';
import { SettingField, type SettingValue, type SettingView } from './settings-field';

interface SettingsResponse {
  data: SettingView[];
  groups: { key: string; label: string }[];
}

type SettingValues = Record<string, SettingValue>;

const SETTINGS_KEY = ['admin-settings'];

/** /settings: operational values edited without a redeploy; each change is audited by the API. */
export function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<SettingsResponse>('/admin/settings'),
  });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="error" title="Không tải được cài đặt" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />;
  }

  const saveGroup = async (items: SettingView[], values: SettingValues) => {
    const changed = items.filter((item) => values[item.key] !== item.value);
    if (changed.length === 0) {
      message.info('Không có thay đổi nào');
      return;
    }
    try {
      for (const item of changed) {
        try {
          await apiFetch(`/admin/settings/${encodeURIComponent(item.key)}`, { method: 'PUT', body: { value: values[item.key] } });
        } catch (error) {
          throw new SettingSaveError(item.key, error);
        }
      }
      message.success(`Đã lưu ${changed.length} cài đặt`);
    } finally {
      // Earlier PUTs may have succeeded even if a later one failed.
      await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    }
  };

  const resetOne = async (item: SettingView) => {
    await apiFetch(`/admin/settings/${encodeURIComponent(item.key)}`, { method: 'DELETE' });
    await queryClient.invalidateQueries({ queryKey: SETTINGS_KEY });
    message.success(`Đã khôi phục mặc định: ${item.label}`);
  };

  return (
    <Flex vertical gap="large">
      <Typography.Title level={3} style={{ margin: 0 }}>Cài đặt hệ thống</Typography.Title>
      {data.groups.map((group) => {
        const items = data.data.filter((item) => item.group === group.key);
        return (
          <SettingsGroupCard key={group.key} title={group.label} items={items} onSave={saveGroup} onReset={resetOne} />
        );
      })}
    </Flex>
  );
}

interface GroupProps {
  title: string;
  items: SettingView[];
  onSave: (items: SettingView[], values: SettingValues) => Promise<void>;
  onReset: (item: SettingView) => Promise<void>;
}

class SettingSaveError extends Error {
  constructor(
    readonly key: string,
    readonly failure: unknown,
  ) {
    super(failure instanceof Error ? failure.message : 'Không lưu được');
  }
}

function SettingsGroupCard({ title, items, onSave, onReset }: GroupProps) {
  const [form] = Form.useForm<SettingValues>();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const initialValues = Object.fromEntries(items.map((item) => [item.key, item.value]));

  const submit = async (values: SettingValues) => {
    setSaving(true);
    try {
      await onSave(items, values);
    } catch (error) {
      const fieldErrors =
        error instanceof SettingSaveError && error.failure instanceof ApiError ? error.failure.errors : undefined;
      if (error instanceof SettingSaveError && fieldErrors) {
        form.setFields([{ name: error.key, errors: Object.values(fieldErrors) }]);
      } else {
        message.error(error instanceof Error ? error.message : 'Không lưu được');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title={title}>
      <Form form={form} layout="vertical" initialValues={initialValues} onFinish={submit} style={{ maxWidth: 640 }}>
        {items.map((item) => (
          <SettingField
            key={item.key}
            item={item}
            onReset={() =>
              onReset(item)
                .then(() => form.setFieldValue(item.key, item.defaultValue))
                .catch((e: Error) => message.error(e.message))
            }
          />
        ))}
        <Button type="primary" htmlType="submit" loading={saving}>
          Lưu
        </Button>
      </Form>
    </Card>
  );
}
