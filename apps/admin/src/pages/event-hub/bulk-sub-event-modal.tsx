import { Alert, App, Button, Checkbox, Flex, Form, Modal, Select, Typography, theme } from 'antd';
import { useId, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { useCatalogRows, useCatalogSelect } from '../../resources/events/use-catalog-options';
import { SubEventFormatFields } from './sub-event-format-fields';
import { SubEventRankingField } from './sub-event-ranking-field';
import { DEFAULT_SUB_EVENT_FORMAT, type SubEventFormat, type SubEventRecord } from './sub-event-labels';
import type { RankingListTarget } from './use-ranking-list-options';

const DISCIPLINE_COLUMN_MIN_WIDTH = 180;

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
  rankingListId?: string;
}

export function BulkSubEventModal({ eventId, open, onClose, onCreated }: BulkSubEventModalProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const disciplinesLabelId = useId();
  const categoriesLabelId = useId();
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

  const rankingTargets = useMemo(() => {
    const byId = new Map((disciplines.data ?? []).map((row) => [row.id, row as unknown as { id: string } & SubEventRecord['discipline']]));
    return items.flatMap((item): RankingListTarget[] => {
      const discipline = byId.get(item.disciplineId);
      return discipline ? [{ kind: discipline.competitorKind, genderRule: discipline.genderRule, categoryId: item.categoryId }] : [];
    });
  }, [items, disciplines.data]);
  const sharedKind = rankingTargets.length > 0 && new Set(rankingTargets.map((target) => target.kind)).size === 1;

  const allIds = (disciplines.data ?? []).map((row) => row.id);
  const allPicked = allIds.length > 0 && pickedDisciplines.length === allIds.length;

  const reset = () => {
    setPickedDisciplines([]);
    setPickedCategories([]);
    setProblems([]);
    form.setFieldValue('rankingListId', undefined);
  };

  const submit = async () => {
    const defaults = form.getFieldsValue();
    setSaving(true);
    setProblems([]);
    try {
      const response = await apiFetch(`/admin/events/${eventId}/sub-events/bulk`, {
        method: 'POST',
        body: {
          items,
          defaults: {
            format: defaults.format,
            matchFormatId: defaults.matchFormatId,
            groupScoringRuleId: defaults.format === 'GROUP_KNOCKOUT' ? defaults.groupScoringRuleId : undefined,
            rankingListId: sharedKind ? defaults.rankingListId : undefined,
          },
        },
      });
      await onCreated();
      message.success(`Đã tạo ${items.length} nội dung`);
      showWarnings(message, warningsOf(response));
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
            <Typography.Text strong id={disciplinesLabelId}>Chọn nội dung</Typography.Text>
            <Button type="link" size="small" onClick={() => setPickedDisciplines(allPicked ? [] : allIds)}>
              {allPicked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </Flex>
          <Checkbox.Group
            aria-labelledby={disciplinesLabelId}
            value={pickedDisciplines}
            onChange={(values) => setPickedDisciplines(values as string[])}
            options={(disciplines.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${DISCIPLINE_COLUMN_MIN_WIDTH}px, 1fr))`, gap: token.marginXS }}
          />
        </div>
        <div>
          <Typography.Text strong id={categoriesLabelId}>Nhóm tuổi / trình độ</Typography.Text>
          <Select
            aria-labelledby={categoriesLabelId}
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
          <SubEventRankingField form={form} targets={rankingTargets} autoFill />
        </Form>
      </Flex>
    </Modal>
  );
}
