import { describe, expect, it } from 'vitest';
import { previewDraw } from './draw-preview.js';
import { DrawParamsError } from './types.js';

describe('previewDraw MAIN', () => {
  it('51 entries -> bracket 64, 13 BYEs, 16 seeds from a 0.25 ratio', () => {
    expect(previewDraw({ kind: 'MAIN', entryCount: 51, seedRatio: 0.25 })).toMatchObject({ size: 64, byeCount: 13, seedCount: 16, qualifierSlots: 0 });
  });

  it('counts qualifier slots and honours an explicit seed count, capped by size and entries', () => {
    expect(previewDraw({ kind: 'MAIN', entryCount: 26, qualifierCount: 6, seedCount: 8 })).toMatchObject({ size: 32, byeCount: 0, seedCount: 8, qualifierSlots: 6 });
    expect(previewDraw({ kind: 'MAIN', entryCount: 8, seedCount: 99 }).seedCount).toBe(4);
    expect(previewDraw({ kind: 'MAIN', entryCount: 3, seedCount: 99 }).seedCount).toBe(2);
    expect(previewDraw({ kind: 'MAIN', entryCount: 8 }).seedCount).toBe(0);
  });
});

describe('previewDraw QUALIFYING', () => {
  it('40 entries in 6 sections -> six brackets of 8', () => {
    const preview = previewDraw({ kind: 'QUALIFYING', entryCount: 40, qualifierCount: 6 });
    expect(preview).toMatchObject({ size: null, qualifierSlots: 6, seedCount: 6, byeCount: 8 });
    expect(preview.sectionSizes).toEqual([8, 8, 8, 8, 8, 8]);
  });

  it('needs at least one section', () => {
    expect(() => previewDraw({ kind: 'QUALIFYING', entryCount: 10 })).toThrow(DrawParamsError);
  });
});

describe('previewDraw GROUP', () => {
  it('derives the group count from the group size and sizes the follow-up knockout', () => {
    expect(previewDraw({ kind: 'GROUP', entryCount: 16, groupSize: 4, advancePerGroup: 2 })).toMatchObject({ groupCount: 4, size: 8, byeCount: 0, seedCount: 4 });
    expect(previewDraw({ kind: 'GROUP', entryCount: 18, groupSize: 4 })).toMatchObject({ groupCount: 5, size: 16, byeCount: 6 });
  });

  it('accepts an explicit group count and advance of 1', () => {
    expect(previewDraw({ kind: 'GROUP', entryCount: 12, groupCount: 3, advancePerGroup: 1 })).toMatchObject({ groupCount: 3, size: 4, byeCount: 1 });
  });

  it('rejects unsupported advance counts, tiny groups and bad entry counts', () => {
    expect(() => previewDraw({ kind: 'GROUP', entryCount: 12, groupSize: 4, advancePerGroup: 3 })).toThrow(DrawParamsError);
    expect(() => previewDraw({ kind: 'GROUP', entryCount: 8, groupCount: 4 })).toThrow(DrawParamsError);
    expect(() => previewDraw({ kind: 'GROUP', entryCount: 8, groupCount: 0 })).toThrow(DrawParamsError);
    expect(() => previewDraw({ kind: 'MAIN', entryCount: -1 })).toThrow(DrawParamsError);
  });
});
