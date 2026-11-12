import { Form, Radio, Select, type FormInstance } from 'antd';
import { useEffect } from 'react';
import { useCatalogSelect, useDefaultCatalogRow } from '../../resources/events/use-catalog-options';
import { SUB_EVENT_FORMAT_OPTIONS } from './sub-event-labels';

interface SubEventFormatFieldsProps {
  form: FormInstance;
}

/** Format radio + match format + (group stage only) scoring rule; the defaults come from the catalogs' isDefault rows. */
export function SubEventFormatFields({ form }: SubEventFormatFieldsProps) {
  const matchFormats = useCatalogSelect('match-formats', { selected: Form.useWatch('matchFormatId', form) });
  const rules = useCatalogSelect('group-scoring-rules', { selected: Form.useWatch('groupScoringRuleId', form) });
  const defaultMatchFormat = useDefaultCatalogRow('match-formats').data;
  const defaultRule = useDefaultCatalogRow('group-scoring-rules').data;

  useEffect(() => {
    const fill = (field: string, fallback: { id: string } | null | undefined) => {
      if (fallback && !form.getFieldValue(field)) form.setFieldValue(field, fallback.id);
    };
    fill('matchFormatId', defaultMatchFormat);
    if (form.getFieldValue('format') === 'GROUP_KNOCKOUT') fill('groupScoringRuleId', defaultRule);
  }, [form, defaultMatchFormat, defaultRule]);

  return (
    <>
      <Form.Item name="format" label="Thể thức thi đấu">
        <Radio.Group
          options={SUB_EVENT_FORMAT_OPTIONS}
          onChange={(event) => {
            if (event.target.value === 'GROUP_KNOCKOUT' && !form.getFieldValue('groupScoringRuleId')) {
              if (defaultRule) form.setFieldValue('groupScoringRuleId', defaultRule.id);
            }
          }}
        />
      </Form.Item>
      <Form.Item name="matchFormatId" label="Thể thức trận">
        <Select {...matchFormats.selectProps} />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(prev, next) => prev.format !== next.format}>
        {({ getFieldValue }) =>
          getFieldValue('format') === 'GROUP_KNOCKOUT' ? (
            <Form.Item name="groupScoringRuleId" label="Luật tính điểm vòng bảng">
              <Select {...rules.selectProps} />
            </Form.Item>
          ) : null
        }
      </Form.Item>
    </>
  );
}
