import type { AutoMatch, AutoPlayer } from './auto-schedule-types.js';

const unplayedResult = (match: AutoMatch) => match.resultType === 'BYE' || match.resultType === 'WALKOVER';

/** Conservative participant sets let later rounds reserve rest for every possible winner, including pairs. */
export function autoScheduleDependencies(matches: AutoMatch[]) {
  const byNo = new Map(matches.map((match) => [match.matchNo, match]));
  const preceding = new Map<string, number[]>();
  for (const match of matches) {
    if (match.nextMatchId) preceding.set(match.nextMatchId, [...(preceding.get(match.nextMatchId) ?? []), match.matchNo]);
  }
  const feederNos = (match: AutoMatch) => [...new Set([
    ...match.sides.flatMap((side) => side.feederNo === null ? [] : [side.feederNo]),
    ...(preceding.get(match.id) ?? []),
  ])];
  const players = new Map<string, AutoPlayer[] | null>();
  const resolvePlayers = (match: AutoMatch, path = new Set<string>()): AutoPlayer[] | null => {
    if (players.has(match.id)) return players.get(match.id)!;
    if (path.has(match.id)) return null;
    const nextPath = new Set(path).add(match.id);
    const possible: AutoPlayer[] = [];
    for (const side of match.sides) {
      if (side.players.length > 0) possible.push(...side.players);
      else if (side.feederNo !== null) {
        const feeder = byNo.get(side.feederNo);
        const winner = feeder?.status === 'OFFICIAL' && (feeder.winnerSide === 1 || feeder.winnerSide === 2)
          ? feeder.sides[feeder.winnerSide - 1] : undefined;
        const inherited = winner?.players.length ? winner.players : feeder && resolvePlayers(feeder, nextPath);
        if (!inherited) { players.set(match.id, null); return null; }
        possible.push(...inherited);
      } else if (!unplayedResult(match)) { players.set(match.id, null); return null; }
    }
    const distinct = [...new Map(possible.map((player) => [player.id, player])).values()].sort((a, b) => a.id.localeCompare(b.id));
    players.set(match.id, distinct.length ? distinct : null);
    return players.get(match.id)!;
  };

  const dependencies = new Map<string, AutoMatch[] | null>();
  const resolveDependencies = (match: AutoMatch, path = new Set<string>()): AutoMatch[] | null => {
    if (dependencies.has(match.id)) return dependencies.get(match.id)!;
    if (path.has(match.id)) return null;
    const found: AutoMatch[] = [];
    for (const no of feederNos(match)) {
      const feeder = byNo.get(no);
      if (!feeder) return null;
      if (unplayedResult(feeder)) {
        const inherited = resolveDependencies(feeder, new Set(path).add(match.id));
        if (!inherited) return null;
        found.push(...inherited);
      } else found.push(feeder);
    }
    const distinct = [...new Map(found.map((feeder) => [feeder.id, feeder])).values()];
    dependencies.set(match.id, distinct);
    return distinct;
  };

  for (const match of matches) { resolvePlayers(match); resolveDependencies(match); }
  return { players, dependencies };
}
