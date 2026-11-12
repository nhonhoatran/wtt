export type EvictionVerdict =
  | { status: 'ok'; policy: string }
  | { status: 'overridden'; policy: string | undefined; message: string }
  | { status: 'degraded'; policy: string | undefined; message: string }
  | { status: 'fatal'; policy: string | undefined; message: string };

export interface EvictionCheckInput {
  policy: string | undefined;
  appEnv: string;
  override?: string;
}

/**
 * BullMQ loses jobs under any eviction policy other than noeviction.
 * Production refuses to run unless an explicit, manually verified override is set.
 */
export function judgeEvictionPolicy({ policy, appEnv, override }: EvictionCheckInput): EvictionVerdict {
  if (policy === 'noeviction') return { status: 'ok', policy };
  const message =
    policy === undefined
      ? 'Cannot read Redis maxmemory-policy (CONFIG GET denied or unavailable)'
      : `Redis maxmemory-policy is "${policy}", BullMQ requires "noeviction"`;
  // The override only covers an unreadable policy (e.g. CONFIG disabled); a known-bad policy is never waived.
  if (policy === undefined && override && override.trim() !== '') return { status: 'overridden', policy, message };
  if (appEnv === 'production') return { status: 'fatal', policy, message };
  return { status: 'degraded', policy, message };
}

/** Reads maxmemory-policy from a CONFIG GET reply (["maxmemory-policy", "<value>"]). */
export function parseConfigGetReply(reply: unknown): string | undefined {
  if (!Array.isArray(reply) || reply.length < 2) return undefined;
  const value = reply[1];
  return typeof value === 'string' ? value : undefined;
}
