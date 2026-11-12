import { Create, useForm } from '@refinedev/antd';
import { Form } from 'antd';
import { cleanPlayerValues, fillBirthYear, PlayerFormFields } from './player-form';
import { PLAYER_FORM_MAX_WIDTH } from './player-labels';

export function PlayerCreate() {
  const { formProps, saveButtonProps, form } = useForm({ resource: 'players', action: 'create', redirect: 'list' });

  return (
    <Create title="Thêm VĐV" saveButtonProps={{ ...saveButtonProps, children: 'Tạo VĐV' }}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{ isActive: true, isPublicProfile: true, noindex: true }}
        onValuesChange={(changed) => fillBirthYear(form, changed)}
        onFinish={(values) => formProps.onFinish?.(cleanPlayerValues(values, 'create'))}
        style={{ maxWidth: PLAYER_FORM_MAX_WIDTH }}
      >
        <PlayerFormFields form={form} autoFocus />
      </Form>
    </Create>
  );
}
