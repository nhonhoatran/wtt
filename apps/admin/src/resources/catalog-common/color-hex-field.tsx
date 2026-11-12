import { ColorPicker } from 'antd';

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
      disabledAlpha
      allowClear={allowClear}
      value={value || undefined}
      onChange={(color) => onChange?.(color.toHexString().toUpperCase())}
      onClear={() => onChange?.(null)}
    />
  );
}
