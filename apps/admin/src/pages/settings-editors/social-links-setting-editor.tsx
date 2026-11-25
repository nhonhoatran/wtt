import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Select, Typography } from 'antd';
import { socialLinkError, type SocialLinkValue } from './structured-setting-validation';

interface Props {
  value?: SocialLinkValue[];
  onChange?: (value: SocialLinkValue[]) => void;
  platforms: { value: string; label: string }[];
  maxItems: number;
}

/** Rows of platform + https link; a row turns red as soon as its link is not a valid https address (the message is on the field). */
export function SocialLinksSettingEditor({ value = [], onChange, platforms, maxItems }: Props) {
  const emit = (next: SocialLinkValue[]) => onChange?.(next);
  const patch = (index: number, change: Partial<SocialLinkValue>) => emit(value.map((link, i) => (i === index ? { ...link, ...change } : link)));

  return (
    <Flex vertical gap="small" style={{ maxWidth: 640 }}>
      {value.map((link, index) => {
        const error = link.url ? socialLinkError(link, index, platforms) : null;
        return (
          <Flex key={index} vertical gap={2}>
            <Flex gap="small" align="center">
              <Select value={link.platform} options={platforms} onChange={(platform: string) => patch(index, { platform })} style={{ width: 130, flex: 'none' }} aria-label={`Mạng xã hội của liên kết ${index + 1}`} />
              <Input
                value={link.url}
                onChange={(event) => patch(index, { url: event.target.value })}
                placeholder="https://..."
                status={error ? 'error' : undefined}
                inputMode="url"
                aria-label={`Đường dẫn liên kết ${index + 1}`}
                aria-invalid={Boolean(error)}
              />
              <Button type="text" danger icon={<CloseOutlined />} onClick={() => emit(value.filter((_, i) => i !== index))} aria-label={`Xóa liên kết ${index + 1}`} />
            </Flex>
          </Flex>
        );
      })}
      <Flex align="center" gap="small">
        <Button icon={<PlusOutlined />} disabled={value.length >= maxItems} onClick={() => emit([...value, { platform: platforms[0]?.value ?? '', url: '' }])}>
          Thêm liên kết
        </Button>
        {value.length >= maxItems && <Typography.Text type="secondary">Đã đủ {maxItems} liên kết.</Typography.Text>}
        {value.length === 0 && <Typography.Text type="secondary">Chưa có liên kết nào, biểu tượng mạng xã hội sẽ ẩn.</Typography.Text>}
      </Flex>
    </Flex>
  );
}
