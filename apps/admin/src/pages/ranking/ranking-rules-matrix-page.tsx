import { useCan } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Flex, Radio, Result, Select, Skeleton, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { COMPETITOR_KIND_OPTIONS } from './ranking-labels';
import { RankingRulesCopyColumn } from './ranking-rules-copy-column';
import { RankingRulesGrid } from './ranking-rules-grid';
import { RankingRulesSaveModal } from './ranking-rules-save-modal';
import { useUnsavedGuard } from './ranking-rules-unsaved-guard';
import { RULE_DRAW_OPTIONS, stageLabelWithCode } from './ranking-stage-labels';
import { RULES_KEY, useRankingRulesMatrix, visibleEventTypes, type RuleCellEdit } from './use-ranking-rules-matrix';

const CURRENT_VERSION = '';
const VERSION_SELECT_WIDTH = 200;
const UNSAVED_MESSAGE = 'Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?';

export function RankingRulesMatrixPage() {
  const matrix = useRankingRulesMatrix();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data, isLoading, isError, refetch } = matrix.query;
  const edited = matrix.edits.length;
  const canEdit = useCan({ resource: 'rankings', action: 'update' }).data?.can ?? false;
  const locked = matrix.readOnly || matrix.stale || !canEdit;
  useUnsavedGuard(edited > 0, UNSAVED_MESSAGE);

  const labelOf = (cell: RuleCellEdit) => {
    const eventType = data?.eventTypes.find((item) => item.id === cell.eventTypeId);
    return `${stageLabelWithCode(cell.stageCode)} – ${eventType?.name ?? ''}`;
  };
  const versionOptions = [
    { value: CURRENT_VERSION, label: 'Hiện hành' },
    ...(data?.versions ?? []).map((version) => ({ value: version, label: dayjs(version).format(DISPLAY_DATE_FORMAT) })),
  ];

  const onSaved = async () => {
    setSaving(false);
    matrix.discard();
    await queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
  };

  return (
    <Flex vertical gap="middle">
      <Typography.Title level={3} style={{ margin: 0 }}>Quy tắc điểm</Typography.Title>
      <Flex wrap gap="middle" align="center">
        <Radio.Group optionType="button" value={matrix.kind} options={COMPETITOR_KIND_OPTIONS} onChange={(event) => matrix.setKind(event.target.value)} />
        <Radio.Group optionType="button" value={matrix.draw} options={RULE_DRAW_OPTIONS} onChange={(event) => matrix.setDraw(event.target.value)} />
        <Select
          value={matrix.asOf}
          options={versionOptions}
          onChange={matrix.setAsOf}
          style={{ width: VERSION_SELECT_WIDTH }}
          aria-label="Xem phiên bản"
          placeholder="Xem phiên bản"
        />
      </Flex>
      {matrix.readOnly && (
        <Alert
          type="info"
          showIcon
          message={`Đang xem quy tắc hiệu lực ngày ${dayjs(matrix.asOf).format(DISPLAY_DATE_FORMAT)}`}
          action={<Button size="small" onClick={() => matrix.setAsOf(CURRENT_VERSION)}>Về hiện hành</Button>}
        />
      )}
      {isLoading && <Skeleton active />}
      {isError && <Result status="error" title="Không tải được quy tắc điểm" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />}
      {data && !isError && (
        <RankingRulesGrid matrix={data} readOnly={locked} valueOf={matrix.valueOf} isEdited={matrix.isEdited} onChange={matrix.setCell} />
      )}
      {data && !isError && !matrix.readOnly && canEdit && (
        <Flex justify="space-between" align="center" wrap gap="small">
          <Flex align="center" gap="small">
            <Typography.Text type="secondary">{edited} ô đã sửa · Để trống một ô = giữ giá trị cũ</Typography.Text>
            <Button disabled={edited === 0} onClick={matrix.discard}>Bỏ thay đổi</Button>
          </Flex>
          <Flex align="center" gap="small">
            <RankingRulesCopyColumn eventTypes={visibleEventTypes(data)} onCopy={matrix.copyColumn} disabled={matrix.stale} />
            <Button type="primary" disabled={edited === 0 || matrix.stale} onClick={() => setSaving(true)}>Lưu</Button>
          </Flex>
        </Flex>
      )}
      <RankingRulesSaveModal
        open={saving}
        kind={matrix.kind}
        draw={matrix.draw}
        edits={matrix.edits}
        today={data?.asOf ?? ''}
        versions={data?.versions ?? []}
        labelOf={labelOf}
        onClose={() => setSaving(false)}
        onSaved={onSaved}
      />
    </Flex>
  );
}
