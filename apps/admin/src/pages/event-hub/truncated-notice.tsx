import { Alert } from 'antd';

interface TruncatedNoticeProps {
  /** What the screen does with the shown part: "hiện" on the grid, "in" on paper. */
  action: 'hiện' | 'in';
  shown: number;
  total?: number;
}

/** Same wording wherever a session's match list was cut at the server cap. */
export function TruncatedNotice({ action, shown, total }: TruncatedNoticeProps) {
  const size = total === undefined ? 'nhiều trận hơn' : `${total} trận`;
  return <Alert type="warning" showIcon message={`Buổi này có ${size}, chỉ ${action} ${shown} trận đầu.`} />;
}
