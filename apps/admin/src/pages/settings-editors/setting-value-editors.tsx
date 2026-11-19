import { useSelect } from '@refinedev/antd';
import { Form, Input, InputNumber, Select, Switch } from 'antd';
import { useEffect, useState } from 'react';
import { useMemo } from 'react';

interface ControlProps<T> {
  value?: T;
  onChange?: (value: T) => void;
}

// Fixed control width keeps every setting editor aligned in the card.
const CONTROL_WIDTH = 280;
const NUMBER_WIDTH = 200;

export function TextSettingEditor({ value, onChange, maxLength }: ControlProps<string> & { maxLength: number }) {
  return <Input value={value} maxLength={maxLength} showCount onChange={(event) => onChange?.(event.target.value)} style={{ width: CONTROL_WIDTH }} />;
}

export function BooleanSettingEditor({ value, onChange }: ControlProps<boolean>) {
  return <Switch checked={value} checkedChildren="Bật" unCheckedChildren="Tắt" onChange={onChange} />;
}

export function NumberSettingEditor({ value, onChange, min, max, unit }: ControlProps<number> & { min: number; max: number; unit: string }) {
  return <InputNumber value={value} onChange={(next) => onChange?.(next as number)} min={min} max={max} precision={0} addonAfter={unit} style={{ width: NUMBER_WIDTH }} />;
}

export function ChoiceSettingEditor({ value, onChange, options }: ControlProps<string> & { options: { value: string; label: string }[] }) {
  return <Select value={value} options={options} onChange={onChange} style={{ width: CONTROL_WIDTH }} />;
}

export function TimezoneSettingEditor({ value, onChange }: ControlProps<string>) {
  const options = useMemo(() => Intl.supportedValuesOf('timeZone').map((zone) => ({ value: zone, label: zone })), []);
  return <Select showSearch value={value} options={options} onChange={onChange} style={{ width: CONTROL_WIDTH }} placeholder="Chọn múi giờ" />;
}

/** Picks a tournament by name; clearing stores null so the site falls back to its automatic choice. */
export function EventSettingEditor({ value, onChange }: ControlProps<string | null>) {
  const { selectProps } = useSelect({
    resource: 'events',
    optionLabel: 'name',
    optionValue: 'id',
    defaultValue: value ?? undefined,
    onSearch: (text) => [{ field: 'q', operator: 'contains', value: text }],
  });
  return (
    <Select<string>
      showSearch
      allowClear
      filterOption={false}
      loading={selectProps.loading}
      options={selectProps.options as { value: string; label: string }[] | undefined}
      onSearch={selectProps.onSearch}
      value={value ?? undefined}
      onChange={(next) => onChange?.(next ?? null)}
      placeholder="Tự động chọn"
      style={{ width: CONTROL_WIDTH }}
    />
  );
}

/** JSON is kept editable as text, while only valid values enter the settings form. */
export function JsonSettingEditor({ value, onChange, settingKey }: ControlProps<unknown> & { settingKey: string }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState<string>();
  const form = Form.useFormInstance();

  useEffect(() => {
    setText(JSON.stringify(value ?? null, null, 2));
  }, [value]);

  const update = (next: string) => {
    setText(next);
    try {
      const parsed: unknown = JSON.parse(next);
      onChange?.(parsed);
      setError(undefined);
      form.setFields([{ name: settingKey, errors: [] }]);
    } catch {
      const message = 'JSON chưa hợp lệ';
      setError(message);
      form.setFields([{ name: settingKey, errors: [message] }]);
    }
  };

  return <Input.TextArea value={text} onChange={(event) => update(event.target.value)} autoSize={{ minRows: 4, maxRows: 14 }} status={error ? 'error' : undefined} aria-invalid={Boolean(error)} />;
}
