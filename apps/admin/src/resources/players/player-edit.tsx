import { Edit, useForm } from '@refinedev/antd';
import { useCan } from '@refinedev/core';
import { Alert, Form, theme } from 'antd';
import { Link } from 'react-router';
import { cleanPlayerValues, fillBirthYear, PlayerFormFields } from './player-form';
import { PLAYER_FORM_MAX_WIDTH, playerCodeName, type PlayerDetail } from './player-labels';

/** Read-only for a merged profile (kept for history and redirects) and for roles that may only view players. */
export function PlayerEdit() {
  const { token } = theme.useToken();
  const { formProps, saveButtonProps, query, form } = useForm<PlayerDetail>({ resource: 'players', action: 'edit', redirect: 'list' });
  const record = query?.data?.data;
  const mergedInto = record?.mergedIntoId ? record.mergedInto : null;
  const merged = Boolean(record?.mergedIntoId);
  const canUpdate = useCan({ resource: 'players', action: 'update' }).data?.can ?? false;
  const readOnly = merged || !canUpdate;

  return (
    <Edit
      title={record ? `Sửa: ${playerCodeName(record)}` : 'Sửa VĐV'}
      saveButtonProps={{ ...saveButtonProps, hidden: readOnly }}
      deleteButtonProps={{ hidden: true }}
    >
      {merged && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: token.margin, maxWidth: PLAYER_FORM_MAX_WIDTH }}
          message={
            <>
              Đã gộp vào{' '}
              {mergedInto ? <Link to={`/players/${mergedInto.id}/edit`}>{playerCodeName(mergedInto)}</Link> : 'hồ sơ khác'}. Hồ sơ này chỉ xem, không sửa
              được.
            </>
          }
        />
      )}
      <Form
        {...formProps}
        layout="vertical"
        disabled={readOnly}
        onValuesChange={(changed) => fillBirthYear(form, changed)}
        onFinish={(values) => formProps.onFinish?.(cleanPlayerValues(values, 'edit'))}
        style={{ maxWidth: PLAYER_FORM_MAX_WIDTH }}
      >
        <PlayerFormFields form={form} showPrivate={canUpdate} />
      </Form>
    </Edit>
  );
}
