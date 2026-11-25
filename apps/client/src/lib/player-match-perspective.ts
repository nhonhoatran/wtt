import type { PublicGame, PublicMatchCard, PublicSide } from '@kamito/shared';

export interface PlayerPerspective {
  ownSide: 1 | 2 | null;
  opponent: PublicSide | null;
  /** The player's own side without the player; null in singles. */
  partner: PublicSide | null;
  outcome: 'win' | 'loss' | null;
  ownGames: number | null;
  opponentGames: number | null;
  /** Game scores written from the player's side: own points first. */
  games: Array<Pick<PublicGame, 'number'> & { own: number; opponent: number }>;
}

type Match = Pick<PublicMatchCard, 'side1' | 'side2' | 'winnerSide' | 'games1' | 'games2' | 'games'>;

const hasPlayer = (side: PublicSide | null, slug: string) => side?.players.some((p) => p.slug === slug) ?? false;

/** Reads a match from the point of view of one player, matched by the canonical profile slug. */
export function playerPerspective(match: Match, slug: string): PlayerPerspective {
  const ownSide = hasPlayer(match.side1, slug) ? 1 : hasPlayer(match.side2, slug) ? 2 : null;
  if (ownSide === null) return { ownSide, opponent: null, partner: null, outcome: null, ownGames: null, opponentGames: null, games: [] };
  const mine = ownSide === 1;
  const own = mine ? match.side1 : match.side2;
  return {
    ownSide,
    partner: own && own.players.length > 1 ? { ...own, players: own.players.filter((p) => p.slug !== slug) } : null,
    opponent: mine ? match.side2 : match.side1,
    outcome: match.winnerSide === null ? null : match.winnerSide === ownSide ? 'win' : 'loss',
    ownGames: mine ? match.games1 : match.games2,
    opponentGames: mine ? match.games2 : match.games1,
    games: match.games.map((g) => ({ number: g.number, own: mine ? g.score1 : g.score2, opponent: mine ? g.score2 : g.score1 })),
  };
}
