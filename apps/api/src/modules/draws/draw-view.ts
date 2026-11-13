import type { Draw } from '@kamito/db';

/** `randomSeed` replays a draw, so reads omit it unless the caller may write draws. */
export function toDrawSummary(draw: Draw, locked: boolean, includeSeed = true) {
  return {
    id: draw.id,
    subEventId: draw.subEventId,
    kind: draw.kind,
    status: draw.status,
    locked,
    version: draw.version,
    size: draw.size,
    seedCount: draw.seedCount,
    qualifierCount: draw.qualifierCount,
    groupCount: draw.groupCount,
    advancePerGroup: draw.advancePerGroup,
    ...(includeSeed && { randomSeed: draw.randomSeed }),
    publishedAt: draw.publishedAt,
  };
}

/** What an audit row keeps about a draw so a dispute can replay it: seed plus the parameters. */
export function drawAuditFields(draw: Pick<Draw, 'kind' | 'randomSeed' | 'size' | 'seedCount' | 'qualifierCount' | 'groupCount' | 'advancePerGroup' | 'version'>) {
  return {
    kind: draw.kind,
    randomSeed: draw.randomSeed,
    version: draw.version,
    params: {
      size: draw.size,
      seedCount: draw.seedCount,
      qualifierCount: draw.qualifierCount,
      groupCount: draw.groupCount,
      advancePerGroup: draw.advancePerGroup,
    },
  };
}
