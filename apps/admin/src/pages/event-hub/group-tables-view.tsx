import { Alert, App, Empty, Grid } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/http-client';
import type { EntryBrief, GroupRecord, GroupsData } from './draw-types';
import { GroupCard } from './group-card';
import type { MemberSwapControl } from './group-member-list';
import { ManualTiebreakModal } from './manual-tiebreak-modal';
import { pickForSwap } from './member-swap-pick';
import { findSameClubGroups } from './same-club-groups';
import type { DrawCall } from './use-draw-call';

interface GroupTablesViewProps {
  data: GroupsData;
  canUpdate: boolean;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
  onWithdraw: (entry: EntryBrief) => void;
}

const NO_FLAGS: ReadonlySet<string> = new Set();

/** Few small groups per draw, so cards are unpaged (an explained exception to server-side lists). Draft: 4 / 2 / 1 columns; published tables need more room. */
export function GroupTablesView({ data, canUpdate, call, report, onChanged, onWithdraw }: GroupTablesViewProps) {
  const [tiebreak, setTiebreak] = useState<GroupRecord | null>(null);
  const screens = Grid.useBreakpoint();
  const { message } = App.useApp();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const canSwap = canUpdate && data.status === 'DRAFT' && !data.locked;

  useEffect(() => {
    if (pickedId === null) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setPickedId(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickedId]);

  const swapMembers = useCallback(
    async (entryA: string, entryB: string) => {
      setSwapping(true);
      try {
        await call(() => apiFetch(`/admin/draws/${data.id}/swap-group-members`, { method: 'POST', body: { entryA, entryB, expectedVersion: data.version } }));
        message.success('Đã đổi chỗ hai VĐV');
        await onChanged();
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-swap-entry="${entryB}"]`)?.focus());
      } catch (error) {
        report(error);
      } finally {
        setSwapping(false);
      }
    },
    [call, data.id, data.version, message, onChanged, report],
  );

  const swap: MemberSwapControl | undefined = canSwap
    ? {
        pickedId,
        busy: swapping,
        onPick: (entryId) => {
          const next = pickForSwap(pickedId, entryId);
          setPickedId(next.picked);
          if (next.swap) void swapMembers(next.swap[0], next.swap[1]);
        },
      }
    : undefined;
  const pickedName = data.groups.flatMap((g) => g.members).find((m) => m.entryId === pickedId)?.entry.displayName;
  const flags = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const conflict of findSameClubGroups(data.groups)) {
      const ids = map.get(conflict.groupId) ?? new Set<string>();
      conflict.entries.forEach((entry) => ids.add(entry.id));
      map.set(conflict.groupId, ids);
    }
    return map;
  }, [data.groups]);
  if (data.groups.length === 0) return <Empty description="Chưa có bảng" />;

  const draft = data.status === 'DRAFT';
  const columns = draft ? (screens.xl ? 4 : screens.md ? 2 : 1) : screens.xl ? 2 : 1;

  return (
    <>
      <div role="status">
        {pickedName && <Alert type="info" showIcon style={{ marginBottom: 12 }} message={`Đang chọn ${pickedName}. Chọn VĐV cần đổi chỗ cùng, hoặc nhấn Esc để hủy.`} />}
      </div>
      <div style={{ display: 'grid', gap: 16, alignItems: 'start', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {data.groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            canUpdate={canUpdate}
            canWithdraw={canUpdate && data.status === 'PUBLISHED'}
            draft={draft}
            flaggedIds={flags.get(group.id) ?? NO_FLAGS}
            swap={swap}
            call={call}
            report={report}
            onChanged={onChanged}
            onTiebreak={setTiebreak}
            onWithdraw={onWithdraw}
          />
        ))}
      </div>
      <ManualTiebreakModal group={tiebreak} call={call} onClose={() => setTiebreak(null)} onSaved={onChanged} />
    </>
  );
}
