/** Queue names; the Redis key prefix (QUEUE_PREFIX) is applied separately per environment. */
export const QueueName = {
  Maintenance: 'maintenance',
  Media: 'media',
  Import: 'import',
  Revalidate: 'revalidate',
  Ranking: 'ranking',
} as const;

export type QueueName = (typeof QueueName)[keyof typeof QueueName];

export const QUEUE_PREFIX_NAMESPACE = 'kamito-tt';

/** Prefix must be "kamito-tt:<APP_ENV>" (optionally with more segments) so environments never share keys. */
export function isQueuePrefixValid(prefix: string | undefined, appEnv: string): prefix is string {
  if (!prefix || !appEnv) return false;
  const [namespace, env] = prefix.split(':');
  return namespace === QUEUE_PREFIX_NAMESPACE && env === appEnv;
}

export const RANKING_RECOMPUTE_JOB = 'recompute-sub-event';
export const RANKING_SNAPSHOT_JOB = 'build-snapshot';
export const RANKING_SWEEP_JOB = 'sweep-dirty-sub-events';
