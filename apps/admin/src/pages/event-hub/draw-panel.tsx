import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Empty, Flex, Result, Skeleton, Tag, Typography } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';
import { apiFetch } from '../../api/http-client';
import { AdminBracketView, type CellActionTarget } from './admin-bracket-view';
import { DrawActionBar } from './draw-action-bar';
import { DrawEntryActionModal, type DrawActionTarget } from './draw-entry-action-modal';
import { DRAW_LOCKED_LABEL, DRAW_STATUS_COLORS, DRAW_STATUS_LABELS, drawSectionTitle, drawViewKey } from './draw-labels';
import { DrawProcessSteps } from './draw-process-steps';
import { DrawStickyActions } from './draw-sticky-actions';
import { drawViewSummaryText } from './draw-summary-text';
import type { BracketData, DrawKind, DrawRef, GroupsData } from './draw-types';
import { DrawWizard } from './draw-wizard';
import type { EntrySubEvent } from './entry-labels';
import { GroupTablesView } from './group-tables-view';
import { findSameClubGroups, sameClubSummary } from './same-club-groups';
import { useDrawCall } from './use-draw-call';

interface DrawPanelProps {
  subEvent: EntrySubEvent;
  kind: DrawKind;
  draws: DrawRef[];
  canUpdate: boolean;
  /** Refetch the overview and every open draw view. */
  refresh: () => Promise<unknown>;
}

/** One draw kind of a sub-event as a page section: steps, status, group tables / bracket and the action bar. */
export function DrawPanel({ subEvent, kind, draws, canUpdate, refresh }: DrawPanelProps) {
  const { message } = App.useApp();
  const ref = draws.find((item) => item.kind === kind);
  const title = drawSectionTitle(kind, subEvent.format);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [action, setAction] = useState<DrawActionTarget | null>(null);
  const { call, report } = useDrawCall(refresh);
  const view = useQuery({
    queryKey: drawViewKey(ref?.id),
    enabled: Boolean(ref),
    queryFn: async () => (await apiFetch<{ data: BracketData & GroupsData }>(`/admin/draws/${ref!.id}/${kind === 'GROUP' ? 'groups' : 'bracket'}`)).data,
  });
  const conflicts = useMemo(() => (kind === 'GROUP' && view.data ? findSameClubGroups(view.data.groups) : []), [kind, view.data]);

  const wizard = <DrawWizard subEvent={subEvent} kind={kind} open={wizardOpen} onClose={() => setWizardOpen(false)} onDrawn={refresh} />;
  const heading = (extra?: string, tags?: ReactNode) => (
    <Flex gap="small" align="center" wrap>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
      {tags}
      {extra && <Typography.Text type="secondary">{extra}</Typography.Text>}
    </Flex>
  );

  if (!ref) {
    const needsGroups = kind === 'MAIN' && subEvent.format === 'GROUP_KNOCKOUT' && draws.find((item) => item.kind === 'GROUP')?.status !== 'PUBLISHED';
    return (
      <Flex vertical gap="middle" component="section" data-draw-kind={kind}>
        {heading(undefined, <Tag>Chưa bốc</Tag>)}
        <DrawProcessSteps kind={kind} draw={undefined} />
        <Empty description={needsGroups ? 'Công bố vòng bảng trước để bốc thăm vòng loại trực tiếp.' : 'Chưa bốc thăm'}>
          {canUpdate && !needsGroups && (
            <Button type="primary" onClick={() => setWizardOpen(true)}>
              Bốc thăm
            </Button>
          )}
        </Empty>
        {wizard}
      </Flex>
    );
  }
  if (view.isLoading) return <Skeleton active />;
  if (view.isError || !view.data) {
    return <Result status="error" title={`Không tải được ${title.toLowerCase()}`} extra={<Button onClick={() => view.refetch()}>Thử lại</Button>} />;
  }

  const data = view.data;
  const draft = data.status === 'DRAFT';
  const swap = async (positionA: string, positionB: string) => {
    try {
      await call(() => apiFetch(`/admin/draws/${data.id}/swap`, { method: 'POST', body: { positionA, positionB, expectedVersion: data.version } }));
      message.success('Đã đổi chỗ hai VĐV');
      await refresh();
    } catch (error) {
      report(error);
    }
  };

  return (
    <Flex vertical gap="middle" component="section" data-draw-kind={kind}>
      {heading(
        drawViewSummaryText(kind, data),
        <>
          <Tag color={DRAW_STATUS_COLORS[data.status]}>{DRAW_STATUS_LABELS[data.status]}</Tag>
          {data.locked && <Tag color="blue">{DRAW_LOCKED_LABEL}</Tag>}
        </>,
      )}
      <DrawProcessSteps kind={kind} draw={ref} />
      {draft && (
        <Alert
          type="warning"
          showIcon
          message={
            <>
              <strong>Bản xem trước chưa công bố.</strong>
              {conflicts.length > 0 ? ` Lưu ý: ${sameClubSummary(conflicts)}.${canUpdate && !data.locked ? ' Bấm "Đổi chỗ" ở VĐV để tách, hoặc bốc thăm lại.' : ''}` : canUpdate && !data.locked ? ' Kiểm tra rồi bấm Công bố để VĐV và khán giả thấy.' : ''}
            </>
          }
          action={
            conflicts.length > 0 &&
            canUpdate &&
            !data.locked && (
              <Button size="small" type="link" onClick={() => setWizardOpen(true)}>
                Bốc thăm lại
              </Button>
            )
          }
        />
      )}
      {kind === 'GROUP' ? (
        <GroupTablesView data={data} canUpdate={canUpdate} call={call} report={report} onChanged={refresh} onWithdraw={(entry) => setAction({ mode: 'group-member', entry })} />
      ) : (
        <AdminBracketView
          data={data}
          canUpdate={canUpdate}
          onSwap={swap}
          onEntryAction={(target: CellActionTarget) => setAction({ mode: 'cell', ...target })}
          call={call}
          report={report}
          onChanged={refresh}
        />
      )}
      {canUpdate && (
        <DrawStickyActions sticky={draft}>
          <DrawActionBar
            subEvent={subEvent}
            kind={kind}
            draws={draws}
            draw={data}
            call={call}
            report={report}
            onChanged={refresh}
            onReroll={() => setWizardOpen(true)}
            onUnpublish={() => setAction({ mode: 'unpublish' })}
          />
        </DrawStickyActions>
      )}
      {wizard}
      <DrawEntryActionModal target={action} data={data} call={call} onClose={() => setAction(null)} onDone={refresh} />
    </Flex>
  );
}
