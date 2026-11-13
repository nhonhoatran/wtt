import { describe, expect, it } from 'vitest';
import { generateQualifying } from './qualifying-generator.js';
import { createRng } from './seeded-random.js';
import { DrawParamsError, type DrawEntry } from './types.js';

const makeEntries = (count: number, seeded: number): DrawEntry[] =>
  Array.from({ length: count }, (_, i) => ({ id: `E${i + 1}`, seed: i < seeded ? i + 1 : null }));

const entryCountOf = (draw: ReturnType<typeof generateQualifying>, section: number) =>
  draw.positions.filter((p) => p.section === section && p.source === 'ENTRY').length;

describe.each([8, 6])('qualifying with 40 entries and k=%i', (k) => {
  const draw = generateQualifying({ entries: makeEntries(40, k), sectionCount: k, rng: createRng(`q${k}`) });

  it('builds k independent sections whose sizes differ by at most one', () => {
    expect(draw.sections).toHaveLength(k);
    const counts = draw.sections.map((s) => s.entryCount);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(40);
    draw.sections.forEach((s) => expect(entryCountOf(draw, s.section)).toBe(s.entryCount));
    expect(new Set(draw.positions.map((p) => p.entryId).filter(Boolean)).size).toBe(40);
  });

  it('puts exactly one qualifying seed in each section (positions 1 as top seed)', () => {
    for (let section = 1; section <= k; section++) {
      const seeded = draw.positions.filter((p) => p.section === section && p.entryId && /^E[1-9]$/.test(p.entryId) && Number(p.entryId.slice(1)) <= k);
      expect(seeded).toHaveLength(1);
      expect(seeded[0]?.position).toBe(1);
    }
  });

  it('scopes matches and rounds per section and ends every section in QF-1', () => {
    for (const s of draw.sections) {
      const rounds = draw.rounds.filter((r) => r.scopeKey === s.scopeKey);
      expect(rounds.at(-1)?.code).toBe('QF-1');
      expect(rounds[0]?.code).toBe(`QF-${rounds.length}`);
      const last = draw.matches.filter((m) => m.scopeKey === s.scopeKey && m.roundNumber === rounds.length);
      expect(last).toHaveLength(1);
      expect(last[0]?.next).toBeUndefined();
    }
  });
});

describe('sections with different bracket sizes', () => {
  it('still ends in QF-1 for the section final', () => {
    const draw = generateQualifying({ entries: makeEntries(17, 2), sectionCount: 2, rng: createRng('uneven') });
    const sizes = draw.sections.map((s) => s.size).sort((a, b) => a - b);
    expect(sizes).toEqual([8, 16]);
    for (const s of draw.sections) {
      const codes = draw.rounds.filter((r) => r.scopeKey === s.scopeKey).map((r) => r.code);
      expect(codes.at(-1)).toBe('QF-1');
      expect(codes).toHaveLength(Math.log2(s.size));
    }
  });
});

describe('qualifying edge cases', () => {
  it('works without seeds and is deterministic', () => {
    const run = (key: string) => generateQualifying({ entries: makeEntries(10, 0), sectionCount: 2, rng: createRng(key) });
    expect(run('a')).toEqual(run('a'));
    expect(run('a').positions).not.toEqual(run('b').positions);
  });

  it('seeds fewer sections when fewer entries are seeded', () => {
    const draw = generateQualifying({ entries: makeEntries(12, 1), sectionCount: 3, rng: createRng('few') });
    expect(draw.sections).toHaveLength(3);
  });

  it('rejects invalid section counts and too few entries', () => {
    expect(() => generateQualifying({ entries: makeEntries(10, 0), sectionCount: 0, rng: createRng('x') })).toThrow(DrawParamsError);
    expect(() => generateQualifying({ entries: makeEntries(5, 0), sectionCount: 3, rng: createRng('x') })).toThrow(DrawParamsError);
  });
});
