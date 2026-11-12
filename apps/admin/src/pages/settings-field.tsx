import { Button, Form, InputNumber, Space, Tag } from 'antd';

export interface SettingView {
  key: string;
  group: string;
  label: string;
  description: string;
  editor: { kind: 'number'; min: number; max: number; unit: string };
  defaultValue: number;
  value: number;
  isDefault: boolean;
  updatedAt: string | null;
}

export function SettingField({ item, onReset }: { item: SettingView; onReset: () => void }) {
  const { min, max, unit } = item.editor;
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
          <span>
            Mặc định: {item.defaultValue} {unit}.
          </span>
          {!item.isDefault && (
            <Button type="link" size="small" onClick={onReset} style={{ padding: 0 }}>
              Khôi phục mặc định
            </Button>
          )}
        </Space>
      }
    >
      <Form.Item
        name={item.key}
        noStyle
        rules={[
          { required: true, message: 'Nhập giá trị' },
          { type: 'number', min, max, message: `Trong khoảng ${min}–${max} ${unit}` },
        ]}
      >
        <InputNumber min={min} max={max} precision={0} addonAfter={unit} style={{ width: 200 }} />
      </Form.Item>
    </Form.Item>
  );
}
