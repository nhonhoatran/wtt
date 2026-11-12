import { Alert, App, Button, Checkbox, Flex, Form, Modal, Select, Typography, theme } from 'antd';
import { useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { useCatalogRows, useCatalogSelect } from '../../resources/events/use-catalog-options';
import { SubEventFormatFields } from './sub-event-format-fields';
import { DEFAULT_SUB_EVENT_FORMAT, type SubEventFormat } from './sub-event-labels';

interface BulkSubEventModalProps {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<unknown>;
}

interface BulkValues {
  format: SubEventFormat;
  matchFormatId?: string;
  groupScoringRuleId?: string;
}

export function BulkSubEventModal({ eventId, open, onClose, onCreated }: BulkSubEventModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [form] = Form.useForm<BulkValues>();
  const disciplines = useCatalogRows('disciplines');
  const [pickedDisciplines, setPickedDisciplines] = useState<string[]>([]);
  const [pickedCategories, setPickedCategories] = useState<string[]>([]);
  const categories = useCatalogSelect('categories', { selected: pickedCategories });
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const items = useMemo(
    () =>
      pickedDisciplines.flatMap((disciplineId): { disciplineId: string; categoryId: string | null }[] =>
        pickedCategories.length
          ? pickedCategories.map((categoryId) => ({ disciplineId, categoryId }))
          : [{ disciplineId, categoryId: null }],
      ),
    [pickedDisciplines, pickedCategories],
  );

  const allIds = (disciplines.data ?? []).map((row) => row.id);
  const allPicked = allIds.length > 0 && pickedDisciplines.length === allIds.length;

  const reset = () => {
    setPickedDisciplines([]);
    setPickedCategories([]);
    setProblems([]);
  };

  const submit = async () => {
    const defaults = form.getFieldsValue();
    setSaving(true);
    setProblems([]);
    try {
      await apiFetch(`/admin/events/${eventId}/sub-events/bulk`, {
        method: 'POST',
        body: {
          items,
          defaults: {
            format: defaults.format,
            matchFormatId: defaults.matchFormatId,
            groupScoringRuleId: defaults.format === 'GROUP_KNOCKOUT' ? defaults.groupScoringRuleId : undefined,
          },
        },
      });
      await onCreated();
      message.success(`Đã tạo ${items.length} nội dung`);
      reset();
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.errors) setProblems(Object.values(error.errors));
      else setProblems([error instanceof Error ? error.message : 'Không tạo được nội dung']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Thêm nội dung thi đấu"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText={`Tạo ${items.length} nội dung`}
      cancelText="Hủy"
      okButtonProps={{ disabled: items.length === 0, loading: saving }}
      afterClose={reset}
      width={640}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {problems.length > 0 && <Alert type="error" showIcon message={problems.map((text) => <div key={text}>{text}</div>)} />}
        <div>
          <Flex justify="space-between" align="center">
            <Typography.Text strong>Chọn nội dung</Typography.Text>
            <Button type="link" size="small" onClick={() => setPickedDisciplines(allPicked ? [] : allIds)}>
              {allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </Flex>
          <Checkbox.Group
            value={pickedDisciplines}
            onChange={(values) => setPickedDisciplines(values as string[])}
            options={(disciplines.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: token.marginXS }}
          />
        </div>
        <div>
          <Typography.Text strong>Nhóm tuổi / trình độ</Typography.Text>
          <Select
            mode="multiple"
            allowClear
            style={{ width: '100%', marginTop: token.marginXXS }}
            placeholder="Để trống nếu không chia theo nhóm tuổi / trình độ"
            {...categories.selectProps}
            value={pickedCategories}
            onChange={setPickedCategories}
          />
        </div>
        <Form form={form} layout="vertical" initialValues={{ format: DEFAULT_SUB_EVENT_FORMAT }}>
          <SubEventFormatFields form={form} />
        </Form>
      </Flex>
    </Modal>
  );
}
