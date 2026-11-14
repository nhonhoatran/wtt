import type { AuthTestKit } from './auth-test-kit.js';
import type { RankingWorld } from './ranking-test-kit.js';

export interface BuiltRound {
  number: number;
  code: string;
  matchIds: string[];
}

export interface BuiltDraw {
  drawId: string;
  rounds: BuiltRound[];
}

/**
 * Knockout draw straight in the DB. `slots` has 2^codes.length entries for round 1 (null = BYE);
 * `codes` are the round codes from first round to final.
 */
export async function buildKnockout(
  kit: AuthTestKit,
  world: RankingWorld,
  input: { kind?: 'MAIN' | 'QUALIFYING'; slots: (string | null)[]; codes: string[] },
): Promise<BuiltDraw> {
  const { prisma } = kit;
  const draw = await prisma.draw.create({
    data: { subEventId: world.subEventId, kind: input.kind ?? 'MAIN', status: 'PUBLISHED', randomSeed: 'ranking-test' },
  });
  const rounds: BuiltRound[] = [];
  const roundIds: string[] = [];
  for (const [index, code] of input.codes.entries()) {
    const round = await prisma.round.create({ data: { drawId: draw.id, scopeKey: 'S1', number: index + 1, code } });
    roundIds.push(round.id);
    rounds.push({ number: index + 1, code, matchIds: [] });
  }

  // Final first, so each match already knows where its winner goes.
  const matchIdsByRound: string[][] = input.codes.map(() => []);
  for (let r = input.codes.length - 1; r >= 0; r -= 1) {
    const count = input.slots.length / 2 ** (r + 1);
    for (let i = 0; i < count; i += 1) {
      const next = r + 1 < input.codes.length ? matchIdsByRound[r + 1]![Math.floor(i / 2)]! : null;
      const side1 = r === 0 ? input.slots[2 * i]! : null;
      const side2 = r === 0 ? input.slots[2 * i + 1]! : null;
      const bye = r === 0 && (side1 === null || side2 === null);
      const match = await prisma.match.create({
        data: {
          eventId: world.eventId,
          subEventId: world.subEventId,
          drawId: draw.id,
          roundId: roundIds[r]!,
          orderInRound: i + 1,
          matchNo: world.nextMatchNo++,
          side1EntryId: side1,
          side2EntryId: side2,
          nextMatchId: next,
          nextMatchSide: next ? (i % 2) + 1 : null,
          ...(bye ? { status: 'OFFICIAL' as const, resultType: 'BYE' as const, winnerSide: side1 ? 1 : 2 } : {}),
        },
      });
      matchIdsByRound[r]!.push(match.id);
      if (bye && next) {
        await prisma.match.update({ where: { id: next }, data: { [i % 2 === 0 ? 'side1EntryId' : 'side2EntryId']: side1 ?? side2 } });
      }
    }
  }
  matchIdsByRound.forEach((ids, r) => (rounds[r]!.matchIds = ids));
  return { drawId: draw.id, rounds };
}

export interface PlayOptions {
  /** Last round number to play (default: all). */
  through?: number;
  resultType?: 'NORMAL' | 'WALKOVER';
}

/** Plays rounds in order; `pick` returns the winning side (1 or 2) of a match with both sides known. */
export async function playRounds(
  kit: AuthTestKit,
  built: BuiltDraw,
  pick: (match: { roundCode: string; side1EntryId: string; side2EntryId: string }) => 1 | 2,
  options: PlayOptions = {},
): Promise<void> {
  for (const round of built.rounds) {
    if (options.through !== undefined && round.number > options.through) return;
    for (const id of round.matchIds) {
      const match = await kit.prisma.match.findUniqueOrThrow({ where: { id } });
      if (match.status === 'OFFICIAL' || !match.side1EntryId || !match.side2EntryId) continue;
      const winnerSide = pick({ roundCode: round.code, side1EntryId: match.side1EntryId, side2EntryId: match.side2EntryId });
      await kit.prisma.match.update({
        where: { id },
        data: { status: 'OFFICIAL', resultType: options.resultType ?? 'NORMAL', winnerSide, games1: winnerSide === 1 ? 3 : 0, games2: winnerSide === 2 ? 3 : 0 },
      });
      if (match.nextMatchId) {
        const winner = winnerSide === 1 ? match.side1EntryId : match.side2EntryId;
        await kit.prisma.match.update({ where: { id: match.nextMatchId }, data: { [match.nextMatchSide === 1 ? 'side1EntryId' : 'side2EntryId']: winner } });
      }
    }
  }
}

/** One group of three-plus entries; every pair plays, lower index wins. `finished: false` leaves the last match open. */
export async function buildGroup(
  kit: AuthTestKit,
  world: RankingWorld,
  input: { entryIds: string[]; qualifiedCount: number; finished?: boolean },
): Promise<void> {
  const { prisma } = kit;
  const draw = await prisma.draw.create({ data: { subEventId: world.subEventId, kind: 'GROUP', status: 'PUBLISHED', randomSeed: 'ranking-test' } });
  const group = await prisma.group.create({ data: { drawId: draw.id, code: 'A', order: 1 } });
  const round = await prisma.round.create({ data: { drawId: draw.id, groupId: group.id, scopeKey: 'G-A', number: 1, code: 'GR1' } });
  const pairs = input.entryIds.flatMap((a, i) => input.entryIds.slice(i + 1).map((b) => [a, b] as const));
  for (const [index, [a, b]] of pairs.entries()) {
    const open = input.finished === false && index === pairs.length - 1;
    await prisma.match.create({
      data: {
        eventId: world.eventId, subEventId: world.subEventId, drawId: draw.id, roundId: round.id, groupId: group.id,
        orderInRound: index + 1, matchNo: world.nextMatchNo++, side1EntryId: a, side2EntryId: b,
        ...(open ? {} : { status: 'OFFICIAL' as const, resultType: 'NORMAL' as const, winnerSide: 1, games1: 3, games2: 0 }),
      },
    });
  }
  for (const [index, entryId] of input.entryIds.entries()) {
    await prisma.groupMember.create({ data: { groupId: group.id, entryId, slot: index + 1 } });
    await prisma.groupStanding.create({ data: { groupId: group.id, entryId, rank: index + 1, qualified: index < input.qualifiedCount } });
  }
}
