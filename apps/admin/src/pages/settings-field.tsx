import type { AppSettingEditor } from '@kamito/shared';
import { Button, Form, Space, Tag } from 'antd';
import type { Rule } from 'antd/es/form';
import type { ReactNode } from 'react';
import {
  BooleanSettingEditor,
  ChoiceSettingEditor,
  EventSettingEditor,
  NumberSettingEditor,
  JsonSettingEditor,
  TextSettingEditor,
  TimezoneSettingEditor,
} from './settings-editors/setting-value-editors';
import { BilingualTextSettingEditor } from './settings-editors/bilingual-text-setting-editor';
import { NavItemsSettingEditor } from './settings-editors/nav-items-setting-editor';
import { SocialLinksSettingEditor } from './settings-editors/social-links-setting-editor';
import { validateBilingual, validateNavItems, validateSocialLinks, type BilingualValue, type NavItemValue, type SocialLinkValue } from './settings-editors/structured-setting-validation';

export type SettingValue = unknown;

export interface SettingView {
  key: string;
  group: string;
  label: string;
  description: string;
  editor: AppSettingEditor;
  defaultValue: unknown;
  value: unknown;
  isDefault: boolean;
  updatedAt: string | null;
}

function renderEditor(editor: AppSettingEditor, settingKey: string, label: string): ReactNode {
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
    case 'json':
      return <JsonSettingEditor settingKey={settingKey} />;
    case 'choice':
      return <ChoiceSettingEditor options={editor.options} />;
    case 'bilingual-text':
      return <BilingualTextSettingEditor maxLength={editor.maxLength} nullable={editor.nullable} label={label} />;
    case 'nav-items':
      return <NavItemsSettingEditor options={editor.options} maxItems={editor.maxItems} />;
    case 'social-links':
      return <SocialLinksSettingEditor platforms={editor.platforms} maxItems={editor.maxItems} />;
  }
}

function describeDefault(item: SettingView): string {
  const { editor, defaultValue } = item;
  if (editor.kind === 'boolean') return defaultValue ? 'Bật' : 'Tắt';
  if (editor.kind === 'event') return defaultValue ? String(defaultValue) : 'Tự động chọn';
  if (editor.kind === 'text' && defaultValue === '') return 'Để trống';
  if (editor.kind === 'number') return `${defaultValue} ${editor.unit}`;
  if (editor.kind === 'choice') return editor.options.find((option) => option.value === defaultValue)?.label ?? String(defaultValue);
  if (editor.kind === 'bilingual-text') {
    const text = defaultValue as { vi: string; en: string } | null;
    return text ? `${text.vi} / ${text.en}` : 'Để trống (ẩn)';
  }
  if (editor.kind === 'nav-items') {
    return (defaultValue as { key: string }[]).map((item) => editor.options.find((option) => option.value === item.key)?.label ?? item.key).join(', ');
  }
  if (editor.kind === 'social-links') return (defaultValue as unknown[]).length === 0 ? 'Không có liên kết' : `${(defaultValue as unknown[]).length} liên kết`;
  return String(defaultValue);
}

const toRule = (check: (value: unknown) => string | null): Rule[] => [
  { validator: (_: unknown, value: unknown) => { const message = check(value); return message ? Promise.reject(new Error(message)) : Promise.resolve(); } },
];

function ruleFor(editor: AppSettingEditor, label: string): Rule[] {
  if (editor.kind === 'number') {
    return [
      { required: true, message: 'Nhập giá trị' },
      { type: 'number' as const, min: editor.min, max: editor.max, message: `Trong khoảng ${editor.min}–${editor.max} ${editor.unit}` },
    ];
  }
  if (editor.kind === 'bilingual-text') return toRule((value) => validateBilingual(value as BilingualValue | null, { maxLength: editor.maxLength, nullable: editor.nullable, fieldName: label.toLowerCase() }));
  if (editor.kind === 'nav-items') return toRule((value) => validateNavItems(value as NavItemValue[], editor));
  if (editor.kind === 'social-links') return toRule((value) => validateSocialLinks(value as SocialLinkValue[], editor));
  if (editor.kind === 'text' && editor.optional) return [];
  if (editor.kind === 'text' || editor.kind === 'timezone' || editor.kind === 'choice') return [{ required: true, message: 'Nhập giá trị' }];
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
      <Form.Item name={item.key} noStyle valuePropName={item.editor.kind === 'boolean' ? 'checked' : 'value'} rules={ruleFor(item.editor, item.label)}>
        {renderEditor(item.editor, item.key, item.label)}
      </Form.Item>
    </Form.Item>
  );
}
