import { Flex, Input, Typography } from 'antd';
import type { BilingualValue } from './structured-setting-validation';

interface Props {
  value?: BilingualValue | null;
  onChange?: (value: BilingualValue | null) => void;
  maxLength: number;
  /** Both boxes empty is stored as null (the text is hidden). */
  nullable: boolean;
  label: string;
}

/** Two boxes, Vietnamese and English; counters warn before the API limit is hit. */
export function BilingualTextSettingEditor({ value, onChange, maxLength, nullable, label }: Props) {
  const current = value ?? { vi: '', en: '' };
  const update = (patch: Partial<BilingualValue>) => {
    const next = { ...current, ...patch };
    onChange?.(nullable && !next.vi.trim() && !next.en.trim() ? null : next);
  };
  return (
    <Flex vertical gap="small" style={{ maxWidth: 560 }}>
      <Input
        value={current.vi}
        onChange={(event) => update({ vi: event.target.value })}
        prefix={<Typography.Text type="secondary" style={{ minWidth: 72 }}>Tiếng Việt</Typography.Text>}
        showCount={{ formatter: ({ count }) => `${count}/${maxLength}` }}
        aria-label={`${label} (tiếng Việt)`}
      />
      <Input
        value={current.en}
        onChange={(event) => update({ en: event.target.value })}
        prefix={<Typography.Text type="secondary" style={{ minWidth: 72 }}>English</Typography.Text>}
        showCount={{ formatter: ({ count }) => `${count}/${maxLength}` }}
        aria-label={`${label} (tiếng Anh)`}
      />
    </Flex>
  );
}
