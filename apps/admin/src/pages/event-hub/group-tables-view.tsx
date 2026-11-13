import { Empty, Flex } from 'antd';
import { useState } from 'react';
import type { GroupRecord, GroupsData } from './draw-types';
import { GroupCard } from './group-card';
import { ManualTiebreakModal } from './manual-tiebreak-modal';
import type { DrawCall } from './use-draw-call';

interface GroupTablesViewProps {
  data: GroupsData;
  canUpdate: boolean;
  call: DrawCall;
  report: (error: unknown) => void;
  onChanged: () => Promise<unknown>;
}

/** Few small groups per draw, so tables are fixed and unpaged (an explained exception to server-side lists). */
export function GroupTablesView({ data, canUpdate, call, report, onChanged }: GroupTablesViewProps) {
  const [tiebreak, setTiebreak] = useState<GroupRecord | null>(null);
  if (data.groups.length === 0) return <Empty description="Chưa có bảng" />;

  return (
    <>
      <Flex wrap gap="middle" align="start">
        {data.groups.map((group) => (
          <GroupCard key={group.id} group={group} canUpdate={canUpdate} call={call} report={report} onChanged={onChanged} onTiebreak={setTiebreak} />
        ))}
      </Flex>
      <ManualTiebreakModal group={tiebreak} call={call} onClose={() => setTiebreak(null)} onSaved={onChanged} />
    </>
  );
}
