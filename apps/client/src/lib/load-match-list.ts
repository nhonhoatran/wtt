import { PUBLIC_MATCH_STATES, type PublicEventCard, type PublicMatchList, type PublicMatchState } from '@kamito/shared';

const STATE_ORDER = {
  ONGOING: ['live', 'upcoming', 'completed'],
  UPCOMING: ['upcoming', 'live', 'completed'],
  COMPLETED: ['completed', 'live', 'upcoming'],
} as const satisfies Record<PublicEventCard['lifecycle'], readonly PublicMatchState[]>;

/** Explicit tabs stay selected; an automatic tab stops at the first state containing filtered matches. */
export async function loadMatchList(
  lifecycle: PublicEventCard['lifecycle'],
  requested: unknown,
  fetchState: (state: PublicMatchState) => Promise<PublicMatchList | null>,
) {
  const explicit = typeof requested === 'string' && (PUBLIC_MATCH_STATES as readonly string[]).includes(requested);
  const states = explicit ? [requested as PublicMatchState] : STATE_ORDER[lifecycle];
  let state = states[0]!;
  let list: PublicMatchList | null = null;
  for (state of states) {
    list = await fetchState(state);
    if (!list || list.total > 0) break;
  }
  return { state, list };
}
