import { useQuery } from '@tanstack/react-query';
import { App, Button, Empty, Flex, Result, Skeleton, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import { apiFetch } from '../../api/http-client';
import { AdminBracketView, type CellActionTarget } from './admin-bracket-view';
import { DrawActionBar } from './draw-action-bar';
import { DrawEntryActionModal, type DrawActionTarget } from './draw-entry-action-modal';
import { DRAW_LOCKED_LABEL, DRAW_STATUS_COLORS, DRAW_STATUS_LABELS, drawViewKey } from './draw-labels';
import type { BracketData, DrawKind, DrawRef, GroupsData } from './draw-types';
import { DrawWizard } from './draw-wizard';
import type { EntrySubEvent } from './entry-labels';
import { GroupTablesView } from './group-tables-view';
import { useDrawCall } from './use-draw-call';

interface DrawPanelProps {
  subEvent: EntrySubEvent;
  kind: DrawKind;
  draws: DrawRef[];
  canUpdate: boolean;
  /** Refetch the overview and every open draw view. */
  refresh: () => Promise<unknown>;
}

/** One draw kind of a sub-event: empty state, or status + actions + the group tables / bracket. */
export function DrawPanel({ subEvent, kind, draws, canUpdate, refresh }: DrawPanelProps) {
  const { message } = App.useApp();
  const ref = draws.find((item) => item.kind === kind);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [action, setAction] = useState<DrawActionTarget | null>(null);
  const { call, report } = useDrawCall(refresh);
  const view = useQuery({
    queryKey: drawViewKey(ref?.id),
    enabled: Boolean(ref),
    queryFn: async () => (await apiFetch<{ data: BracketData & GroupsData }>(`/admin/draws/${ref!.id}/${kind === 'GROUP' ? 'groups' : 'bracket'}`)).data,
  });

  const wizard = <DrawWizard subEvent={subEvent} kind={kind} open={wizardOpen} onClose={() => setWizardOpen(false)} onDrawn={refresh} />;

  if (!ref) {
    const needsGroups = kind === 'MAIN' && subEvent.format === 'GROUP_KNOCKOUT' && !draws.some((item) => item.kind === 'GROUP');
    return (
      <Empty description="Chưa bốc thăm">
        {canUpdate && (
          <Tooltip title={needsGroups ? 'Bốc thăm vòng bảng trước' : undefined}>
            <span>
              <Button type="primary" disabled={needsGroups} onClick={() => setWizardOpen(true)}>
                Bốc thăm
              </Button>
            </span>
          </Tooltip>
        )}
        {wizard}
      </Empty>
    );
  }
  if (view.isLoading) return <Skeleton active />;
  if (view.isError || !view.data) {
    return <Result status="error" title="Không tải được nhánh đấu" extra={<Button onClick={() => view.refetch()}>Thử lại</Button>} />;
  }

  const data = view.data;
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
    <Flex vertical gap="middle">
      <Flex justify="space-between" align="center" wrap gap="small">
        <Flex gap="small" align="center">
          <Tag color={DRAW_STATUS_COLORS[data.status]}>{DRAW_STATUS_LABELS[data.status]}</Tag>
          {data.locked && <Tag color="blue">{DRAW_LOCKED_LABEL}</Tag>}
        </Flex>
        {canUpdate && (
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
        )}
      </Flex>
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
      {wizard}
      <DrawEntryActionModal target={action} data={data} call={call} onClose={() => setAction(null)} onDone={refresh} />
    </Flex>
  );
}
