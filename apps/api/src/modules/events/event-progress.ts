/** Smallest confirmed field a draw can be generated from; a technical floor, not a policy. */
export const MIN_ENTRIES_FOR_DRAW = 2;

export type DrawKindName = 'QUALIFYING' | 'MAIN' | 'GROUP';

export interface ProgressSubEvent {
  format: 'KNOCKOUT' | 'GROUP_KNOCKOUT';
  hasQualifying: boolean;
  draws: { kind: DrawKindName; status: 'DRAFT' | 'PUBLISHED' }[];
}

export function requiredDrawKinds(subEvent: Pick<ProgressSubEvent, 'format' | 'hasQualifying'>): DrawKindName[] {
  const kinds: DrawKindName[] = ['MAIN'];
  if (subEvent.format === 'GROUP_KNOCKOUT') kinds.push('GROUP');
  if (subEvent.hasQualifying) kinds.push('QUALIFYING');
  return kinds;
}

export function isDrawDone(subEvent: ProgressSubEvent): boolean {
  const published = new Set(subEvent.draws.filter((draw) => draw.status === 'PUBLISHED').map((draw) => draw.kind));
  return requiredDrawKinds(subEvent).every((kind) => published.has(kind));
}

export interface EventProgress {
  subEvents: number;
  entries: { confirmed: number; subEventsReady: number };
  draws: { subEventsDone: number; subEventsStarted: number; total: number };
  matches: { total: number; scheduled: number; official: number };
}

export function summarizeProgress(
  subEvents: ProgressSubEvent[],
  confirmedBySubEvent: number[],
  matches: { total: number; unscheduled: number; official: number },
): EventProgress {
  return {
    subEvents: subEvents.length,
    entries: {
      confirmed: confirmedBySubEvent.reduce((sum, count) => sum + count, 0),
      subEventsReady: confirmedBySubEvent.filter((count) => count >= MIN_ENTRIES_FOR_DRAW).length,
    },
    draws: {
      subEventsDone: subEvents.filter(isDrawDone).length,
      subEventsStarted: subEvents.filter((subEvent) => subEvent.draws.length > 0).length,
      total: subEvents.length,
    },
    matches: { total: matches.total, scheduled: matches.total - matches.unscheduled, official: matches.official },
  };
}
