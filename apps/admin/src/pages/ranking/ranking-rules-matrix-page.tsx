import { useCan } from '@refinedev/core';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Flex, Result, Skeleton, theme, Typography } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/page-header';
import { DISPLAY_DATE_FORMAT } from '../../resources/events/event-labels';
import { useCatalogRows } from '../../resources/events/use-catalog-options';
import { RankingRulesCopyColumn } from './ranking-rules-copy-column';
import { RankingRulesGrid } from './ranking-rules-grid';
import { RankingRulesSaveModal } from './ranking-rules-save-modal';
import { CURRENT_VERSION, RankingRulesToolbar } from './ranking-rules-toolbar';
import { RankingRulesUnsavedBar } from './ranking-rules-unsaved-bar';
import { useUnsavedGuard } from './ranking-rules-unsaved-guard';
import { RankingValidityCard } from './ranking-validity-card';
import { stageLabelWithCode } from './ranking-stage-labels';
import { RULES_KEY, useRankingRulesMatrix, visibleEventTypes, type RuleCellEdit } from './use-ranking-rules-matrix';

const UNSAVED_MESSAGE = 'Bạn có thay đổi chưa lưu. Bỏ thay đổi và tiếp tục?';
const SUBTITLE = 'Điểm VĐV nhận theo hạng giải và vòng đạt được. Thay đổi chỉ áp dụng cho các giải kết thúc từ ngày hiệu lực.';

interface EventTypeColors { colorHex?: string | null; tier?: { colorHex?: string } }

export function RankingRulesMatrixPage() {
  const { token } = theme.useToken();
  const { modal } = App.useApp();
  const matrix = useRankingRulesMatrix();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const { data, isLoading, isError, refetch } = matrix.query;
  const edited = matrix.edits.length;
  const canEdit = useCan({ resource: 'rankings', action: 'update' }).data?.can ?? false;
  const locked = matrix.readOnly || matrix.stale || !canEdit;
  useUnsavedGuard(edited > 0, UNSAVED_MESSAGE);

  const catalog = useCatalogRows('event-types');
  const colors = useMemo(
    () => new Map((catalog.data ?? []).map((row) => {
      const { colorHex, tier } = row as unknown as EventTypeColors;
      return [row.id, colorHex ?? tier?.colorHex] as const;
    })),
    [catalog.data],
  );

  const labelOf = (cell: RuleCellEdit) => {
    const eventType = data?.eventTypes.find((item) => item.id === cell.eventTypeId);
    return `${stageLabelWithCode(cell.stageCode)} – ${eventType?.name ?? ''}`;
  };

  const onSaved = async () => {
    setSaving(false);
    matrix.discard();
    await queryClient.invalidateQueries({ queryKey: [RULES_KEY] });
  };

  const confirmDiscard = () =>
    modal.confirm({ title: `Huỷ ${edited} thay đổi chưa lưu?`, okText: 'Huỷ thay đổi', cancelText: 'Giữ lại', onOk: matrix.discard });

  const editable = Boolean(data) && !isError && !matrix.readOnly && canEdit;

  return (
    <Flex vertical>
      <PageHeader title="Quy tắc điểm xếp hạng" subtitle={SUBTITLE} />
      {matrix.readOnly && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: token.margin }}
          message={`Đang xem quy tắc hiệu lực ngày ${dayjs(matrix.asOf).format(DISPLAY_DATE_FORMAT)} (chỉ đọc)`}
          action={<Button size="small" onClick={() => matrix.setAsOf(CURRENT_VERSION)}>Về hiện hành</Button>}
        />
      )}
      <Flex vertical gap={token.marginLG}>
        <Card styles={{ body: { padding: 0 } }}>
          <Flex wrap justify="space-between" align="center" gap={token.margin} style={{ padding: `${token.paddingMD}px ${token.paddingLG}px` }}>
            <Typography.Title level={5} style={{ margin: 0 }}>Bảng điểm theo hạng giải và vòng đấu</Typography.Title>
            <RankingRulesToolbar
              kind={matrix.kind}
              draw={matrix.draw}
              asOf={matrix.asOf}
              versions={data?.versions ?? []}
              onKind={matrix.setKind}
              onDraw={matrix.setDraw}
              onVersion={matrix.setAsOf}
            />
          </Flex>
          {isLoading && <Skeleton active style={{ padding: token.paddingLG }} />}
          {isError && <Result status="error" title="Không tải được quy tắc điểm" extra={<Button onClick={() => refetch()}>Thử lại</Button>} />}
          {data && !isError && (
            <RankingRulesGrid
              matrix={data}
              readOnly={locked}
              colorOf={(id) => colors.get(id) ?? undefined}
              valueOf={matrix.valueOf}
              originalOf={matrix.originalOf}
              isEdited={matrix.isEdited}
              isInvalid={matrix.isInvalid}
              onChange={matrix.setCell}
            />
          )}
          {data && !isError && (
            <Flex wrap justify="space-between" align="center" gap={token.marginXS} style={{ padding: `${token.paddingSM}px ${token.paddingLG}px`, background: token.colorFillQuaternary }}>
              {editable
                ? <RankingRulesCopyColumn eventTypes={visibleEventTypes(data)} onCopy={matrix.copyColumn} disabled={matrix.stale} />
                : <span />}
              <Link to="/event-types">Quản lý hạng giải</Link>
            </Flex>
          )}
        </Card>
        <RankingValidityCard kind={matrix.kind} />
      </Flex>
      {editable && edited > 0 && (
        <RankingRulesUnsavedBar changed={edited} invalid={matrix.invalidCount} disabled={matrix.stale} onDiscard={confirmDiscard} onSave={() => setSaving(true)} />
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
