import type { AppSettingEditor } from '@kamito/shared';
import { Button, Form, Space, Tag } from 'antd';
import type { ReactNode } from 'react';
import {
  BooleanSettingEditor,
  EventSettingEditor,
  NumberSettingEditor,
  TextSettingEditor,
  TimezoneSettingEditor,
} from './settings-editors/setting-value-editors';

export type SettingValue = number | string | boolean | null;

export interface SettingView {
  key: string;
  group: string;
  label: string;
  description: string;
  editor: AppSettingEditor;
  defaultValue: SettingValue;
  value: SettingValue;
  isDefault: boolean;
  updatedAt: string | null;
}

function renderEditor(editor: AppSettingEditor): ReactNode {
  switch (editor.kind) {
    case 'number':
      return <NumberSettingEditor min={editor.min} max={editor.max} unit={editor.unit} />;
    case 'text':
      return <TextSettingEditor maxLength={editor.maxLength} />;
    case 'boolean':
      return <BooleanSettingEditor />;
    case 'timezone':
      return <TimezoneSettingEditor />;
    case 'event':
      return <EventSettingEditor />;
  }
}

function describeDefault(item: SettingView): string {
  const { editor, defaultValue } = item;
  if (editor.kind === 'boolean') return defaultValue ? 'Bật' : 'Tắt';
  if (editor.kind === 'event') return defaultValue ? String(defaultValue) : 'Tự động chọn';
  if (editor.kind === 'number') return `${defaultValue} ${editor.unit}`;
  return String(defaultValue);
}

function ruleFor(editor: AppSettingEditor) {
  if (editor.kind === 'number') {
    return [
      { required: true, message: 'Nhập giá trị' },
      { type: 'number' as const, min: editor.min, max: editor.max, message: `Trong khoảng ${editor.min}–${editor.max} ${editor.unit}` },
    ];
  }
  if (editor.kind === 'text' || editor.kind === 'timezone') return [{ required: true, message: 'Nhập giá trị' }];
  return [];
}

export function SettingField({ item, onReset }: { item: SettingView; onReset: () => void }) {
  return (
    <Form.Item
      label={
        <Space size="small">
          {item.label}
          {!item.isDefault && <Tag color="gold">Đã chỉnh</Tag>}
        </Space>
      }
      extra={
        <Space size="small" wrap>
          <span>{item.description}</span>
          <span>Mặc định: {describeDefault(item)}.</span>
          {!item.isDefault && (
            <Button type="link" size="small" onClick={onReset} style={{ padding: 0 }}>
              Khôi phục mặc định
            </Button>
          )}
        </Space>
      }
    >
      <Form.Item name={item.key} noStyle valuePropName={item.editor.kind === 'boolean' ? 'checked' : 'value'} rules={ruleFor(item.editor)}>
        {renderEditor(item.editor)}
      </Form.Item>
    </Form.Item>
  );
}
