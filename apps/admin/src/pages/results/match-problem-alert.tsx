import { Alert, Button } from 'antd';
import type { ReactNode } from 'react';
import type { MatchProblem } from './use-match-actions';

interface MatchProblemAlertProps {
  problem: MatchProblem;
  onReload: () => void;
  /** Replaces the default "Tải lại" action on conflicts. */
  action?: ReactNode;
}

export function MatchProblemAlert({ problem, onReload, action }: MatchProblemAlertProps) {
  return (
    <Alert
      type="error"
      showIcon
      message={problem.text}
      description={problem.kind === 'issues' ? problem.issues.map((issue) => <div key={issue}>{issue}</div>) : undefined}
      action={action ?? (problem.kind === 'conflict' ? <Button onClick={onReload}>Tải lại</Button> : undefined)}
    />
  );
}
