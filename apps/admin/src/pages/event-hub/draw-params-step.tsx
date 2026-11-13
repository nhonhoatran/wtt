import { Form, InputNumber, Radio, type FormInstance } from 'antd';
import { ADVANCE_PER_GROUP_OPTIONS, MIN_GROUP_SIZE } from './draw-labels';
import type { EntrySubEvent } from './entry-labels';
import type { DrawKind } from './draw-types';
import type { DrawParamValues } from './use-draw-preview';

type ParamField = keyof DrawParamValues;

/** Which inputs a draw kind needs; the main draw of a group stage takes its players from the groups. */
export function paramFieldsFor(kind: DrawKind, subEvent: EntrySubEvent): ParamField[] {
  if (kind === 'GROUP') return ['seedCount', 'groupSize', 'groupCount', 'advancePerGroup'];
  if (kind === 'QUALIFYING') return ['seedCount', 'qualifierCount'];
  if (subEvent.format === 'GROUP_KNOCKOUT') return [];
  return subEvent.hasQualifying ? ['seedCount', 'qualifierCount'] : ['seedCount'];
}

interface NumberField {
  label: string;
  extra?: string;
}

const NUMBER_FIELDS: Record<Exclude<ParamField, 'advancePerGroup'>, NumberField> = {
  seedCount: { label: 'Số hạt giống' },
  qualifierCount: { label: 'Số suất dành cho vòng loại', extra: 'Các suất này để trống trong nhánh chính cho tới khi vòng loại xong.' },
  groupSize: { label: 'Số VĐV mỗi bảng', extra: 'Số bảng sẽ tính theo số này.' },
  groupCount: { label: 'Số bảng', extra: 'Sửa số bảng thì số VĐV mỗi bảng tính theo số này.' },
};

interface DrawParamsStepProps {
  form: FormInstance<DrawParamValues>;
  kind: DrawKind;
  subEvent: EntrySubEvent;
  initialValues: DrawParamValues;
  onChange: (values: DrawParamValues, changed: ParamField | undefined) => void;
}

/** Starting values come from the preview response (AppSetting draw.*), never from the UI. */
export function DrawParamsStep({ form, kind, subEvent, initialValues, onChange }: DrawParamsStepProps) {
  const fields = paramFieldsFor(kind, subEvent);

  return (
    <Form<DrawParamValues>
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onValuesChange={(changed, all) => onChange(all, Object.keys(changed)[0] as ParamField | undefined)}
    >
      {fields.map((field) =>
        field === 'advancePerGroup' ? (
          <Form.Item key={field} name={field} label="Số VĐV đi tiếp mỗi bảng">
            <Radio.Group options={ADVANCE_PER_GROUP_OPTIONS} />
          </Form.Item>
        ) : (
          <Form.Item key={field} name={field} label={NUMBER_FIELDS[field].label} extra={NUMBER_FIELDS[field].extra}>
            <InputNumber<number> min={field === 'seedCount' || field === 'qualifierCount' ? 0 : field === 'groupSize' ? MIN_GROUP_SIZE : 1} precision={0} />
          </Form.Item>
        ),
      )}
    </Form>
  );
}
