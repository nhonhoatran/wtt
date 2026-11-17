import { App, Form, Input, InputNumber, Modal, Switch } from 'antd';
import { useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { SubEventFormatFields } from './sub-event-format-fields';
import { SubEventRankingField } from './sub-event-ranking-field';
import { subEventTitle, type SubEventFormat, type SubEventRecord } from './sub-event-labels';

interface SubEventEditModalProps {
  eventId: string;
  subEvent: SubEventRecord | null;
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}

interface EditValues {
  name?: string | null;
  format: SubEventFormat;
  matchFormatId?: string;
  groupScoringRuleId?: string | null;
  hasQualifying: boolean;
  maxEntries?: number | null;
  rankingListId?: string | null;
}

export function SubEventEditModal({ eventId, subEvent, onClose, onSaved }: SubEventEditModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<EditValues>();
  const [saving, setSaving] = useState(false);

  const save = async (values: EditValues) => {
    if (!subEvent) return;
    setSaving(true);
    try {
      const response = await apiFetch(`/admin/events/${eventId}/sub-events/${subEvent.id}`, {
        method: 'PATCH',
        body: {
          ...values,
          name: values.name?.trim() || null,
          maxEntries: values.maxEntries ?? null,
          rankingListId: values.rankingListId ?? null,
          groupScoringRuleId: values.format === 'GROUP_KNOCKOUT' ? values.groupScoringRuleId : null,
        },
      });
      await onSaved();
      message.success('Đã lưu nội dung');
      showWarnings(message, warningsOf(response));
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        form.setFields(Object.entries(error.errors).map(([name, text]) => ({ name: name as keyof EditValues, errors: [text] })));
      } else {
        message.error(error instanceof Error ? error.message : 'Không lưu được');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={subEvent ? `Sửa nội dung: ${subEventTitle(subEvent)}` : 'Sửa nội dung'}
      open={subEvent !== null}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Lưu"
      cancelText="Hủy"
      confirmLoading={saving}
      destroyOnHidden
    >
      {subEvent && (
        <Form form={form} layout="vertical" onFinish={save} initialValues={{ ...subEvent, matchFormatId: subEvent.matchFormatId }}>
          <Form.Item name="name" label="Tên hiển thị" extra="Để trống thì dùng tên theo nội dung và nhóm tuổi / trình độ.">
            <Input maxLength={200} />
          </Form.Item>
          <SubEventFormatFields form={form} />
          <SubEventRankingField
            form={form}
            targets={[{ kind: subEvent.discipline.competitorKind, genderRule: subEvent.discipline.genderRule, categoryId: subEvent.category?.id ?? null }]}
            current={subEvent.rankingList}
          />
          <Form.Item name="maxEntries" label="Số lượng tối đa" extra="Để trống nếu không giới hạn.">
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="hasQualifying" label="Có vòng loại" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
