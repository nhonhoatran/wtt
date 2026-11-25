import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Select, Typography, theme } from 'antd';
import type { NavItemValue } from './structured-setting-validation';

interface Props {
  value?: NavItemValue[];
  onChange?: (value: NavItemValue[]) => void;
  options: { value: string; label: string }[];
  maxItems: number;
}

/** Ordered menu: reorder with the arrows, optional VI/EN label overrides (empty = default name). */
export function NavItemsSettingEditor({ value = [], onChange, options, maxItems }: Props) {
  const { token } = theme.useToken();
  const nameOf = (key: string) => options.find((option) => option.value === key)?.label ?? key;
  const remaining = options.filter((option) => !value.some((item) => item.key === option.value));
  const emit = (next: NavItemValue[]) => onChange?.(next);
  const move = (from: number, to: number) => {
    const next = [...value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    emit(next);
  };
  const setLabel = (index: number, field: 'labelVi' | 'labelEn', text: string) =>
    emit(value.map((item, i) => {
      if (i !== index) return item;
      const next = { ...item, [field]: text };
      if (!text) delete next[field];
      return next;
    }));

  return (
    <Flex vertical gap="small" style={{ maxWidth: 640 }}>
      {value.map((item, index) => (
        <Flex
          key={item.key}
          align="center"
          wrap
          gap="small"
          style={{ padding: token.paddingXS, border: `${token.lineWidth}px ${token.lineType} ${token.colorBorderSecondary}`, borderRadius: token.borderRadius }}
        >
          <Typography.Text strong style={{ minWidth: 120 }}>{index + 1}. {nameOf(item.key)}</Typography.Text>
          <Input size="small" style={{ flex: '1 1 130px', width: 'auto' }} value={item.labelVi ?? ''} placeholder={`Nhãn VI (mặc định: ${nameOf(item.key)})`} onChange={(event) => setLabel(index, 'labelVi', event.target.value)} aria-label={`Nhãn tiếng Việt: ${nameOf(item.key)}`} />
          <Input size="small" style={{ flex: '1 1 130px', width: 'auto' }} value={item.labelEn ?? ''} placeholder="Nhãn EN (để trống: mặc định)" onChange={(event) => setLabel(index, 'labelEn', event.target.value)} aria-label={`Nhãn tiếng Anh: ${nameOf(item.key)}`} />
          <Flex gap={2}>
            <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Đưa lên: ${nameOf(item.key)}`} />
            <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={index === value.length - 1} onClick={() => move(index, index + 1)} aria-label={`Đưa xuống: ${nameOf(item.key)}`} />
            <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => emit(value.filter((_, i) => i !== index))} aria-label={`Bỏ mục: ${nameOf(item.key)}`} />
          </Flex>
        </Flex>
      ))}
      {value.length < maxItems && remaining.length > 0 ? (
        <Select
          value={null}
          options={remaining}
          placeholder={<><PlusOutlined /> Thêm mục</>}
          onChange={(key: string) => emit([...value, { key }])}
          style={{ width: 200 }}
          aria-label="Thêm mục menu"
        />
      ) : (
        <Typography.Text type="secondary">{value.length >= maxItems ? `Đã đủ ${maxItems} mục.` : 'Đã dùng hết các mục có sẵn.'}</Typography.Text>
      )}
    </Flex>
  );
}
