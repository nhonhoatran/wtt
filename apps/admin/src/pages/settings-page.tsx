import { useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Badge, Button, Card, Flex, Form, Result, Skeleton, Tabs, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ApiError, apiFetch } from '../api/http-client';
import { useUnsavedGuard } from './ranking/ranking-rules-unsaved-guard';
import { SettingField, type SettingValue, type SettingView } from './settings-field';

interface SettingsResponse {
  data: SettingView[];
  groups: { key: string; label: string }[];
}

type SettingValues = Record<string, SettingValue>;

const SETTINGS_KEY = ['admin-settings'];
const GROUP_QUERY_PARAM = 'group';
const UNSAVED_MESSAGE = 'Còn cài đặt chưa lưu. Bỏ thay đổi và rời trang?';

// Key order is ignored: jsonb hands objects back with its own key order.
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]))
      : (value ?? null);
const sameValue = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/** /settings: operational values edited without a redeploy; each change is audited by the API. One tab per group, kept in ?group=. */
export function SettingsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<SettingsResponse>('/admin/settings'),
  });
  const [dirtyGroups, setDirtyGroups] = useState<ReadonlySet<string>>(new Set());
  const markDirty = useCallback((group: string, dirty: boolean) => {
    setDirtyGroups((current) => {
      if (current.has(group) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(group);
      else next.delete(group);
      return next;
    });
  }, []);
  useUnsavedGuard(dirtyGroups.size > 0, UNSAVED_MESSAGE, { allowSamePath: true });

  if (isLoading) return <Skeleton active />;
  if (isError || !data) {
    return <Result status="error" title="Không tải được cài đặt" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />;
  }

  /** Returns the values as the API stored them (it trims text), so the form can show what was saved. */
  const saveGroup = async (items: SettingView[], values: SettingValues): Promise<SettingValues> => {
    const changed = items.filter((item) => !sameValue(values[item.key], item.value));
    if (changed.length === 0) {
      message.info('Không có thay đổi nào');
      return {};
    }
    const saved: SettingValues = {};
    try {
      for (const item of changed) {
        try {
          const res = await apiFetch<{ data: { value: SettingValue } }>(`/admin/settings/${encodeURIComponent(item.key)}`, { method: 'PUT', body: { value: values[item.key] } });
          saved[item.key] = res.data.value;
        } catch (error) {
          throw new SettingSaveError(item.key, error);
        }
      }
      message.success(`Đã lưu ${changed.length} cài đặt`);
      return saved;
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
      <Tabs
        activeKey={data.groups.some((group) => group.key === params.get(GROUP_QUERY_PARAM)) ? params.get(GROUP_QUERY_PARAM)! : data.groups[0]?.key}
        onChange={(key) => setParams((current) => { current.set(GROUP_QUERY_PARAM, key); return current; }, { replace: true })}
        items={data.groups.map((group) => ({
          key: group.key,
          label: dirtyGroups.has(group.key) ? <Badge status="warning" text={group.label} title="Có thay đổi chưa lưu" /> : group.label,
          children: (
            <SettingsGroupCard
              items={data.data.filter((item) => item.group === group.key)}
              onSave={saveGroup}
              onReset={resetOne}
              onDirtyChange={(dirty) => markDirty(group.key, dirty)}
            />
          ),
        }))}
      />
    </Flex>
  );
}

interface GroupProps {
  items: SettingView[];
  onSave: (items: SettingView[], values: SettingValues) => Promise<SettingValues>;
  onReset: (item: SettingView) => Promise<void>;
  onDirtyChange: (dirty: boolean) => void;
}

class SettingSaveError extends Error {
  constructor(
    readonly key: string,
    readonly failure: unknown,
  ) {
    super(failure instanceof Error ? failure.message : 'Không lưu được');
  }
}

function SettingsGroupCard({ items, onSave, onReset, onDirtyChange }: GroupProps) {
  const [form] = Form.useForm<SettingValues>();
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const initialValues = Object.fromEntries(items.map((item) => [item.key, item.value]));
  const values = Form.useWatch((all: SettingValues) => all, form);
  const dirty = values !== undefined && items.some((item) => item.key in values && !sameValue(values[item.key], item.value));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const submit = async (values: SettingValues) => {
    setSaving(true);
    try {
      const saved = await onSave(items, values);
      form.setFields(Object.entries(saved).map(([name, value]) => ({ name, value })));
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
    <Card>
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
        <Flex align="center" gap="middle" wrap>
          <Button type="primary" htmlType="submit" loading={saving}>
            Lưu
          </Button>
          {dirty && <Typography.Text type="warning">Có thay đổi chưa lưu</Typography.Text>}
        </Flex>
      </Form>
    </Card>
  );
}
