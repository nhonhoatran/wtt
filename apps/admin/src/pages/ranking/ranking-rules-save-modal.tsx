import { RANKING_NOTE_MAX_LENGTH } from '@kamito/shared';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, DatePicker, Flex, Form, Input, Modal, Skeleton, theme } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo, useState } from 'react';
import { ApiError, apiFetch } from '../../api/http-client';
import { showWarnings, warningsOf } from '../../api/write-warnings';
import { DATE_ONLY_FORMAT, DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import type { DrawKind } from '../event-hub/draw-types';
import { changedRuleCells } from './ranking-rules-state';
import { RULES_KEY, type CompetitorKind, type RuleCellEdit, type RulesMatrix } from './use-ranking-rules-matrix';

const MODAL_WIDTH = 640;
const NOTE_ROWS = 2;

interface SaveModalProps {
  open: boolean;
  kind: CompetitorKind;
  draw: DrawKind;
  edits: RuleCellEdit[];
  /** The server's current date (asOf of the matrix in force); effective dates before it are refused. */
  today: string;
  versions: string[];
  labelOf: (cell: RuleCellEdit) => string;
  onClose: () => void;
  onSaved: () => void;
}

interface FormValues {
  effectiveFrom: Dayjs;
  note?: string;
}

/** Cell errors come back as `cells.N.points`; map N to the cell so the message names it. */
function cellErrors(error: ApiError, cells: RuleCellEdit[], labelOf: SaveModalProps['labelOf']): string[] {
  return Object.entries(error.errors ?? {})
    .filter(([path]) => path.startsWith('cells'))
    .map(([path, text]) => {
      const cell = cells[Number(/^cells\.(\d+)/.exec(path)?.[1])];
      return cell ? `${labelOf(cell)}: ${text}` : text;
    });
}

export function RankingRulesSaveModal({ open, kind, draw, edits, today, versions, labelOf, onClose, onSaved }: SaveModalProps) {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const effectiveFrom = Form.useWatch('effectiveFrom', form) as Dayjs | undefined;
  const effectiveIso = effectiveFrom?.format(DATE_ONLY_FORMAT);

  // The new version is diffed against the rules in force on the chosen date, not on today.
  const baseline = useQuery({
    queryKey: [RULES_KEY, kind, draw, effectiveIso],
    enabled: open && Boolean(effectiveIso) && effectiveIso !== today,
    queryFn: async () => (await apiFetch<{ data: RulesMatrix }>(`/admin/ranking-rules?${new URLSearchParams({ 'filter[competitorKind]': kind, 'filter[drawKind]': draw, 'filter[asOf]': effectiveIso as string })}`)).data,
  });
  const baselineReady = effectiveIso === today || Boolean(baseline.data);
  const cells = useMemo(() => {
    if (effectiveIso === today) return edits;
    return changedRuleCells(edits, baseline.data?.cells ?? []);
  }, [edits, baseline.data, effectiveIso, today]);
  const eventTypeIds = [...new Set(cells.map((cell) => cell.eventTypeId))];
  const laterVersion = effectiveIso ? [...versions].sort().find((version) => version > effectiveIso) : undefined;

  const impact = useQuery({
    queryKey: ['admin-ranking-rules-impact', kind, effectiveIso, eventTypeIds.join(',')],
    enabled: open && Boolean(effectiveIso) && baselineReady && eventTypeIds.length > 0,
    queryFn: async () =>
      (await apiFetch<{ data: { subEvents: number; events: number } }>(`/admin/ranking-rules/impact?${new URLSearchParams({ competitorKind: kind, effectiveFrom: effectiveIso as string, eventTypeIds: eventTypeIds.join(',') })}`)).data,
  });

  const submit = async (values: FormValues) => {
    setSaving(true);
    setProblems([]);
    try {
      const response = await apiFetch('/admin/ranking-rules/matrix', {
        method: 'PUT',
        body: { competitorKind: kind, drawKind: draw, effectiveFrom: values.effectiveFrom.format(DATE_ONLY_FORMAT), note: values.note?.trim() || undefined, cells },
      });
      message.success('Đã lưu phiên bản quy tắc');
      showWarnings(message, warningsOf(response));
      onSaved();
    } catch (error) {
      const found = error instanceof ApiError ? cellErrors(error, cells, labelOf) : [];
      if (found.length > 0) setProblems(found);
      else message.error(error instanceof ApiError ? error.message : 'Không lưu được phiên bản quy tắc');
    } finally {
      setSaving(false);
    }
  };

  const loadingImpact = impact.isFetching || baseline.isFetching;
  return (
    <Modal
      open={open}
      width={MODAL_WIDTH}
      title="Lưu phiên bản quy tắc"
      okText="Lưu phiên bản"
      cancelText="Hủy"
      confirmLoading={saving}
      okButtonProps={{ disabled: !baselineReady || cells.length === 0 }}
      onOk={() => void form.validateFields().then(submit, () => undefined)}
      onCancel={onClose}
      destroyOnHidden
    >
      <Flex vertical gap={token.margin}>
        {problems.length > 0 && <Alert type="error" showIcon message="Có ô chưa hợp lệ" description={problems.map((text) => <div key={text}>{text}</div>)} />}
        <Form form={form} layout="vertical" preserve={false} initialValues={{ effectiveFrom: dayjs(today) }}>
          <Form.Item name="effectiveFrom" label="Áp dụng từ ngày" rules={[{ required: true, message: 'Chọn ngày áp dụng' }]}>
            <DatePicker format={DISPLAY_DATE_FORMAT} allowClear={false} disabledDate={(date) => date.format(DATE_ONLY_FORMAT) < today} />
          </Form.Item>
          {effectiveIso && (
            <Flex vertical gap={token.marginXS} style={{ marginBottom: token.margin }}>
              {laterVersion && <Alert type="warning" showIcon message={`Đã có phiên bản từ ${dayjs(laterVersion).format(DISPLAY_DATE_FORMAT)}; ô không sửa ở phiên bản đó vẫn giữ giá trị của nó.`} />}
              {baselineReady && cells.length === 0 && <Alert type="info" showIcon message="Không có ô nào khác với quy tắc đang hiệu lực ở ngày này" />}
              {loadingImpact && <Skeleton active paragraph={false} />}
              {!loadingImpact && impact.isError && <Alert type="error" showIcon message="Không tính được phạm vi ảnh hưởng của phiên bản này" />}
              {!loadingImpact && impact.data && cells.length > 0 && (
                <Alert
                  type="info"
                  showIcon
                  message={`Áp cho giải kết thúc từ ${dayjs(effectiveIso).format(DISPLAY_DATE_FORMAT)}; ${impact.data.events} giải (${impact.data.subEvents} nội dung) đang diễn ra hoặc chưa diễn ra sẽ tính lại; giải đã kết thúc giữ nguyên.`}
                />
              )}
            </Flex>
          )}
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={NOTE_ROWS} maxLength={RANKING_NOTE_MAX_LENGTH} showCount />
          </Form.Item>
        </Form>
      </Flex>
    </Modal>
  );
}
