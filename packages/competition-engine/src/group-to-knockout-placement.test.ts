import { describe, expect, it } from 'vitest';
import { partnerPosition } from './bracket-size.js';
import { groupCodes } from './group-allocation.js';
import { placeGroupsInKnockout } from './group-to-knockout-placement.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError, type KnockoutDraw } from './types.js';

const positionOfPlace = (draw: KnockoutDraw, group: string, place: number) =>
  draw.positions.find((p) => p.sourceRef?.type === 'GROUP_PLACE' && p.sourceRef.group === group && p.sourceRef.place === place)?.position as number;

describe('4 groups x 2 advancing', () => {
  it('seeds winners apart and puts each runner-up in the half opposite its winner', () => {
    for (let i = 0; i < 40; i++) {
      const draw = placeGroupsInKnockout({ groupCodes: groupCodes(4), advancePerGroup: 2, rng: createRng(`g${i}`) });
      expect(draw.size).toBe(8);
      expect(draw.byeCount).toBe(0);
      const winners = ['A', 'B', 'C', 'D'].map((g) => positionOfPlace(draw, g, 1));
      expect(winners[0]).toBe(1);
      expect(winners[1]).toBe(8);
      for (const g of ['A', 'B', 'C', 'D']) {
        const winnerHalf = positionOfPlace(draw, g, 1) <= 4;
        const runnerHalf = positionOfPlace(draw, g, 2) <= 4;
        expect(runnerHalf).toBe(!winnerHalf);
      }
    }
  });

  it('labels every round-1 side with its group place', () => {
    const draw = placeGroupsInKnockout({ groupCodes: groupCodes(4), advancePerGroup: 2, rng: createRng('labels') });
    const round1 = draw.matches.filter((m) => m.roundNumber === 1);
    expect(round1.every((m) => m.side1Source?.type === 'GROUP_PLACE' && m.side2Source?.type === 'GROUP_PLACE')).toBe(true);
    expect(draw.rounds.map((r) => r.code)).toEqual(['QF', 'SF', 'F']);
  });
});

describe('placement across group counts', () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 16])('%i groups x 2: never fails, halves respected, no BYE vs BYE', (groups) => {
    for (let i = 0; i < 25; i++) {
      const draw = placeGroupsInKnockout({ groupCodes: groupCodes(groups), advancePerGroup: 2, rng: createRng(`k${groups}-${i}`) });
      const half = draw.size / 2;
      expect(draw.positions.filter((p) => p.source === 'GROUP_PLACE')).toHaveLength(groups * 2);
      expect(draw.positions.filter((p) => p.source === 'BYE')).toHaveLength(draw.size - groups * 2);
      for (const g of groupCodes(groups)) {
        expect(positionOfPlace(draw, g, 1) <= half).not.toBe(positionOfPlace(draw, g, 2) <= half);
      }
      for (const p of draw.positions) {
        if (p.source === 'BYE') expect(draw.positions[partnerPosition(p.position) - 1]?.source).toBe('GROUP_PLACE');
      }
    }
  });

  it.each([2, 3, 4, 5, 6, 8, 11, 16])('%i groups x 1: winners only, BYEs next to group places', (groups) => {
    for (let i = 0; i < 15; i++) {
      const draw = placeGroupsInKnockout({ groupCodes: groupCodes(groups), advancePerGroup: 1, rng: createRng(`w${groups}-${i}`) });
      expect(draw.positions.filter((p) => p.source === 'GROUP_PLACE')).toHaveLength(groups);
      expect(draw.positions.every((p) => p.sourceRef?.type !== 'GROUP_PLACE' || p.sourceRef.place === 1)).toBe(true);
    }
  });

  it('is deterministic per seed', () => {
    const run = (key: string) => placeGroupsInKnockout({ groupCodes: groupCodes(6), advancePerGroup: 2, rng: createRng(key) });
    expect(run('x')).toEqual(run('x'));
    expect(run('x').positions).not.toEqual(run('y').positions);
  });
});

describe('validation', () => {
  it('accepts only advancePerGroup 1 or 2', () => {
    for (const bad of [0, 3, 1.5]) {
      expect(() => placeGroupsInKnockout({ groupCodes: groupCodes(4), advancePerGroup: bad, rng: createRng('v') })).toThrow(DrawParamsError);
    }
  });

  it('needs at least two qualifiers', () => {
    expect(() => placeGroupsInKnockout({ groupCodes: ['A'], advancePerGroup: 1, rng: createRng('v') })).toThrow(DrawParamsError);
  });
});
