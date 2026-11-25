import { appSettingRegistry, type PUBLIC_DRAW_KINDS, type PublicBracketRound, type PublicDrawKind, type PublicMatchCard, type PublicMatchDetail } from '@kamito/shared';
import { getBracket, getGroups, getSiteConfig } from './public-data';

export interface MatchContext {
  /** Rounds of the knockout section holding the match; null for group matches or when the draw is unavailable. */
  rounds: PublicBracketRound[] | null;
  /** Matches of the match's own group; null outside group play or when unavailable. */
  groupMatches: PublicMatchCard[] | null;
  /** How many neighbouring matches the sidebar lists. */
  listLimit: number;
}

const KIND_PARAM: Record<PublicDrawKind, keyof typeof PUBLIC_DRAW_KINDS> = { MAIN: 'main', QUALIFYING: 'qualifying' };

/** Secondary data for the match page: a failure hides the related blocks instead of failing the page. */
export async function loadMatchContext(m: PublicMatchDetail): Promise<MatchContext> {
  const slug = m.event.slug;
  const [config, rounds, groupMatches] = await Promise.all([
    getSiteConfig().catch(() => null),
    m.drawKind === 'GROUP'
      ? null
      : getBracket(slug, m.subEvent.code, KIND_PARAM[m.drawKind])
          .then((bracket) => bracket?.sections.find((s) => s.rounds.some((r) => r.matches.some((x) => x.matchNo === m.matchNo)))?.rounds ?? null)
          .catch(() => null),
    m.drawKind === 'GROUP'
      ? getGroups(slug, m.subEvent.code)
          .then((data) => data?.groups.find((g) => g.code === m.groupCode)?.matches ?? null)
          .catch(() => null)
      : null,
  ]);
  return { rounds, groupMatches, listLimit: config?.display?.matchRelatedLimit ?? appSettingRegistry.matchRelatedLimit.defaultValue };
}
