import { Flex, Typography } from 'antd';
import { roundTitle } from './draw-labels';
import type { GroupRecord } from './draw-types';

/** Round-robin fixtures per matchday; a member without a match that day rests ("Nghỉ"). */
export function GroupSchedule({ group }: { group: GroupRecord }) {
  const days = [...new Set(group.matches.map((match) => match.roundNumber))].sort((a, b) => a - b);
  if (days.length === 0) return <Typography.Text type="secondary">—</Typography.Text>;

  return (
    <Flex vertical gap="small">
      {days.map((day) => {
        const matches = group.matches.filter((match) => match.roundNumber === day).sort((a, b) => a.orderInRound - b.orderInRound);
        const playing = new Set(matches.flatMap((match) => [match.side1?.id, match.side2?.id]));
        const resting = group.members.filter((member) => !playing.has(member.entryId));
        return (
          <Flex key={day} vertical>
            <Typography.Text strong>{roundTitle(matches[0]?.roundCode ?? `GR${day}`)}</Typography.Text>
            {matches.map((match) => (
              <Typography.Text key={match.id}>
                #{match.matchNo} · {match.side1?.displayName ?? '—'} – {match.side2?.displayName ?? '—'}
              </Typography.Text>
            ))}
            {resting.map((member) => (
              <Typography.Text key={member.entryId} type="secondary">
                Nghỉ · {member.entry.displayName}
              </Typography.Text>
            ))}
          </Flex>
        );
      })}
    </Flex>
  );
}
