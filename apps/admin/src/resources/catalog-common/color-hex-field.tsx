import { ColorPicker } from 'antd';

// '#RRGGBB'; the picker adds 'AA' when alpha was touched before a colour was set.
const HEX_RGB_LENGTH = 7;

interface ColorHexFieldProps {
  value?: string | null;
  onChange?: (hex: string | null) => void;
  allowClear?: boolean;
}

/** Form.Item control that always yields #RRGGBB (or null when cleared). */
export function ColorHexField({ value, onChange, allowClear }: ColorHexFieldProps) {
  return (
    <ColorPicker
      showText
      disabledAlpha={Boolean(value)}
      allowClear={allowClear}
      value={value || undefined}
      onChange={(color) => onChange?.(color.toHexString().slice(0, HEX_RGB_LENGTH).toUpperCase())}
      onClear={() => onChange?.(null)}
    />
  );
}
