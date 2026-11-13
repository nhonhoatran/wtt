import { describe, expect, it } from 'vitest';
import { partnerPosition } from './bracket-size.js';
import { generateKnockout } from './knockout-generator.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError, type DrawEntry, type KnockoutDraw } from './types.js';

const makeEntries = (count: number, seeded = 0): DrawEntry[] =>
  Array.from({ length: count }, (_, i) => ({ id: `E${i + 1}`, seed: i < seeded ? i + 1 : null }));

const positionOf = (draw: KnockoutDraw, entryId: string) => draw.positions.find((p) => p.entryId === entryId)?.position as number;
const sectionOf = (position: number, size: number, sections: number) => Math.floor((position - 1) / (size / sections));

function assertNoByeVsBye(draw: KnockoutDraw) {
  for (const p of draw.positions) {
    if (p.source === 'BYE') expect(draw.positions[partnerPosition(p.position) - 1]?.source).not.toBe('BYE');
  }
}

describe('generateKnockout sizes and BYEs', () => {
  it.each([
    [2, 2, 0],
    [3, 4, 1],
    [5, 8, 3],
    [8, 8, 0],
    [17, 32, 15],
    [51, 64, 13],
    [64, 64, 0],
    [100, 128, 28],
    [128, 128, 0],
  ])('n=%i -> size %i with %i BYEs, no BYE vs BYE, every entry placed once', (n, size, byes) => {
    const draw = generateKnockout({ entries: makeEntries(n, Math.min(Math.floor(size / 4), n)), seedCount: Math.floor(size / 4), rng: createRng(`n${n}`) });
    expect(draw.size).toBe(size);
    expect(draw.byeCount).toBe(byes);
    expect(draw.positions.filter((p) => p.source === 'BYE')).toHaveLength(byes);
    expect(new Set(draw.positions.map((p) => p.entryId).filter(Boolean)).size).toBe(n);
    assertNoByeVsBye(draw);
    expect(draw.matches.filter((m) => m.bye)).toHaveLength(byes);
    expect(draw.matches.every((m) => (m.bye ? m.status === 'OFFICIAL' : m.status === 'SCHEDULED'))).toBe(true);
  });

  it('works without seeds', () => {
    const draw = generateKnockout({ entries: makeEntries(11), seedCount: 0, rng: createRng('noseed') });
    expect(draw.size).toBe(16);
    assertNoByeVsBye(draw);
  });
});

describe('51 entries / bracket 64 / 16 seeds', () => {
  const run = (key: string) => generateKnockout({ entries: makeEntries(51, 16), seedCount: 16, rng: createRng(key) });

  it('separates seeds by half, quarter, eighth', () => {
    for (let i = 0; i < 15; i++) {
      const draw = run(`seed-${i}`);
      const at = (seed: number) => positionOf(draw, `E${seed}`);
      expect(sectionOf(at(1), 64, 2)).not.toBe(sectionOf(at(2), 64, 2));
      expect(new Set([1, 2, 3, 4].map((s) => sectionOf(at(s), 64, 4))).size).toBe(4);
      expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => sectionOf(at(s), 64, 8))).size).toBe(8);
    }
  });

  it('gives the 13 BYEs to the opponents of seeds 1-13', () => {
    for (let i = 0; i < 15; i++) {
      const draw = run(`bye-${i}`);
      expect(draw.byeCount).toBe(13);
      for (let seed = 1; seed <= 13; seed++) {
        const partner = draw.positions[partnerPosition(positionOf(draw, `E${seed}`)) - 1];
        expect(partner?.source).toBe('BYE');
      }
      for (let seed = 14; seed <= 16; seed++) {
        const partner = draw.positions[partnerPosition(positionOf(draw, `E${seed}`)) - 1];
        expect(partner?.source).toBe('ENTRY');
      }
    }
  });

  it('is identical for the same seed and different for another', () => {
    expect(run('same')).toEqual(run('same'));
    expect(run('same').positions).not.toEqual(run('other').positions);
  });
});

describe('qualifier slots Q1..Qk', () => {
  it('places every Q away from BYEs, with indexes 1..k and labelled round-1 sides', () => {
    for (let i = 0; i < 25; i++) {
      const draw = generateKnockout({ entries: makeEntries(26, 8), seedCount: 8, qualifierSlots: 6, rng: createRng(`q${i}`) });
      expect(draw.size).toBe(32);
      const slots = draw.positions.filter((p) => p.source === 'QUALIFIER');
      expect(slots.map((p) => p.sourceRef).sort((a, b) => (a as { index: number }).index - (b as { index: number }).index)).toEqual(
        [1, 2, 3, 4, 5, 6].map((index) => ({ type: 'QUALIFIER', index })),
      );
      for (const slot of slots) expect(draw.positions[partnerPosition(slot.position) - 1]?.source).not.toBe('BYE');
      const labelled = draw.matches.flatMap((m) => [m.side1Source, m.side2Source]).filter((s) => s?.type === 'QUALIFIER');
      expect(labelled).toHaveLength(6);
    }
  });

  it('counts qualifier slots into the bracket size', () => {
    const draw = generateKnockout({ entries: makeEntries(5), seedCount: 0, qualifierSlots: 3, rng: createRng('size') });
    expect(draw.size).toBe(8);
    expect(draw.byeCount).toBe(0);
  });

  it('fails when qualifier slots cannot avoid BYEs', () => {
    expect(() => generateKnockout({ entries: makeEntries(1), seedCount: 0, qualifierSlots: 5, rng: createRng('x') })).toThrow(DrawParamsError);
  });
});

describe('validation', () => {
  it('rejects too few participants, duplicate entries, duplicate seeds and oversized seed counts', () => {
    const rng = createRng('v');
    expect(() => generateKnockout({ entries: makeEntries(1), seedCount: 0, rng })).toThrow(DrawParamsError);
    expect(() => generateKnockout({ entries: [{ id: 'A' }, { id: 'A' }], seedCount: 0, rng })).toThrow(DrawParamsError);
    expect(() => generateKnockout({ entries: [{ id: 'A', seed: 1 }, { id: 'B', seed: 1 }, { id: 'C' }, { id: 'D' }], seedCount: 2, rng })).toThrow(DrawParamsError);
    expect(() => generateKnockout({ entries: makeEntries(8), seedCount: 5, rng })).toThrow(DrawParamsError);
  });

  it('treats seeds above seedCount and withdrawn (null) seeds as unseeded', () => {
    const entries: DrawEntry[] = [{ id: 'A', seed: 1 }, { id: 'B', seed: 9 }, { id: 'C', seed: null }, { id: 'D' }];
    const draw = generateKnockout({ entries, seedCount: 2, rng: createRng('u') });
    expect(positionOf(draw, 'A')).toBe(1);
    expect(draw.positions.filter((p) => p.source === 'ENTRY')).toHaveLength(4);
  });
});

describe('performance', () => {
  it('generates a 128 bracket with 32 seeds in under one second', () => {
    const started = performance.now();
    const draw = generateKnockout({ entries: makeEntries(128, 32), seedCount: 32, rng: createRng('perf') });
    expect(performance.now() - started).toBeLessThan(1000);
    expect(draw.matches).toHaveLength(127);
  });
});
